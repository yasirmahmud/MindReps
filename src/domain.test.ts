import { describe, it, expect } from 'vitest';
import { questions, topics } from './content';
import { advance, answer, emptyProgress, firstAttempts, grade, localDay, newQueue, parseProgress, previousDay, reviewQueue, startSession, statistics, type Progress } from './domain';
const at = (day: string) => new Date(`${day}T12:00:00`);
function submit(p: Progress, selected: number[], day = '2026-11-06') {
  if (!p.session) throw Error('test requires session');
  return answer({ ...p, session: { ...p.session, selected } }, at(day));
}
describe('question bank integrity', () => {
  it('has 60 unique, complete questions and 10 per topic', () => {
    expect(questions).toHaveLength(60);
    expect(new Set(questions.map(q=>q.id)).size).toBe(60);
    for (const t of topics) expect(questions.filter(q=>q.topic===t.id)).toHaveLength(10);
    for (const q of questions) {
      expect(q.correct.length).toBeGreaterThan(0);
      expect(q.correct.length).toBeLessThan(q.options.length);
      expect(new Set(q.correct).size).toBe(q.correct.length);
      expect(q.correct.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length)).toBe(true);
      expect(q.options.every(o=>o.text.trim().length>0&&o.why.length>15)).toBe(true);
      expect(q.lesson.length).toBeGreaterThan(40);
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
