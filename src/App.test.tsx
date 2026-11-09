// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { emptyProgress } from './domain';
import type { CloudRecord } from './cloud';
import { learningModules } from './learningModules';

const cloud = vi.hoisted(() => ({
  configured: true,
  setupError: '',
  loadProgress: vi.fn(),
  saveProgress: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('./cloud', () => ({
  ...cloud,
  get configured() {
    return cloud.configured;
  },
  supabase: {
    auth: {
      getSession: cloud.getSession,
      onAuthStateChange: cloud.onAuthStateChange,
      signOut: cloud.signOut,
      signInWithOtp: cloud.signInWithOtp,
      verifyOtp: cloud.verifyOtp,
    },
  },
}));

import { App } from './App';

const account = (id: string) => ({ user: { id } } as Session);
const row = (goal = 2): CloudRecord => ({
  revision: 0,
  payload: { ...emptyProgress(), goal },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let root: Root;
let host: HTMLDivElement;
let authEvent: (event: string, session: Session | null) => void;

async function render() {
  await act(async () => {
    root.render(<App />);
  });
}

function button(text: string, selector = 'button') {
  const result = [...host.querySelectorAll<HTMLButtonElement>(selector)].find(
    b => b.textContent?.includes(text) || b.getAttribute('aria-label')?.includes(text)
  );
  if (!result) throw Error(`Missing button: ${text}`);
  return result;
}

async function click(text: string, selector?: string) {
  await act(async () => {
    button(text, selector).click();
  });
}

async function emit(session: Session | null) {
  await act(async () => {
    authEvent(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  });
}

async function fill(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      value
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submitForm() {
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  cloud.configured = true;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  cloud.getSession.mockResolvedValue({ data: { session: account('a') }, error: null });
  cloud.onAuthStateChange.mockImplementation(callback => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe: cloud.unsubscribe } } };
  });
  cloud.loadProgress.mockResolvedValue(row());
  cloud.signInWithOtp.mockResolvedValue({ error: null });
  cloud.verifyOtp.mockResolvedValue({ error: null });
  cloud.saveProgress.mockImplementation(async (previous: CloudRecord, payload) => ({
    revision: previous.revision + 1,
    payload,
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('workspace auth and learning modules lifecycle', () => {
  it('opens learning lab overview and navigates to the active learning module studio', async () => {
    await render();
    expect(host.textContent).toContain('Welcome to your DV studio');
    expect(host.textContent).toContain('NVIDIA DESIGN VERIFICATION TRACK');
    // Ensure no old question answer options exist
    expect(host.querySelector('.answer-options')).toBeNull();

    await click('Explore Active Module');
    expect(host.textContent).toContain('NVIDIA DESIGN VERIFICATION LEARNING MODULE');
    expect(host.textContent).toContain('Queue Occupancy & Nonblocking Delta-Cycle Dynamics');
    expect(host.textContent).toContain('Interactive Visualizer & Lab');

    // Test stepping in the interactive visualizer
    await click('Clock Step');
    expect(host.textContent).toContain('Cycle 1');
  });

  it('completes a module, scores quality, evaluates topic knowledge, and saves to cloud', async () => {
    await render();
    await click('Explore Active Module');

    // Open module evaluation modal
    await click('Complete & Score Module');
    expect(host.textContent).toContain('Evaluate Module:');
    expect(host.textContent).toContain('Question 1: How would you rate the quality of this learning module?');
    expect(host.textContent).toContain('Question 2: Do you know this topic?');

    // Click 5 stars
    const starBtns = host.querySelectorAll<HTMLButtonElement>('.star-btn');
    expect(starBtns.length).toBe(5);
    await act(async () => starBtns[4].click());

    // Select topic knowledge: Mastered
    await click('Mastered / Proficient');

    // Submit evaluation
    await click('Save Evaluation & Update Knowledge Map');

    // Verify cloud save occurred with moduleRatings and completedModules
    const saved = cloud.saveProgress.mock.calls.at(-1)![1];
    expect(saved.completedModules).toContain('mod-sv-queue');
    expect(saved.moduleRatings['mod-sv-queue']).toBeDefined();
    expect(saved.moduleRatings['mod-sv-queue'].qualityScore).toBe(5);
    expect(saved.moduleRatings['mod-sv-queue'].knowsTopic).toBe('mastered');
    expect(saved.attempts.length).toBeGreaterThanOrEqual(1);
  });

  it('browses the modules catalog, filters by discipline, and launches selected module', async () => {
    await render();
    await click('Modules', '.sidebar button');
    expect(host.textContent).toContain('NVIDIA DV Learning Modules');
    expect(host.textContent).toContain('All Disciplines (10)');

    // Filter by Assertions
    await click('Assertions', '.topic-filter-btn');
    expect(host.textContent).toContain('Formal & Dynamic SVA Assertions for High-Throughput FIFOs');
    expect(host.textContent).not.toContain('Gray-Coded Asynchronous CDC FIFO');

    // Launch SVA module
    await click('Start Module', '.module-card button');
    expect(host.textContent).toContain('Formal & Dynamic SVA Assertions for High-Throughput FIFOs');
    expect(host.textContent).toContain('FIFO SVA Property Evaluator & Vacuity Monitor');
  });

  it('displays the user knowledge map with topic mastery breakdown', async () => {
    // Seed with a mastered module
    const progressWithMastery = {
      ...emptyProgress(),
      completedModules: ['mod-sv-queue'],
      moduleRatings: {
        'mod-sv-queue': {
          moduleId: 'mod-sv-queue',
          qualityScore: 5,
          depthRating: 'advanced_thorough' as const,
          visualRating: 'exceptional' as const,
          knowsTopic: 'mastered' as const,
          confidence: 'high' as const,
          tags: ['Replicate this interactive visualizer'],
          ratedAt: new Date().toISOString(),
        },
      },
    };
    cloud.loadProgress.mockResolvedValue({ revision: 1, payload: progressWithMastery });

    await render();
    await click('Knowledge Map', '.sidebar button');
    expect(host.textContent).toContain('NVIDIA DV Knowledge Map');
    expect(host.textContent).toContain('1 of 10 topics mastered');
    expect(host.textContent).toContain('Core Verification Pillars');
  });

  it('displays quality insights, high-rated modules, and copies generation brief', async () => {
    const progressWithFeedback = {
      ...emptyProgress(),
      completedModules: ['mod-sv-queue'],
      moduleRatings: {
        'mod-sv-queue': {
          moduleId: 'mod-sv-queue',
          qualityScore: 5,
          depthRating: 'advanced_thorough' as const,
          visualRating: 'exceptional' as const,
          knowsTopic: 'mastered' as const,
          confidence: 'high' as const,
          notes: 'Outstanding waveform stepper!',
          tags: ['Replicate this interactive visualizer'],
          ratedAt: new Date().toISOString(),
        },
      },
    };
    cloud.loadProgress.mockResolvedValue({ revision: 2, payload: progressWithFeedback });

    await render();
    await click('Quality Insights', '.sidebar button');
    expect(host.textContent).toContain('Module Quality & Generation Insights');
    expect(host.textContent).toContain('High-Quality Modules to Replicate');
    expect(host.textContent).toContain('Outstanding waveform stepper!');

    // Test brief copy
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
    await click('Copy Generation Brief');
    expect(writeTextMock).toHaveBeenCalled();
    expect(writeTextMock.mock.calls[0][0]).toContain('MINDREPS MODULE GENERATION BRIEF');
  });

  it('requests an email sign-in link and handles sign-out', async () => {
    cloud.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await render();
    await fill('email', 'owner@example.com');
    await submitForm();
    expect(cloud.signInWithOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    expect(host.textContent).toContain('Open the sign-in link in your email');

    await emit(account('a'));
    expect(host.textContent).toContain('Welcome to your DV studio');

    // Sign out
    await click('Sign out', '.sidebar button.profile');
    expect(cloud.signOut).toHaveBeenCalled();
  });

  it('supports interactive preview mode without saving to cloud', async () => {
    cloud.configured = false;
    cloud.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await render();
    await click('Explore the interactive preview');
    expect(host.textContent).toContain('Preview mode');
    expect(host.textContent).toContain('Welcome to your DV studio');

    await click('Explore Active Module');
    expect(host.textContent).toContain('Queue Occupancy & Nonblocking Delta-Cycle Dynamics');
    expect(cloud.saveProgress).not.toHaveBeenCalled();
  });

  it('offers a retry when initial session retrieval rejects', async () => {
    cloud.getSession.mockRejectedValueOnce(Error('Auth unavailable'));
    await render();
    expect(host.textContent).toContain('Auth unavailable');
    await click('Retry sign-in connection');
    expect(host.textContent).toContain('Welcome to your DV studio');
  });

  it('clears progress on account changes and loads fresh record', async () => {
    const old = deferred<CloudRecord>();
    const next = deferred<CloudRecord>();
    cloud.loadProgress.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await render();
    await emit(account('b'));
    await act(async () => {
      old.resolve(row(5));
    });
    expect(host.textContent).not.toContain('Welcome to your DV studio');
    await act(async () => {
      next.resolve(row(2));
    });
    expect(host.querySelector('.goal-ring')?.textContent).toContain('/2');
    expect(cloud.loadProgress).toHaveBeenCalledTimes(2);
  });
});
