import { configurationError } from '../src/config.ts';

const error = configurationError(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
if (error) { console.error(error); process.exitCode = 1; }
else console.log('Public Supabase configuration is valid.');
