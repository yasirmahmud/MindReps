import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyProgress } from './domain';
const owner='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
let db:PGlite;
async function as(role:'anon'|'authenticated',id?:string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)",[id||'']);
  await db.exec(`set role ${role}`);
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema);
  await db.exec(schema); // Idempotent setup must preserve policies and grants.
  await db.query('insert into auth.users values ($1), ($2)',[owner,outsider]);
  await db.query('insert into app_private.owner(user_id) values ($1)',[owner]);
},30000);
beforeEach(async()=>{await db.exec('reset role; delete from public.learning_progress;');});
afterAll(async()=>{await db?.close();});
describe('single-owner database boundary (real Postgres engine)',()=>{
  it('rejects anonymous progress reads and RPC execution',async()=>{
    await as('anon');
    await expect(db.query('select * from public.learning_progress')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from public.load_progress($1::jsonb)',[emptyProgress()])).rejects.toThrow(/permission denied/);
  });
  it('rejects an authenticated account outside the owner allowlist',async()=>{
    await as('authenticated',outsider);
    await expect(db.query('select * from public.load_progress($1::jsonb)',[emptyProgress()])).rejects.toThrow(/not authorized/);
    await expect(db.query('select * from public.save_progress(0,$1::jsonb)',[{...emptyProgress(),lastMutation:'x'}])).rejects.toThrow(/not authorized/);
    expect((await db.query('select * from public.learning_progress')).rows).toEqual([]);
  });
  it('initializes and resumes the same owner record without resetting it',async()=>{
    await as('authenticated',owner);
    const initial=await db.query<{revision:number}>('select * from public.load_progress($1::jsonb)',[emptyProgress()]);
    expect(Number(initial.rows[0].revision)).toBe(0);
    const payload={...emptyProgress(),goal:15,lastMutation:'first-write'};
    const saved=await db.query<{revision:number}>('select * from public.save_progress(0,$1::jsonb)',[payload]);
    expect(Number(saved.rows[0].revision)).toBe(1);
    const resumed=await db.query<{payload:unknown}>('select * from public.load_progress($1::jsonb)',[emptyProgress()]);
    expect(resumed.rows[0].payload).toEqual(payload);
  });
  it('rejects stale device writes and preserves the newer value',async()=>{
    await as('authenticated',owner);
    await db.query('select * from public.load_progress($1::jsonb)',[emptyProgress()]);
    const saved={...emptyProgress(),goal:15,lastMutation:'device-a'};
    await db.query('select * from public.save_progress(0,$1::jsonb)',[saved]);
    await expect(db.query('select * from public.save_progress(0,$1::jsonb)',[{...emptyProgress(),goal:5,lastMutation:'device-b'}])).rejects.toThrow(/changed on another device/);
    const latest=await db.query<{payload:unknown}>('select * from public.learning_progress');
    expect(latest.rows[0].payload).toEqual(saved);
  });
  it('prevents bypassing revisions through direct table writes',async()=>{
    await as('authenticated',owner);
    await expect(db.query('insert into public.learning_progress(user_id,payload) values ($1,$2)',[owner,emptyProgress()])).rejects.toThrow(/permission denied/);
    await expect(db.query('update public.learning_progress set revision=0')).rejects.toThrow(/permission denied/);
    await expect(db.query('delete from public.learning_progress')).rejects.toThrow(/permission denied/);
  });
  it('keeps the owner allowlist private and limited to one user',async()=>{
    await as('authenticated',owner);
    await expect(db.query('select * from app_private.owner')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await expect(db.query('insert into app_private.owner(user_id) values ($1)',[outsider])).rejects.toThrow(/duplicate key/);
  });
  it('rejects malformed writes without advancing the revision',async()=>{
    await as('authenticated',owner);
    await db.query('select * from public.load_progress($1::jsonb)',[emptyProgress()]);
    await expect(db.query('select * from public.save_progress(0,$1::jsonb)',[{schema:1,lastMutation:'bad'}])).rejects.toThrow(/Unsupported/);
    const latest=await db.query<{revision:number}>('select * from public.learning_progress');
    expect(Number(latest.rows[0].revision)).toBe(0);
  });
});
