import { describe, expect, it } from 'vitest';
import { configurationError } from './config';
const url='https://example.supabase.co';
const jwt=(role:string)=>`header.${btoa(JSON.stringify({role}))}.signature`;
describe('public Supabase configuration',()=>{
  it('accepts publishable and legacy anon keys',()=>{
    expect(configurationError(url,'sb_publishable_example')).toBe('');
    expect(configurationError(url,jwt('anon'))).toBe('');
    expect(configurationError('http://127.0.0.1:54321','sb_publishable_example')).toBe('');
  });
  it('rejects missing values, placeholders, unsafe URLs and privileged keys',()=>{
    for(const [u,k] of [[undefined,undefined],['not a URL','x'],['https://YOUR-PROJECT.supabase.co','YOUR-PUBLISHABLE-KEY'],['http://example.com','sb_publishable_example'],['https://user:pass@example.com','sb_publishable_example'],[url+'?key=x','sb_publishable_example'],[url,'sb_secret_example'],[url,jwt('service_role')]]) expect(configurationError(u,k)).not.toBe('');
  });
});
