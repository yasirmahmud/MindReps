import { describe, it, expect } from 'vitest';
import { questions, topics } from './content';
import { learningModules } from './learningModules';
import {
  assessInterview,
  reviseInterview,
  saveInterviewDraft,
  advance,
  answer,
  emptyProgress,
  firstAttempts,
  grade,
  localDay,
  newQueue,
  parseProgress,
  previousDay,
  rateAndCompleteModule,
  reviewQueue,
  setActiveModule,
  startSession,
  statistics,
  type Progress,
} from './domain';

const at = (day: string) => new Date(`${day}T12:00:00`);

function submit(p: Progress, selected: number[], day = '2026-11-06') {
  if (!p.session) throw Error('test requires session');
  return answer({ ...p, session: { ...p.session, selected } }, at(day));
}

describe('question bank integrity', () => {
  it('has 70 unique complete questions, including ten written interview challenges', () => {
    expect(questions).toHaveLength(70);
    expect(new Set(questions.map(q => q.id)).size).toBe(70);
    const counts = { sv: 12, sva: 12, uvm: 12, cdc: 12, arch: 11, debug: 11 };
    for (const t of topics) expect(questions.filter(q => q.topic === t.id)).toHaveLength(counts[t.id]);
    expect(questions.filter(q => q.interview)).toHaveLength(10);
    for (const q of questions) {
      expect(q.correct.length).toBeGreaterThan(0);
      expect(q.correct.length).toBeLessThan(q.options.length);
      expect(new Set(q.correct).size).toBe(q.correct.length);
      expect(q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)).toBe(true);
      expect(q.options.every(o => o.text.trim().length > 0 && o.why.length > 15)).toBe(true);
      expect(q.lesson.length).toBeGreaterThan(40);
    }
  });

  it('matches hand-traced RTL numerical results', () => {
    const expected: Record<string, string> = {
      'sv-01': 'a = 0, b = 1',
      'sv-02': '0',
      'sv-05': "8'h00",
      'sv-09': "16'h0080",
      'arch-02': '3',
      'debug-04': '4 beats, 4 bytes per beat',
    };
    for (const [id, text] of Object.entries(expected)) {
      const q = questions.find(q => q.id === id)!;
      expect(q.correct.map(i => q.options[i].text)).toEqual([text]);
    }
  });
});

describe('NVIDIA design verification learning modules bank', () => {
  it('contains 10 comprehensive advanced learning modules across all 6 verification disciplines', () => {
    expect(learningModules.length).toBe(10);
    const moduleTopics = new Set(learningModules.map(m => m.topic));
    expect(moduleTopics.size).toBe(6);

    for (const mod of learningModules) {
      expect(mod.id).toMatch(/^mod-/);
      expect(mod.title.length).toBeGreaterThan(15);
      expect(mod.subtitle.length).toBeGreaterThan(20);
      expect(mod.summary.length).toBeGreaterThan(40);
      expect(mod.estimatedMinutes).toBeGreaterThanOrEqual(15);
      expect(mod.keyConcepts.length).toBeGreaterThanOrEqual(3);
      expect(mod.sections.length).toBeGreaterThanOrEqual(2);
      expect(mod.interactiveType).toBeDefined();
      expect(mod.interactiveInstructions.length).toBeGreaterThan(30);
      expect(mod.nvidiaRelevance.interviewContext.length).toBeGreaterThan(30);
      expect(mod.nvidiaRelevance.keyQuestionsAsked.length).toBeGreaterThanOrEqual(2);
      expect(mod.references.length).toBeGreaterThanOrEqual(1);

      for (const sec of mod.sections) {
        expect(sec.title.length).toBeGreaterThan(5);
        expect(sec.content.length).toBeGreaterThan(50);
        if (sec.code) {
          expect(sec.code.length).toBeGreaterThan(30);
        }
      }
    }
  });
});

describe('learning module scoring and knowledge evaluation', () => {
  it('records module quality score, depth, visuals, tags, and topic knowledge', () => {
    const p = emptyProgress();
    const evaluated = rateAndCompleteModule(
      p,
      'mod-sv-queue',
      {
        qualityScore: 5,
        depthRating: 'advanced_thorough',
        visualRating: 'exceptional',
        knowsTopic: 'mastered',
        confidence: 'high',
        notes: 'The delta-cycle waveform stepper made the NBA race clear.',
        tags: ['Replicate this interactive visualizer', 'High NVIDIA interview relevance'],
      },
      at('2026-11-06')
    );

    expect(evaluated.completedModules).toContain('mod-sv-queue');
    const rating = evaluated.moduleRatings['mod-sv-queue'];
    expect(rating).toBeDefined();
    expect(rating.qualityScore).toBe(5);
    expect(rating.knowsTopic).toBe('mastered');
    expect(rating.depthRating).toBe('advanced_thorough');
    expect(rating.visualRating).toBe('exceptional');
    expect(rating.tags).toContain('Replicate this interactive visualizer');

    // Attempt logged with XP (+20 completion + 10 feedback bonus = 30)
    expect(evaluated.attempts).toHaveLength(1);
    expect(evaluated.attempts[0].xp).toBe(30);
    expect(evaluated.attempts[0].correct).toBe(true);

    const stats = statistics(evaluated, at('2026-11-06'));
    expect(stats.masteredCount).toBe(1);
    expect(stats.completedModulesCount).toBe(1);
    expect(stats.averageQuality).toBe(5);
    expect(stats.highQualityCount).toBe(1);
    expect(stats.needsImprovementCount).toBe(0);
  });

  it('rejects invalid quality scores outside 1 to 5 range', () => {
    const p = emptyProgress();
    expect(() =>
      rateAndCompleteModule(p, 'mod-sv-queue', {
        qualityScore: 6,
        depthRating: 'balanced',
        visualRating: 'helpful',
        knowsTopic: 'mastered',
        confidence: 'high',
      })
    ).toThrow(/between 1 and 5/);

    expect(() =>
      rateAndCompleteModule(p, 'mod-sv-queue', {
        qualityScore: 0,
        depthRating: 'balanced',
        visualRating: 'helpful',
        knowsTopic: 'not_known',
        confidence: 'low',
      })
    ).toThrow(/between 1 and 5/);
  });

  it('serializes and parses module ratings and completed modules correctly through parseProgress', () => {
    let p = rateAndCompleteModule(
      emptyProgress(),
      'mod-sva-fifo',
      {
        qualityScore: 4,
        depthRating: 'balanced',
        visualRating: 'helpful',
        knowsTopic: 'partially',
        confidence: 'medium',
        notes: 'Needs more formal proofs.',
        tags: ['Great edge-case analysis'],
      },
      at('2026-11-06')
    );

    const json = JSON.parse(JSON.stringify(p));
    const parsed = parseProgress(json);
    expect(parsed.completedModules).toEqual(['mod-sva-fifo']);
    expect(parsed.moduleRatings['mod-sva-fifo']).toMatchObject({
      qualityScore: 4,
      knowsTopic: 'partially',
      visualRating: 'helpful',
      notes: 'Needs more formal proofs.',
    });
  });
});

describe('written interview practice', () => {
  const start = () => startSession(emptyProgress(), 'new', 'all', 'interview');

  it('creates a written-only queue and preserves an existing legacy session', () => {
    const p = start();
    expect(p.session?.queue).toHaveLength(10);
    expect(p.session?.queue.every(id => questions.find(q => q.id === id)?.interview)).toBe(true);
    const legacy = startSession(emptyProgress(), 'new');
    expect(startSession(legacy, 'new', 'all', 'interview')).toBe(legacy);
  });

  it('locks a nonempty original response before rubric assessment and rejects the MCQ path', () => {
    const p = start();
    expect(() => saveInterviewDraft(p, '  ', true)).toThrow();
    expect(() => assessInterview(p, [0, 1, 2, 3])).toThrow();
    expect(() => answer({ ...p, session: { ...p.session!, selected: [1] } })).toThrow(/written response/);
    const draft = saveInterviewDraft(p, 'Trace, code, and assumptions.');
    expect(parseProgress(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    const revealed = saveInterviewDraft(draft, draft.session!.response!, true);
    expect(saveInterviewDraft(revealed, 'Replace the original')).toBe(revealed);
    expect(parseProgress(JSON.parse(JSON.stringify(revealed)))).toEqual(revealed);
  });

  it('records a failed self-review even with zero rubric points, and retains a separate rewrite', () => {
    let p = saveInterviewDraft(start(), 'My original attempt', true);
    p = assessInterview(p, [], at('2026-11-06'));
    expect(p.attempts[0]).toMatchObject({
      correct: false,
      selected: [0],
      assessment: 'self',
      response: 'My original attempt',
      rubric: [],
      xp: 5,
    });
    expect(reviewQueue(p)).toEqual([p.session!.queue[0]]);
    expect(assessInterview(p, [0, 1, 2, 3])).toBe(p);
    p = reviseInterview(p, 'A stronger explanation');
    expect(p.attempts[0]).toMatchObject({
      response: 'My original attempt',
      revision: 'A stronger explanation',
      correct: false,
    });
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const next = advance(p);
    expect(next.session?.response).toBeUndefined();
    expect(next.session?.solutionRevealed).toBeUndefined();
  });

  it('requires all rubric points, separates automatic accuracy, and preserves one-time recovery XP', () => {
    let p = assessInterview(saveInterviewDraft(start(), 'First response', true), [0, 1, 2], at('2026-11-06'));
    expect(statistics(p, at('2026-11-06'))).toMatchObject({ accuracy: null, selfAssessed: 1, completed: 1 });
    p = startSession({ ...p, session: null }, 'review');
    p = assessInterview(saveInterviewDraft(p, 'Complete retry response', true), [3, 2, 1, 0], at('2026-11-06'));
    expect(p.attempts.at(-1)?.xp).toBe(10);
    expect(reviewQueue(p)).toEqual([]);
    p = startSession({ ...p, session: null }, 'new', 'sv');
    p = submit(p, [1]);
    expect(statistics(p, at('2026-11-06'))).toMatchObject({ accuracy: 100, selfAssessed: 1, completed: 2, xp: 35 });
  });

  it('rejects malformed rubric, oversized responses, and inconsistent persisted assessments', () => {
    const p = saveInterviewDraft(start(), 'Original', true);
    for (const rubric of [[0, 0], [4], [-1]]) expect(() => assessInterview(p, rubric)).toThrow();
    expect(() => saveInterviewDraft(start(), 'a'.repeat(12001))).toThrow();
    const graded = assessInterview(p, [0, 1, 2, 3]);
    expect(() => parseProgress({ ...graded, attempts: [{ ...graded.attempts[0], correct: false }] })).toThrow(
      /not been overwritten/
    );
    expect(() => parseProgress({ ...graded, session: { ...graded.session, response: 'changed' } })).toThrow(
      /not been overwritten/
    );
  });

  it('independently checks the authored pointer arithmetic and arbitration traces', () => {
    const gray = (n: number) => n ^ (n >>> 1);
    expect(gray(8)).toBe(0b1100);
    for (let r = 0; r < 16; r++) expect(gray((r + 8) % 16)).toBe(gray(r) ^ 0b1100);
    expect(gray(7)).toBe(0b0100);
  });
});

describe('learning progression', () => {
  it('requires an exact set for multi-answer questions, without duplicates', () => {
    const q = questions.find(q => q.id === 'sv-06')!;
    expect(q.correct).toEqual([0, 1]);
    expect(grade([0, 1], q.correct)).toBe(true);
    expect(grade([1, 0], q.correct)).toBe(true);
    expect(grade([0], q.correct)).toBe(false);
    expect(grade([0, 1, 2], q.correct)).toBe(false);
    expect(grade([0, 0], q.correct)).toBe(false);
  });

  it('interleaves mixed topics and excludes completed questions from new sessions', () => {
    const p = startSession(emptyProgress(), 'new');
    expect(p.session?.queue).toHaveLength(10);
    expect(p.session?.queue[0]).toBe('sv-01');
    expect(p.session?.queue[1]).toBe('sva-01');
    expect(newQueue({ ...p, attempts: [{ id: '1', questionId: 'sv-01', selected: [1], correct: true, at: '2026-11-06T12:00:00Z', day: '2026-11-06', xp: 20 }] })[0]).toBe('sva-01');
  });

  it('never advances or records an empty answer', () => {
    const p = startSession(emptyProgress(), 'new');
    expect(answer(p)).toBe(p);
    expect(advance(p)).toBe(p);
    expect(p.attempts).toEqual([]);
  });

  it('cannot submit an answered question twice', () => {
    const p = submit(startSession(emptyProgress(), 'new'), [1]);
    expect(answer(p)).toBe(p);
    expect(p.attempts).toHaveLength(1);
  });

  it('keeps first-attempt accuracy independent of successful review', () => {
    let p = submit(startSession(emptyProgress(), 'new', 'sv'), [0]);
    expect(reviewQueue(p)).toEqual(['sv-01']);
    expect(statistics(p, at('2026-11-06')).xp).toBe(5);
    p = { ...p, session: null };
    p = submit(startSession(p, 'review'), [1]);
    expect(reviewQueue(p)).toEqual([]);
    expect(statistics(p, at('2026-11-06'))).toMatchObject({ accuracy: 0, completed: 1, xp: 15, todayCount: 1 });
  });

  it('finishes the session and preserves answers and XP', () => {
    let p = startSession({ ...emptyProgress(), goal: 1 }, 'new');
    p = submit(p, [1]);
    p = advance(p);
    expect(p.session).toBeNull();
    expect(p.attempts[0].xp).toBe(20);
    expect(statistics(p, at('2026-11-06')).xp).toBe(20);
  });

  it('round-trips selected choices and feedback through JSON', () => {
    const p = submit(startSession(emptyProgress(), 'new'), [1]);
    const restored = parseProgress(JSON.parse(JSON.stringify(p)));
    expect(restored).toEqual(p);
  });

  it('rejects malformed cloud state instead of wiping it', () => {
    expect(() => parseProgress(null)).toThrow(/not been overwritten/);
    expect(() => parseProgress({ schema: 2 })).toThrow(/not been overwritten/);
    expect(() => parseProgress({ ...emptyProgress(), attempts: [{}] })).toThrow(/not been overwritten/);
    expect(() => parseProgress({ ...emptyProgress(), session: { queue: ['sv-01'] } })).toThrow(/not been overwritten/);
  });

  it('rejects invalid dates, null answers, duplicate IDs and inconsistent feedback', () => {
    const p = submit(startSession(emptyProgress(), 'new'), [1]);
    const badDate = { ...p, attempts: [{ ...p.attempts[0], day: '2026-02-31' }] };
    expect(() => parseProgress(badDate)).toThrow(/not readable/);
    const dup = { ...p, attempts: [p.attempts[0], { ...p.attempts[0] }] };
    expect(() => parseProgress(dup)).toThrow(/Duplicate answer/);
    const unselected = { ...p, session: { ...p.session!, selected: [] } };
    expect(() => parseProgress(unselected)).toThrow(/not readable/);
  });

  it('correctly parses historical cloud payloads containing module assessments and sessions', () => {
    const rawPayload = {
      goal: 10,
      schema: 1,
      session: {
        id: '61b9284a-ae85-46fd-8656-fd2c6d187713',
        mode: 'new',
        index: 0,
        queue: ['sv-11', 'sva-11', 'uvm-11', 'cdc-11', 'arch-11', 'debug-11', 'sv-12', 'sva-12', 'uvm-12', 'cdc-12'],
        topic: 'all',
        answered: false,
        response: 'aa',
        selected: [],
        solutionRevealed: true,
      },
      attempts: [
        { at: '2026-11-06T08:29:01.957Z', id: '135a88e5-726a-46e6-8076-6fe62ca127e2', xp: 20, day: '2026-11-06', correct: true, selected: [1], questionId: 'sv-01' },
        { at: '2026-11-09T07:03:30.725Z', id: '2533e6d3-2ba7-4bfe-b3a2-7efd962146d6', xp: 20, day: '2026-11-09', correct: true, selected: [5], assessment: 'module', knowsTopic: 'mastered', questionId: 'mod-sv-queue', qualityScore: 5 },
      ],
      lastMutation: '7e76eb32-9d11-4d30-92a8-f02985626f8e',
      moduleRatings: {
        'mod-sv-queue': {
          tags: ['Replicate this interactive visualizer', 'High NVIDIA interview relevance'],
          ratedAt: '2026-11-09T07:03:30.725Z',
          moduleId: 'mod-sv-queue',
          confidence: 'high',
          knowsTopic: 'mastered',
          depthRating: 'advanced_thorough',
          qualityScore: 5,
          visualRating: 'exceptional',
        },
      },
      activeModuleId: 'mod-sv-queue',
      completedModules: ['mod-sv-queue'],
    };
    const parsed = parseProgress(rawPayload);
    expect(parsed.schema).toBe(1);
    expect(parsed.attempts.length).toBe(2);
    expect(parsed.completedModules).toEqual(['mod-sv-queue']);
  });

  it('preserves an active session and rejects invalid answer indices', () => {
    const p = startSession(emptyProgress(), 'new', 'sv');
    expect(startSession(p, 'review')).toBe(p);
    expect(() => submit(p, [-1])).toThrow(/valid answer/);
    expect(() => submit(p, [1, 1])).toThrow(/valid answer/);
  });

  it('returns no new session if the bank is exhausted', () => {
    const p = {
      ...emptyProgress(),
      attempts: questions.map(q => ({
        id: q.id,
        questionId: q.id,
        selected: q.correct,
        correct: true,
        at: '2026-11-06T12:00:00Z',
        day: '2026-11-06',
        xp: 20,
      })),
    };
    expect(newQueue(p)).toEqual([]);
    expect(startSession(p, 'new')).toBe(p);
  });
});

describe('daily progress across calendar boundaries', () => {
  const make = (days: string[]) => ({
    ...emptyProgress(),
    attempts: days.map((day, i) => ({
      id: String(i),
      questionId: 'sv-01',
      selected: [1],
      correct: true,
      at: at(day).toISOString(),
      day,
      xp: 0,
    })),
  });

  it('keeps yesterday’s streak alive before the first answer today', () => {
    expect(statistics(make(['2026-11-04', '2026-11-05']), at('2026-11-06')).streak).toBe(2);
    expect(statistics(make(['2026-11-04']), at('2026-11-06')).streak).toBe(0);
  });

  it('does not count repeated answers to one question more than once daily', () => {
    expect(statistics(make(['2026-11-06', '2026-11-06']), at('2026-11-06'))).toMatchObject({
      todayCount: 1,
      streak: 1,
    });
  });

  it('handles month, leap-year, and daylight-saving boundaries by calendar date', () => {
    expect(previousDay('2026-03-09')).toBe('2026-03-08');
    expect(previousDay('2026-11-02')).toBe('2026-11-01');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(localDay(at('2026-11-06'))).toBe('2026-11-06');
    const leapDay = {
      ...emptyProgress(),
      attempts: [
        {
          id: '1',
          questionId: 'sv-01',
          selected: [1],
          correct: true,
          at: '2024-02-29T12:00:00Z',
          day: '2024-02-29',
          xp: 20,
        },
      ],
    };
    expect(statistics(leapDay, at('2024-03-01')).streak).toBe(1);
  });
});
