import { createClient } from '@supabase/supabase-js';
import { emptyProgress, parseProgress, type Progress } from './domain';
import { configurationError } from './config';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const setupError = configurationError(url, key);
export const configured = !setupError;
export const supabase = configured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export type CloudRecord = { revision: number; payload: Progress };
function readRow(data: unknown): CloudRecord {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object' || !('revision' in row) || !('payload' in row)) throw new Error('No progress returned. Check the database setup and authorized owner.');
  const revision = typeof row.revision === 'number' || (typeof row.revision === 'string' && /^\d+$/.test(row.revision)) ? Number(row.revision) : NaN;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('The cloud revision is not readable. Your data has not been overwritten.');
  return { revision, payload: parseProgress(row.payload) };
}
export async function loadProgress(): Promise<CloudRecord> {
  if (!supabase) throw new Error('Connect Supabase to save progress.');
  const { data, error } = await supabase.rpc('load_progress', { initial_payload: emptyProgress() });
  if (error) throw new Error(error.message);
  return readRow(data);
}
export async function saveProgress(record: CloudRecord, payload: Progress): Promise<CloudRecord> {
  if (!supabase) throw new Error('Connect Supabase to save progress.');
  const { data, error } = await supabase.rpc('save_progress', { expected_revision: record.revision, next_payload: payload });
  if (error) {
    // A response can be lost after a successful commit. Recognize the mutation on retry.
    if (error.code === '40001') {
      const latest = await loadProgress();
      if (latest.payload.lastMutation === payload.lastMutation) return latest;
      throw new Error('Progress changed on another device. Reload cloud progress before continuing. Your newer cloud data has been preserved.');
    }
    throw new Error(`Could not save: ${error.message}`);
  }
  return readRow(data);
}
