import { questions, type TopicId } from './content';
export type Attempt = { id: string; questionId: string; selected: number[]; correct: boolean; at: string; day: string; xp: number };
export type PracticeSession = { id: string; mode: 'new' | 'review'; topic: TopicId | 'all'; queue: string[]; index: number; selected: number[]; answered: boolean; attemptId?: string };
export type Progress = { schema: 1; goal: number; attempts: Attempt[]; session: PracticeSession | null; lastMutation: string };
export const emptyProgress = (): Progress => ({ schema: 1, goal: 10, attempts: [], session: null, lastMutation: '' });
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1, 12));
}
export const grade = (selected: number[], correct: number[]) => selected.length === correct.length && new Set(selected).size === selected.length && correct.every(n => selected.includes(n));
export function validAttempts(progress: Progress): Attempt[] {
  const ids = new Set(questions.map(q => q.id));
  return progress.attempts.filter(a => ids.has(a.questionId));
}
export function firstAttempts(progress: Progress): Attempt[] {
  const seen = new Set<string>();
  return validAttempts(progress).filter(a => { if (seen.has(a.questionId)) return false; seen.add(a.questionId); return true; });
}
export function reviewQueue(progress: Progress, topic: TopicId | 'all' = 'all'): string[] {
  const latest = new Map<string, Attempt>();
  for (const a of validAttempts(progress)) latest.set(a.questionId, a);
  return questions.filter(q => (topic === 'all' || q.topic === topic) && latest.get(q.id)?.correct === false).map(q => q.id);
}
export function newQueue(progress: Progress, topic: TopicId | 'all' = 'all'): string[] {
  const seen = new Set(progress.attempts.map(a => a.questionId));
  // Interleave topics for mixed practice; within-topic order stays curated.
  const eligible = questions.filter(q => (topic === 'all' || q.topic === topic) && !seen.has(q.id));
  if (topic !== 'all') return eligible.map(q => q.id);
  return [...eligible].sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1])).map(q => q.id);
}
export function startSession(progress: Progress, mode: PracticeSession['mode'], topic: TopicId | 'all' = 'all'): Progress {
  if (progress.session) return progress;
  const queue = (mode === 'new' ? newQueue(progress, topic) : reviewQueue(progress, topic)).slice(0, progress.goal);
  if (!queue.length) return progress;
  return { ...progress, session: { id: crypto.randomUUID(), mode, topic, queue, index: 0, selected: [], answered: false } };
}
export function answer(progress: Progress, now = new Date()): Progress {
  const session = progress.session;
  if (!session || session.answered || !session.selected.length) return progress;
  const question = questions.find(q => q.id === session.queue[session.index]);
  if (!question) throw new Error('This question is no longer in the bank. End this session to start another.');
  if (!validSelection(session.selected, question.options.length) || (question.correct.length === 1 && session.selected.length !== 1)) throw new Error('Choose a valid answer before submitting.');
  const correct = grade(session.selected, question.correct);
  const first = !progress.attempts.some(a => a.questionId === question.id);
  // A reviewed item earns a one-time recovery bonus; repeating it cannot farm XP.
  const recovery = !first && correct && !progress.attempts.some(a => a.questionId === question.id && a.correct);
  const attempt: Attempt = { id: crypto.randomUUID(), questionId: question.id, selected: [...session.selected], correct, at: now.toISOString(), day: localDay(now), xp: first ? (correct ? 20 : 5) : recovery ? 10 : 0 };
  return { ...progress, attempts: [...progress.attempts, attempt], session: { ...session, answered: true, attemptId: attempt.id } };
}
export function advance(progress: Progress): Progress {
  const session = progress.session;
  if (!session?.answered) return progress;
  return { ...progress, session: session.index + 1 < session.queue.length ? { ...session, index: session.index + 1, selected: [], answered: false, attemptId: undefined } : null };
}
export function statistics(progress: Progress, now = new Date()) {
  const first = firstAttempts(progress);
  const today = localDay(now);
  const days = new Set(progress.attempts.map(a => a.day));
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) { streak++; cursor = previousDay(cursor); }
  return { completed: first.length, accuracy: first.length ? Math.round(first.filter(a => a.correct).length / first.length * 100) : null,
    xp: progress.attempts.reduce((sum, a) => sum + a.xp, 0), streak,
    todayCount: new Set(progress.attempts.filter(a => a.day === today).map(a => a.questionId)).size,
    reviewCount: reviewQueue(progress).length,
  };
}
export function parseProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') throw new Error('Saved progress is not readable. Your data has not been overwritten.');
  const p = value as Progress;
  if (p.schema !== 1 || !Array.isArray(p.attempts) || !Number.isInteger(p.goal) || p.goal < 1 || p.goal > 30 || typeof p.lastMutation !== 'string') throw new Error('Saved progress uses an unsupported format. Your data has not been overwritten.');
  for (const a of p.attempts) {
    if (!a || typeof a.id !== 'string' || !a.id || typeof a.questionId !== 'string' || !a.questionId || !validSelection(a.selected) || !a.selected.length || typeof a.correct !== 'boolean' || !validDay(a.day) || typeof a.at !== 'string' || !Number.isFinite(Date.parse(a.at)) || ![0,5,10,20].includes(a.xp)) throw new Error('An answer record is not readable. Your data has not been overwritten.');
  }
  if (new Set(p.attempts.map(a=>a.id)).size !== p.attempts.length) throw new Error('Duplicate answer records found. Your data has not been overwritten.');
  if (p.session !== null) {
    const s = p.session;
    const fail = () => { throw new Error('The saved session is not readable. Your data has not been overwritten.'); };
    if (!s || typeof s.id !== 'string' || !s.id || !['all','sv','sva','uvm','cdc','arch','debug'].includes(s.topic) || !Array.isArray(s.queue) || !s.queue.every(id => typeof id === 'string' && id.length > 0) || new Set(s.queue).size !== s.queue.length || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length || !validSelection(s.selected) || typeof s.answered !== 'boolean' || !['new', 'review'].includes(s.mode)) fail();
    const q = questions.find(q=>q.id===s.queue[s.index]);
    if (q && (!validSelection(s.selected,q.options.length) || (q.correct.length===1 && s.selected.length>1))) fail();
    if (s.answered && !p.attempts.some(a=>a.id===s.attemptId && a.questionId===s.queue[s.index] && grade(a.selected,s.selected))) fail();
  }
  return p;
}
function validSelection(value: unknown, count = Infinity): value is number[] {
  return Array.isArray(value) && value.every(n=>Number.isInteger(n) && n>=0 && n<count) && new Set(value).size===value.length;
}
function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDay(date)===value;
}
