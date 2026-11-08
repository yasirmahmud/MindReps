# MindReps

A personal, mobile-first practice app for RTL, design verification, assertions, CDC/reset, microarchitecture, and protocol debugging. Includes 70 authored challenges: 10 written interview challenges with worked solutions and 60 legacy MCQs with reasoning for every answer choice.

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
- All new sessions, including topic sessions and **Start interview practice**, use written challenges. The 60 legacy MCQs remain available to saved sessions and historical review, preserving earlier progress. Save a draft explicitly, then commit and lock the original response before studying the solution. Unsaved drafts remain only in the current practice view; pending edits pause automatic background refresh and trigger a close-page warning.
- Written challenges teach fundamentals, work through a solution, correct common mistakes, and offer a changed-scenario follow-up. Compare the original answer with four essential rubric points, save a self-review, and optionally save a separate improved answer.
- Written responses are **self-assessed**, not automatically or AI graded. Missing rubric points keep an item in Review; checking every point clears it. Self-reviews count toward activity and XP, but are excluded from automatic first-try accuracy. This is a learning tool, not a certified interview-readiness test.
- Confirmed cloud saves, retry after failures, and revision checks to protect newer progress on another device.

The public website and question bank are retrievable by anyone. Authentication and database policies protect the owner's progress. Internet access is required for sign-in and cloud saving; offline use is not implemented.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Auth lifecycle, workspace, practice, review, and progress UI |
| `src/content.ts` | Stable question IDs, explanations, topics, references |
| `src/interviewContent.ts` | Original written interview problems, detailed lessons, rubrics, provenance, references |
| `src/InterviewPractice.tsx` | Commit, study, self-review, and rewrite flow |
| `src/domain.ts` | Grading, session transitions, XP, streaks, state validation |
| `src/cloud.ts` | Supabase RPCs, revisions, retry recognition |
| `src/config.ts` | Public configuration validation, shared with deployment |
| `src/*.test.*` | Domain, React lifecycle, cloud, configuration, database tests |
| `supabase/schema.sql` | Single-owner allowlist, RLS, versioned load/save RPCs |
| `.github/workflows/deploy.yml` | Test, validate configuration, build, publish Pages |

Keep existing question IDs stable when editing content. Retired questions retain their historical answers; an active session containing a retired question can be ended safely. Update the content tests when intentionally expanding the bank.

Interview provenance is stated per challenge. Public anonymous candidate reports support NVIDIA interview themes such as FIFO assertions, arbitration, and SystemVerilog; they do not authenticate these original problem statements or solutions. General DV extensions are labeled separately. Technical reading links are distinct from interview reports. No confidential question bank is used.

Written practice uses additive optional fields in the existing schema-1 snapshot. Old question IDs, option meanings, saved selections, and historical results are retained. Keep the latest app open when using written practice: an older frontend can ignore new optional fields but cannot display a newly added question, and may include self-reviews in its older accuracy display. No database migration is required.

## Validation limits

Automated tests exercise React using a simulated DOM, mock network failures/auth events, and execute the SQL using PGlite with simulated Supabase roles. They do not verify hosted Supabase Auth, mail delivery, or real cross-device networking. Complete the live acceptance steps in [SETUP.md](SETUP.md) after configuring your project.
