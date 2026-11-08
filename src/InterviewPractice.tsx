import { useEffect, useState } from 'react';
import type { Question } from './content';
import { RESPONSE_LIMIT, type Attempt, type PracticeSession } from './domain';

type Props = {
  question: Question; session: PracticeSession; attempt?: Attempt; disabled: boolean;
  onDraft: (response: string, reveal: boolean) => void;
  onAssess: (rubric: number[]) => void;
  onRevise: (revision: string) => void;
  onNext: () => void;
  onDirty: (dirty: boolean) => void;
};

export function InterviewPractice({ question: q, session: s, attempt, disabled, onDraft, onAssess, onRevise, onNext, onDirty }: Props) {
  const lesson = q.interview!;
  const [response, setResponse] = useState(s.response ?? '');
  const [rubric, setRubric] = useState<number[]>(attempt?.rubric ?? []);
  const [revision, setRevision] = useState(attempt?.revision ?? '');
  const dirty = (!s.solutionRevealed && response !== (s.response ?? '')) || (!s.answered && rubric.length > 0) || (s.answered && revision !== (attempt?.revision ?? ''));
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => setResponse(s.response ?? ''), [s.response]);
  useEffect(() => setRevision(attempt?.revision ?? ''), [attempt?.revision]);
  useEffect(() => { if (s.answered) setRubric(attempt?.rubric ?? []); }, [s.answered, attempt?.rubric]);
  return <div className="interview-practice">
    <p className="assessment-note">Write your solution, reasoning, and assumptions before opening the worked answer. This challenge uses a self-review rubric; your writing is not automatically graded.</p>
    {!s.solutionRevealed ? <section className="response-panel card" aria-label="Written response">
      <label htmlFor="interview-response">Your answer</label>
      <textarea id="interview-response" value={response} maxLength={RESPONSE_LIMIT} rows={10} disabled={disabled} onChange={e => setResponse(e.target.value)} placeholder="Work through the behavior. Include a trace, code, or counterexample where useful."/>
      <p className="draft-status" role="status">{response === (s.response ?? '') ? 'Draft is up to date.' : 'Unsaved draft. Save before leaving this page.'} {response.length.toLocaleString()} / {RESPONSE_LIMIT.toLocaleString()} characters</p>
      <div className="inline-actions"><button className="button secondary" disabled={disabled || response === (s.response ?? '')} onClick={() => onDraft(response, false)}>Save draft</button><button className="button primary" disabled={disabled || !response.trim()} onClick={() => onDraft(response, true)}>Commit answer & study solution</button></div>
      <p className="small-copy">Committing saves and locks your original answer. You can write a separate improved answer after reviewing it.</p>
    </section> : <>
      <section className="response-panel card"><h2>Your committed answer</h2><pre className="written-response">{s.response}</pre></section>
      <section className="worked-solution card" aria-label="Worked interview solution">
        <span className="eyebrow">BUILD THE REASONING</span><h2>A path to a complete answer</h2><p className="lesson">{q.lesson}</p>
        <h3>Start with the fundamentals</h3><p>{lesson.foundations}</p>
        <ol className="solution-steps">{lesson.steps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.body}</p>{step.code && <pre><code>{step.code}</code></pre>}</li>)}</ol>
        <h3>Common mistakes and how to fix them</h3><dl className="misconceptions">{lesson.pitfalls.map(p => <div key={p.mistake}><dt>{p.mistake}</dt><dd>{p.correction}</dd></div>)}</dl>
        <section className="transfer-challenge"><h3>Apply it to a changed scenario</h3><p>{lesson.followUp.prompt}</p><details><summary>Show follow-up reasoning after trying it</summary><p>{lesson.followUp.solution}</p></details></section>
        <div className="challenge-sources"><h3>Question provenance</h3><p>{lesson.provenance}</p>{lesson.sources.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.title} ↗</a>)}<h3>Go deeper</h3>{lesson.references.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.title} ↗</a>)}</div>
      </section>
      <section className="response-panel card" aria-label="Self-review rubric">
        <h2>{s.answered ? 'Your original answer review' : 'What did your original answer demonstrate?'}</h2>
        <p>Check only points already present in your committed answer. Reading the solution does not count. Every point is essential; leave missing or uncertain points unchecked.</p>
        <fieldset disabled={disabled || s.answered}><legend className="sr-only">Essential reasoning points</legend>{lesson.rubric.map((point, i) => <label className="rubric-point" key={point}><input type="checkbox" checked={rubric.includes(i)} onChange={e => setRubric(e.target.checked ? [...rubric, i] : rubric.filter(n => n !== i))}/><span>{point}</span></label>)}</fieldset>
        {!s.answered ? <><p>{rubric.length} of {lesson.rubric.length} essential points met · {rubric.length === lesson.rubric.length ? 'Self-assessed as complete' : 'Keep this challenge in Review'}</p><button className="button primary" disabled={disabled} onClick={() => onAssess(rubric)}>Save self-review</button></> : <>
          <p className="review-result" role="status">{attempt?.correct ? 'Self-assessed: all essential points met.' : 'Needs more work. This challenge is in your review queue.'} +{attempt?.xp ?? 0} XP</p>
          {!attempt?.correct && <div className="learning-gaps"><h3>Focus your rewrite on these gaps</h3><ul>{lesson.rubric.filter((_, i) => !attempt?.rubric?.includes(i)).map(point => <li key={point}>{point}</li>)}</ul></div>}
          <label htmlFor="improved-response">Write a stronger answer in your own words</label><textarea id="improved-response" value={revision} rows={8} maxLength={RESPONSE_LIMIT} disabled={disabled} onChange={e => setRevision(e.target.value)} placeholder="Use the missing rubric points to reconstruct a complete solution."/>
          <div className="inline-actions"><button className="button secondary" disabled={disabled || !revision.trim() || revision === attempt?.revision} onClick={() => onRevise(revision)}>Save improved answer</button><button className="button primary" disabled={disabled} onClick={onNext}>{s.index + 1 === s.queue.length ? 'Finish session' : 'Next question'}</button></div>
          <p className="draft-status" role="status">{revision && revision === attempt?.revision ? 'Improved answer saved.' : revision ? 'Your improved answer has unsaved changes.' : 'A rewrite is optional. Your original result stays unchanged.'} Revisit missed challenges in Review without the solution visible.</p>
        </>}
      </section>
    </>}
  </div>;
}
