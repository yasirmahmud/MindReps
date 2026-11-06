// Shared by the browser and the deployment check. These values are public.
export function configurationError(rawUrl?: string, rawKey?: string): string {
  const url = rawUrl?.trim();
  const key = rawKey?.trim();
  if (!url || !key) return 'Set both public Supabase configuration values.';
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((!local && parsed.protocol !== 'https:') || (local && !['http:', 'https:'].includes(parsed.protocol)) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || /your-project/i.test(parsed.hostname)) return 'Use your Supabase project URL, such as https://PROJECT.supabase.co.';
  } catch { return 'Use a valid Supabase project URL.'; }
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !/your-publishable/i.test(key)) return '';
  // Older projects expose an anon JWT instead of a publishable key.
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    if (key.split('.').length === 3 && JSON.parse(atob(payload)).role === 'anon') return '';
  } catch { /* Invalid and privileged keys are rejected below. */ }
  return 'Use a Supabase publishable key or legacy anon key. Never use a secret or service-role key in the frontend.';
}
