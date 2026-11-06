# MindReps

A personal, mobile-first practice app for RTL, design verification, assertions, CDC/reset, microarchitecture, and protocol debugging. Includes 60 authored challenges with reasoning for every answer choice.

React + TypeScript + Vite, Supabase Auth/Postgres, and GitHub Pages. Questions are committed source content; no runtime AI or public signup.

## Run locally

Requires Node.js 22.18 or newer and npm.

```powershell
npm ci
npm test
npm run build
npm run dev -- --port 3000
```

Open [the local app](http://127.0.0.1:3000/). Without configuration, an explicitly labeled preview stores progress in memory for that visit only.

Follow [SETUP.md](SETUP.md) to create the Supabase owner account, enable email-link login (or optional email codes), configure cloud persistence, and deploy to GitHub Pages. Real cloud use requires that setup.

## Learning behavior

- Mixed or topic-specific sessions, saved selections, feedback, and resume.
- Review of questions whose latest attempt is incorrect.
- First-attempt accuracy, XP, daily goals, local-calendar streaks, activity, and JSON export.
- Confirmed cloud saves, retry after failures, and revision checks to protect newer progress on another device.

The public website and question bank are retrievable by anyone. Authentication and database policies protect the owner's progress. Internet access is required for sign-in and cloud saving; offline use is not implemented.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Auth lifecycle, workspace, practice, review, and progress UI |
| `src/content.ts` | Stable question IDs, explanations, topics, references |
| `src/domain.ts` | Grading, session transitions, XP, streaks, state validation |
| `src/cloud.ts` | Supabase RPCs, revisions, retry recognition |
| `src/config.ts` | Public configuration validation, shared with deployment |
| `src/*.test.*` | Domain, React lifecycle, cloud, configuration, database tests |
| `supabase/schema.sql` | Single-owner allowlist, RLS, versioned load/save RPCs |
| `.github/workflows/deploy.yml` | Test, validate configuration, build, publish Pages |

Keep existing question IDs stable when editing content. Retired questions retain their historical answers; an active session containing a retired question can be ended safely. Update the content tests when intentionally expanding the bank.

## Validation limits

Automated tests exercise React using a simulated DOM, mock network failures/auth events, and execute the SQL using PGlite with simulated Supabase roles. They do not verify hosted Supabase Auth, mail delivery, or real cross-device networking. Complete the live acceptance steps in [SETUP.md](SETUP.md) after configuring your project.
