import { describe, it, expect } from 'vitest';
import { questions, topics } from './content';
import { assessInterview, reviseInterview, saveInterviewDraft, advance, answer, emptyProgress, firstAttempts, grade, localDay, newQueue, parseProgress, previousDay, reviewQueue, startSession, statistics, type Progress } from './domain';
const at = (day: string) => new Date(`${day}T12:00:00`);
function submit(p: Progress, selected: number[], day = '2026-11-06') {
  if (!p.session) throw Error('test requires session');
  return answer({ ...p, session: { ...p.session, selected } }, at(day));
}
describe('question bank integrity', () => {
  it('has 70 unique complete questions, including ten written interview challenges', () => {
    expect(questions).toHaveLength(70);
    expect(new Set(questions.map(q=>q.id)).size).toBe(70);
    const counts = {sv:12,sva:12,uvm:12,cdc:12,arch:11,debug:11};
    for (const t of topics) expect(questions.filter(q=>q.topic===t.id)).toHaveLength(counts[t.id]);
    expect(questions.filter(q=>q.interview)).toHaveLength(10);
    for (const q of questions) {
      expect(q.correct.length).toBeGreaterThan(0);
      expect(q.correct.length).toBeLessThan(q.options.length);
      expect(new Set(q.correct).size).toBe(q.correct.length);
      expect(q.correct.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length)).toBe(true);
      expect(q.options.every(o=>o.text.trim().length>0&&o.why.length>15)).toBe(true);
      expect(q.lesson.length).toBeGreaterThan(40);
      if(q.interview) {
        expect(q.interview.steps.length).toBeGreaterThanOrEqual(4);
        expect(q.interview.steps.every(s=>s.title && s.body.length>80)).toBe(true);
        expect(q.interview.pitfalls.length).toBeGreaterThanOrEqual(2);
        expect(q.interview.rubric).toHaveLength(4);
        expect(q.interview.followUp.solution.length).toBeGreaterThan(100);
        expect(q.interview.references.every(r=>r.url.startsWith('https://'))).toBe(true);
        expect(q.interview.provenance).toMatch(/Original/);
      }
    }
  });
  it('matches hand-traced RTL numerical results', () => {
    const expected: Record<string,string> = { 'sv-01':'a = 0, b = 1', 'sv-02':'0', 'sv-05':"8'h00", 'sv-09':"16'h0080", 'arch-02':'3', 'debug-04':'4 beats, 4 bytes per beat' };
    for (const [id,text] of Object.entries(expected)) {
      const q=questions.find(q=>q.id===id)!;
      expect(q.correct.map(i=>q.options[i].text)).toEqual([text]);
    }
  });
});

describe('written interview practice',()=>{
  const start=()=>startSession(emptyProgress(),'new','all','interview');
  it('creates a written-only queue and preserves an existing legacy session',()=>{
    const p=start();
    expect(p.session?.queue).toHaveLength(10);
    expect(p.session?.queue.every(id=>questions.find(q=>q.id===id)?.interview)).toBe(true);
    const legacy=startSession(emptyProgress(),'new');
    expect(startSession(legacy,'new','all','interview')).toBe(legacy);
  });
  it('locks a nonempty original response before rubric assessment and rejects the MCQ path',()=>{
    const p=start();
    expect(()=>saveInterviewDraft(p,'  ',true)).toThrow();
    expect(()=>assessInterview(p,[0,1,2,3])).toThrow();
    expect(()=>answer({...p,session:{...p.session!,selected:[1]}})).toThrow(/written response/);
    const draft=saveInterviewDraft(p,'Trace, code, and assumptions.');
    expect(parseProgress(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    const revealed=saveInterviewDraft(draft,draft.session!.response!,true);
    expect(saveInterviewDraft(revealed,'Replace the original')).toBe(revealed);
    expect(parseProgress(JSON.parse(JSON.stringify(revealed)))).toEqual(revealed);
  });
  it('records a failed self-review even with zero rubric points, and retains a separate rewrite',()=>{
    let p=saveInterviewDraft(start(),'My original attempt',true);
    p=assessInterview(p,[],at('2026-11-06'));
    expect(p.attempts[0]).toMatchObject({correct:false,selected:[0],assessment:'self',response:'My original attempt',rubric:[],xp:5});
    expect(reviewQueue(p)).toEqual([p.session!.queue[0]]);
    expect(assessInterview(p,[0,1,2,3])).toBe(p);
    p=reviseInterview(p,'A stronger explanation');
    expect(p.attempts[0]).toMatchObject({response:'My original attempt',revision:'A stronger explanation',correct:false});
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const next=advance(p);
    expect(next.session?.response).toBeUndefined();
    expect(next.session?.solutionRevealed).toBeUndefined();
  });
  it('requires all rubric points, separates automatic accuracy, and preserves one-time recovery XP',()=>{
    let p=assessInterview(saveInterviewDraft(start(),'First response',true),[0,1,2],at('2026-11-06'));
    expect(statistics(p,at('2026-11-06'))).toMatchObject({accuracy:null,selfAssessed:1,completed:1});
    p=startSession({...p,session:null},'review');
    p=assessInterview(saveInterviewDraft(p,'Complete retry response',true),[3,2,1,0],at('2026-11-06'));
    expect(p.attempts.at(-1)?.xp).toBe(10);
    expect(reviewQueue(p)).toEqual([]);
    p=startSession({...p,session:null},'new','sv');
    p=submit(p,[1]);
    expect(statistics(p,at('2026-11-06'))).toMatchObject({accuracy:100,selfAssessed:1,completed:2,xp:35});
  });
  it('rejects malformed rubric, oversized responses, and inconsistent persisted assessments',()=>{
    const p=saveInterviewDraft(start(),'Original',true);
    for(const rubric of [[0,0],[4],[-1]]) expect(()=>assessInterview(p,rubric)).toThrow();
    expect(()=>saveInterviewDraft(start(),'a'.repeat(12001))).toThrow();
    const graded=assessInterview(p,[0,1,2,3]);
    expect(()=>parseProgress({...graded,attempts:[{...graded.attempts[0],correct:false}]})).toThrow(/not been overwritten/);
    expect(()=>parseProgress({...graded,session:{...graded.session,response:'changed'}})).toThrow(/not been overwritten/);
  });
  it('independently checks the authored pointer arithmetic and arbitration traces',()=>{
    const gray=(n:number)=>n^(n>>>1);
    expect(gray(8)).toBe(0b1100);
    for(let r=0;r<16;r++) expect(gray((r+8)%16)).toBe(gray(r)^0b1100);
    expect(gray(7)).toBe(0b0100);
    let pointer=0;
    const winners:number[]=[],after:number[]=[];
    for(const ready of [0,0,1,1,1]) {winners.push(pointer);if(ready)pointer=(pointer+1)%4;after.push(pointer);}
    expect(winners).toEqual([0,0,0,1,2]);expect(after).toEqual([0,0,1,2,3]);
  });
});
describe('learning progression', () => {
  it('requires an exact set for multi-answer questions, without duplicates', () => {
    expect(grade([1,0],[0,1])).toBe(true);
    expect(grade([0],[0,1])).toBe(false);
    expect(grade([0,1,2],[0,1])).toBe(false);
    expect(grade([0,0],[0,1])).toBe(false);
  });
  it('interleaves mixed topics and excludes completed questions from new sessions', () => {
    let p=startSession(emptyProgress(),'new');
    expect(p.session?.queue.slice(0,6)).toEqual(['sv-01','sva-01','uvm-01','cdc-01','arch-01','debug-01']);
    p=submit(p,[1]);
    expect(newQueue(p)).not.toContain('sv-01');
    expect(firstAttempts(p)).toHaveLength(1);
    expect(p.attempts[0].xp).toBe(20);
    expect(p.session?.answered).toBe(true);
  });
  it('never advances or records an empty answer', () => {
    const p=startSession(emptyProgress(),'new');
    expect(answer(p)).toBe(p);
    expect(advance(p)).toBe(p);
  });
  it('cannot submit an answered question twice', () => {
    const p=submit(startSession(emptyProgress(),'new'),[1]);
    expect(answer(p)).toBe(p);
    const next=advance(p);
    expect(next.session?.index).toBe(1);
    expect(next.session?.selected).toEqual([]);
    expect(next.session?.answered).toBe(false);
  });
  it('keeps first-attempt accuracy independent of successful review', () => {
    let p=submit(startSession(emptyProgress(),'new','sv'),[0]);
    expect(reviewQueue(p)).toEqual(['sv-01']);
    expect(statistics(p,at('2026-11-06')).xp).toBe(5);
    p={...p,session:null};p=submit(startSession(p,'review'),[1]);
    expect(reviewQueue(p)).toEqual([]);
    expect(statistics(p,at('2026-11-06'))).toMatchObject({accuracy:0,completed:1,xp:15,todayCount:1});
  });
  it('finishes the session and preserves answers and XP', () => {
    const p={...emptyProgress(),goal:1};
    const done=advance(submit(startSession(p,'new'),[1]));
    expect(done.session).toBeNull();expect(done.attempts).toHaveLength(1);
    expect(statistics(done,at('2026-11-06')).xp).toBe(20);
  });
  it('round-trips selected choices and feedback through JSON', () => {
    const p=submit(startSession(emptyProgress(),'new'),[1]);
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('rejects malformed cloud state instead of wiping it', () => {
    expect(()=>parseProgress({schema:2})).toThrow(/not been overwritten/);
    expect(()=>parseProgress({...emptyProgress(),attempts:[{}]})).toThrow(/not been overwritten/);
    expect(()=>parseProgress({...emptyProgress(),session:{queue:['sv-01'],index:5}})).toThrow(/not been overwritten/);
  });
  it('rejects invalid dates, null answers, duplicate IDs and inconsistent feedback',()=>{
    const p=submit(startSession(emptyProgress(),'new'),[1]);
    const a=p.attempts[0];
    for(const attempts of [[null],[{...a,day:'NaN-NaN-NaN'}],[{...a,day:'2026-02-30'}],[{...a,at:'bad date'}],[a,a]]) expect(()=>parseProgress({...p,attempts})).toThrow(/not been overwritten/);
    for(const session of [{...p.session,attemptId:'missing'},{...p.session,selected:[9]},{...p.session,topic:'missing'}]) expect(()=>parseProgress({...p,session})).toThrow(/not been overwritten/);
  });
  it('preserves an active session and rejects invalid answer indices',()=>{
    const p=startSession(emptyProgress(),'new','sv');
    expect(startSession(p,'review')).toBe(p);
    expect(()=>submit(p,[-1])).toThrow(/valid answer/);
    expect(()=>submit(p,[1,1])).toThrow(/valid answer/);
  });
  it('returns no new session if the bank is exhausted', () => {
    const p={...emptyProgress(),attempts:questions.map(q=>({id:q.id,questionId:q.id,selected:q.correct,correct:true,at:at('2026-11-06').toISOString(),day:'2026-11-06',xp:20}))};
    expect(newQueue(p)).toEqual([]);expect(startSession(p,'new')).toBe(p);
  });
});
describe('daily progress across calendar boundaries', () => {
  const make=(days:string[])=>({...emptyProgress(),attempts:days.map((day,i)=>({id:String(i),questionId:'sv-01',selected:[1],correct:true,at:at(day).toISOString(),day,xp:0}))});
  it('keeps yesterday’s streak alive before the first answer today', () => {
    expect(statistics(make(['2026-11-04','2026-11-05']),at('2026-11-06')).streak).toBe(2);
    expect(statistics(make(['2026-11-04']),at('2026-11-06')).streak).toBe(0);
  });
  it('does not count repeated answers to one question more than once daily', () => {
    expect(statistics(make(['2026-11-06','2026-11-06']),at('2026-11-06'))).toMatchObject({todayCount:1,streak:1});
  });
  it('handles month, leap-year, and daylight-saving boundaries by calendar date', () => {
    expect(previousDay('2026-03-09')).toBe('2026-03-08');
    expect(previousDay('2026-11-02')).toBe('2026-11-01');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(localDay(at('2026-11-06'))).toBe('2026-11-06');
  });
});
