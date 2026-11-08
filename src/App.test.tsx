// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { answer, emptyProgress, startSession } from './domain';
import type { CloudRecord } from './cloud';
import { questions } from './content';

const cloud = vi.hoisted(()=>({
  configured: true, setupError: '', loadProgress: vi.fn(), saveProgress: vi.fn(),
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn(), unsubscribe: vi.fn(),
  signInWithOtp: vi.fn(), verifyOtp: vi.fn(),
}));
vi.mock('./cloud',()=>({
  ...cloud, get configured(){return cloud.configured;},
  supabase:{auth:{getSession:cloud.getSession,onAuthStateChange:cloud.onAuthStateChange,signOut:cloud.signOut,signInWithOtp:cloud.signInWithOtp,verifyOtp:cloud.verifyOtp}},
}));
import { App } from './App';

const account = (id:string)=>({user:{id}} as Session);
const row = (goal=10):CloudRecord=>({revision:0,payload:{...emptyProgress(),goal}});
function deferred<T>() { let resolve!:(value:T)=>void; let reject!:(error:Error)=>void; const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; }
let root:Root;
let host:HTMLDivElement;
let authEvent: (event:string,session:Session|null)=>void;
async function render() { await act(async()=>{root.render(<App/>);}); }
function button(text:string, selector='button') {
  const result=[...host.querySelectorAll<HTMLButtonElement>(selector)].find(b=>b.textContent?.includes(text));
  if(!result) throw Error(`Missing button: ${text}`);
  return result;
}
async function click(text:string,selector?:string) { await act(async()=>{button(text,selector).click();}); }
async function emit(session:Session|null) { await act(async()=>{authEvent(session?'SIGNED_IN':'SIGNED_OUT',session);}); }
async function fill(id:string,value:string) {
  const input=host.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
async function submitForm() { await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}); }
async function writeResponse(id:string,value:string) {
  const input=host.querySelector<HTMLTextAreaElement>(`#${id}`)!;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

beforeEach(()=>{
  vi.resetAllMocks();
  cloud.configured=true;
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  cloud.getSession.mockResolvedValue({data:{session:account('a')},error:null});
  cloud.onAuthStateChange.mockImplementation(callback=>{authEvent=callback;return {data:{subscription:{unsubscribe:cloud.unsubscribe}}};});
  cloud.loadProgress.mockResolvedValue(row());
  cloud.signInWithOtp.mockResolvedValue({error:null});cloud.verifyOtp.mockResolvedValue({error:null});
  cloud.saveProgress.mockImplementation(async(previous:CloudRecord,payload)=>({revision:previous.revision+1,payload}));
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});

describe('workspace auth and cloud lifecycle',()=>{
  it('uses written questions for the main practice entry and topic sessions',async()=>{
    await render();await click('Start a session');
    let saved=cloud.saveProgress.mock.calls.at(-1)![1];
    expect(saved.session.queue.every((id:string)=>questions.find(q=>q.id===id)?.interview)).toBe(true);
    expect(host.querySelector('.answer-options')).toBeNull();
    await click('End session');await click('Overview','.sidebar button');
    await click('SystemVerilog & RTL','.topic-card');
    saved=cloud.saveProgress.mock.calls.at(-1)![1];
    expect(saved.session.queue).toEqual(['sv-11','sv-12']);
  });
  it('commits a written response before revealing teaching, saves gaps and a separate improved answer',async()=>{
    cloud.loadProgress.mockResolvedValue(row(1));await render();await click('Start interview practice');
    expect(host.querySelector('.answer-options')).toBeNull();
    expect(host.textContent).not.toContain('Start with the fundamentals');
    expect(button('Commit answer').disabled).toBe(true);
    await writeResponse('interview-response','It becomes 3 because both operations cancel.');
    await click('Save draft');
    const draft=cloud.saveProgress.mock.calls.at(-1)![1];
    expect(draft.session.response).toContain('becomes 3');
    await click('Overview','.sidebar button');await click('Continue practice');
    expect(host.querySelector<HTMLTextAreaElement>('#interview-response')?.value).toContain('becomes 3');
    await click('Commit answer');
    expect(host.querySelector('#interview-response')).toBeNull();
    expect(host.textContent).toContain('Start with the fundamentals');
    expect(host.textContent).toContain('The settled count is 2');
    expect(host.textContent).toContain('Common mistakes and how to fix them');
    await click('Save self-review');
    expect(host.textContent).toContain('Needs more work.');
    expect(host.textContent).toContain('Focus your rewrite on these gaps');
    await writeResponse('improved-response','Both RHS use old count; the later update wins, producing 2.');
    await click('Save improved answer');
    const saved=cloud.saveProgress.mock.calls.at(-1)![1];
    expect(saved.attempts[0]).toMatchObject({response:'It becomes 3 because both operations cancel.',revision:'Both RHS use old count; the later update wins, producing 2.',correct:false,assessment:'self'});
    await click('Finish session');expect(host.textContent).toContain('1 self-reviewed');
    await click('Go to review');await click('Start review');
    expect(host.querySelector<HTMLTextAreaElement>('#interview-response')?.value).toBe('');
    expect(host.textContent).not.toContain('The settled count is 2');
    await writeResponse('interview-response','A complete independent retry with code and boundary cases.');
    await click('Commit answer');
    for(const checkbox of host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) await act(async()=>checkbox.click());
    await click('Save self-review');expect(host.textContent).toContain('Self-assessed: all essential points met.');
    expect(cloud.saveProgress.mock.calls.at(-1)![1].attempts.at(-1).xp).toBe(10);
    await click('Finish session');await click('Go to review');expect(host.textContent).toContain('A clean slate.');
    await click('Progress','.sidebar button');
    expect(host.textContent).toContain('0 / 0 automatic · 1 self-reviews');
  });
  it('reveals no solution until a failed commit is confirmed by cloud retry',async()=>{
    await render();await click('Start interview practice');
    await writeResponse('interview-response','My committed reasoning.');
    cloud.saveProgress.mockRejectedValueOnce(Error('Network disconnected'));
    await click('Commit answer');
    expect(host.textContent).not.toContain('Start with the fundamentals');
    expect(button('Commit answer').disabled).toBe(true);
    const pending=cloud.saveProgress.mock.calls.at(-1)![1];
    await click('Retry save');
    expect(cloud.saveProgress.mock.calls.at(-1)![1]).toBe(pending);
    expect(host.textContent).toContain('Start with the fundamentals');
  });
  it('keeps an unsaved written draft through visibility events and retains stale-device protection',async()=>{
    await render();await click('Start interview practice');
    await writeResponse('interview-response','Unsaved work must survive a refresh event.');
    const loads=cloud.loadProgress.mock.calls.length;
    await act(async()=>document.dispatchEvent(new Event('visibilitychange')));
    expect(cloud.loadProgress).toHaveBeenCalledTimes(loads);
    expect(host.querySelector<HTMLTextAreaElement>('#interview-response')?.value).toContain('Unsaved work');
    const unload=new Event('beforeunload',{cancelable:true});
    await act(async()=>window.dispatchEvent(unload));expect(unload.defaultPrevented).toBe(true);
    cloud.saveProgress.mockRejectedValueOnce(Error('Progress changed on another device. Reload cloud progress.'));
    await click('Save draft');
    expect(host.textContent).toContain('Progress changed on another device');
    expect(host.querySelector<HTMLTextAreaElement>('#interview-response')?.value).toContain('Unsaved work');
    expect(button('Commit answer').disabled).toBe(true);
  });
  it('requests a default email link without signing up a user or requiring a code',async()=>{
    cloud.getSession.mockResolvedValue({data:{session:null},error:null});await render();
    await fill('email','owner@example.com');await submitForm();
    expect(cloud.signInWithOtp).toHaveBeenCalledWith({email:'owner@example.com',options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+window.location.pathname}});
    expect(host.textContent).toContain('Open the sign-in link in your email');
    expect(host.querySelector('#otp')).toBeNull();expect(cloud.loadProgress).not.toHaveBeenCalled();
    await click('Resend email');expect(cloud.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Please wait one minute');
    await emit(account('a'));expect(host.textContent).toContain('Welcome to your next level');
  });
  it('retains optional typed-code verification for a customized email template',async()=>{
    cloud.getSession.mockResolvedValue({data:{session:null},error:null});await render();
    await fill('email','owner@example.com');await submitForm();await click('My email includes a code');
    await fill('otp','123456');await submitForm();
    expect(cloud.verifyOtp).toHaveBeenCalledWith({email:'owner@example.com',token:'123456',type:'email'});
    await click('Change email');expect(host.querySelector('#email')).not.toBeNull();expect(host.querySelector('#otp')).toBeNull();
  });
  it('clears progress on account changes and ignores an old in-flight load',async()=>{
    const old=deferred<CloudRecord>(); const next=deferred<CloudRecord>();
    cloud.loadProgress.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await render();await emit(account('b'));
    await act(async()=>{old.resolve(row(15));});
    expect(host.textContent).not.toContain('Welcome to your next level');
    await act(async()=>{next.resolve(row(5));});
    expect(host.querySelector('.goal-ring')?.textContent).toContain('/5');
    expect(cloud.loadProgress).toHaveBeenCalledTimes(2);
  });
  it('drops confirmed state on external sign-out and reloads for the same user',async()=>{
    await render();expect(host.textContent).toContain('Welcome to your next level');
    await emit(null);expect(host.textContent).toContain('Welcome to MindReps.');
    expect(host.textContent).not.toContain('Questions explored');
    cloud.loadProgress.mockResolvedValue(row(15));await emit(account('a'));
    expect(host.querySelector('.goal-ring')?.textContent).toContain('/15');
  });
  it('ignores a save result after sign-out, including rapid re-entry',async()=>{
    await render();const save=deferred<CloudRecord>();cloud.saveProgress.mockReturnValueOnce(save.promise);
    await click('Start a session');const payload=cloud.saveProgress.mock.calls[0][1];
    await emit(null);await emit(account('a'));
    await act(async()=>{save.resolve({revision:1,payload});});
    expect(host.textContent).toContain('Welcome to your next level');
    expect(host.textContent).not.toContain('Continue practice');
  });
  it('does not mutate while a visibility refresh is reading cloud progress',async()=>{
    await render();const refresh=deferred<CloudRecord>();cloud.loadProgress.mockReturnValueOnce(refresh.promise);
    await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
    expect(button('Start a session').disabled).toBe(true);
    await click('Start a session');expect(cloud.saveProgress).not.toHaveBeenCalled();
    await act(async()=>{refresh.resolve(row(5));});
    await click('Start a session');expect(cloud.saveProgress.mock.calls[0][1].session.queue).toHaveLength(5);
  });
  it('keeps the confirmed answer until retry succeeds, reusing its mutation ID',async()=>{
    cloud.loadProgress.mockResolvedValue({revision:3,payload:startSession(emptyProgress(),'new')});
    await render();await click('Continue practice');await click('a = 0, b = 1');
    cloud.saveProgress.mockRejectedValueOnce(Error('Network disconnected'));
    await click('Check answer');
    expect(host.textContent).not.toContain('Exactly. Here’s the reasoning.');
    expect(button('Check answer').disabled).toBe(true);
    const failed=cloud.saveProgress.mock.calls.at(-1)![1];
    await act(async()=>{window.dispatchEvent(new Event('online'));});
    expect(cloud.loadProgress).toHaveBeenCalledTimes(1);
    await click('Retry save');
    expect(cloud.saveProgress.mock.calls.at(-1)![1]).toBe(failed);
    expect(host.textContent).toContain('Exactly. Here’s the reasoning.');
    expect(failed.attempts).toHaveLength(1);expect(failed.attempts[0].xp).toBe(20);
  });
  it('resumes saved feedback and a topic label without resubmitting the answer',async()=>{
    let p=startSession(emptyProgress(),'new','sv');p=answer({...p,session:{...p.session!,selected:[1]}});
    cloud.loadProgress.mockResolvedValue({revision:4,payload:p});
    await render();await click('Continue practice');
    expect(host.textContent).toContain('SystemVerilog practice');
    expect(host.textContent).toContain('Exactly. Here’s the reasoning.');
    expect(cloud.saveProgress).not.toHaveBeenCalled();
    await click('Next question');expect(cloud.saveProgress.mock.calls[0][1].session.index).toBe(1);
  });
  it('uses the newest auth event over a delayed initial session response',async()=>{
    const session=deferred<{data:{session:Session},error:null}>();cloud.getSession.mockReturnValue(session.promise);
    await render();await emit(account('b'));
    await act(async()=>{session.resolve({data:{session:account('a')},error:null});});
    expect(cloud.loadProgress).toHaveBeenCalledTimes(1);
  });
  it('offers a retry when initial session retrieval rejects',async()=>{
    cloud.getSession.mockRejectedValueOnce(Error('Auth unavailable'));await render();
    expect(host.textContent).toContain('Auth unavailable');await click('Retry sign-in connection');
    expect(host.textContent).toContain('Welcome to your next level');
  });
  it('finishes an incorrect session, recovers through review, and keeps first-try accuracy',async()=>{
    cloud.loadProgress.mockResolvedValue({revision:3,payload:startSession({...emptyProgress(),goal:1},'new')});await render();await click('Continue practice');
    await click('a = 1, b = 1');await click('Check answer');
    expect(host.textContent).toContain('A useful mistake.');await click('Finish session');
    expect(host.textContent).toContain('0 of 1 answered correctly');expect(host.textContent).toContain('5 XP');
    await click('Go to review');await click('Start review');await click('a = 0, b = 1');await click('Check answer');
    expect(host.textContent).toContain('+10 XP');await click('Finish session');
    expect(host.textContent).toContain('1 of 1 answered correctly');
    await click('Go to review');expect(host.textContent).toContain('A clean slate.');
    await click('Progress','.sidebar button');
    expect(host.querySelectorAll('.stat-value')[0].textContent).toBe('15');
    expect(host.querySelectorAll('.stat-value')[1].textContent).toBe('0%');
  });
  it('discards a failed selection when explicitly reloading newer cloud progress',async()=>{
    cloud.loadProgress.mockResolvedValue({revision:3,payload:startSession(emptyProgress(),'new')});
    await render();await click('Continue practice');
    cloud.saveProgress.mockRejectedValueOnce(Error('Progress changed on another device'));
    await click('a = 0, b = 1');
    const newer=startSession({...emptyProgress(),goal:5},'new','cdc');
    cloud.loadProgress.mockResolvedValue({revision:9,payload:newer});
    await click('Reload cloud progress');expect(host.textContent).toContain('What a synchronizer actually promises');
    expect(host.textContent).not.toContain('Retry save');
    await click('It reduces the probability');
    expect(cloud.saveProgress.mock.calls.at(-1)![0].revision).toBe(9);
  });
  it('shows an exhausted bank without creating an empty session',async()=>{
    const payload={...emptyProgress(),attempts:questions.map(q=>({id:q.id,questionId:q.id,selected:q.correct,correct:true,at:'2026-11-06T12:00:00Z',day:'2026-11-06',xp:20}))};
    cloud.loadProgress.mockResolvedValue({revision:60,payload});await render();
    expect(button('Start a session').disabled).toBe(true);await click('Practice','.sidebar button');
    expect(host.textContent).toContain('You have explored every question');
    expect(button('Start new practice').disabled).toBe(true);expect(cloud.saveProgress).not.toHaveBeenCalled();
  });
  it('resets in-memory preview progress when exiting and re-entering',async()=>{
    cloud.configured=false;cloud.getSession.mockResolvedValue({data:{session:null},error:null});
    await render();await click('Explore the interactive preview');await click('Start a session');
    await writeResponse('interview-response','Preview response.');await click('Commit answer');await click('Save self-review');await click('Setup');
    await click('Explore the interactive preview');
    expect(host.querySelectorAll('.stat-value')[0].textContent).toBe('0');
    expect(host.textContent).not.toContain('Continue practice');
    expect(cloud.saveProgress).not.toHaveBeenCalled();expect(cloud.loadProgress).not.toHaveBeenCalled();
  });
});
