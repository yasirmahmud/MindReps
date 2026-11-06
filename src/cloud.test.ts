import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { emptyProgress } from './domain';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc})}));
let cloud:typeof import('./cloud');
beforeAll(async()=>{
  vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_example');
  cloud=await import('./cloud');
});
beforeEach(()=>rpc.mockReset());
afterAll(()=>vi.unstubAllEnvs());
describe('cloud revision protocol',()=>{
  const initial={revision:0,payload:emptyProgress()};
  const next={...emptyProgress(),lastMutation:'same-change',goal:5};
  it('recognizes an already-committed mutation after a lost response',async()=>{
    rpc.mockResolvedValueOnce({error:{code:'40001'}}).mockResolvedValueOnce({data:[{revision:1,payload:next}]});
    await expect(cloud.saveProgress(initial,next)).resolves.toEqual({revision:1,payload:next});
    expect(rpc.mock.calls.map(c=>c[0])).toEqual(['save_progress','load_progress']);
  });
  it('preserves newer data when another device changed the revision',async()=>{
    rpc.mockResolvedValueOnce({error:{code:'40001'}}).mockResolvedValueOnce({data:[{revision:2,payload:{...next,lastMutation:'other'}}]});
    await expect(cloud.saveProgress(initial,next)).rejects.toThrow(/another device/);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('leaves an ambiguous network failure available for explicit retry',async()=>{
    rpc.mockResolvedValue({error:{code:'NETWORK',message:'Connection lost'}});
    await expect(cloud.saveProgress(initial,next)).rejects.toThrow(/Connection lost/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects unreadable rows and unsafe revisions',async()=>{
    for(const data of [[],[{revision:-1,payload:next}],[{revision:null,payload:next}],[{revision:'no',payload:next}],[{revision:1,payload:{schema:2}}]]) {
      rpc.mockResolvedValueOnce({data});await expect(cloud.loadProgress()).rejects.toThrow();
    }
  });
});
