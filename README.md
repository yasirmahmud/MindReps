# MindReps

A personal, mobile-first interactive learning lab for RTL, design verification (DV), assertions, CDC/reset, microarchitecture, and protocol debugging. 

Pivoted completely from MCQs to **Interactive, Graphical Learning Modules** covering advanced NVIDIA Design Verification engineering topics, complete with end-of-module quality scoring and user knowledge map tracking.

React + TypeScript + Vite, Supabase Auth/Postgres, and GitHub Pages. Learning modules and graphical visualizers are committed source content; no runtime AI or public signup.

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

## Learning Architecture

- **Browse & Learn Modules**: 10 authored advanced learning modules covering core NVIDIA Design Verification topics across 6 disciplines: SystemVerilog & RTL scheduling, SVA assertions & formal, UVM verification strategy, CDC & reset, high-performance microarchitecture, and memory protocols.
- **Interactive Graphical Visualizers**: Every module features a custom interactive laboratory:
  - *Delta-Cycle & Nonblocking Scheduler Lab*: Step clock cycles and compare buggy sequential updates against golden single-assignment RTL with graphical waveforms.
  - *OOP Concurrency & Memory Inspector*: Step through `fork..join_none` threads to visualize stack handles vs heap memory aliasing.
  - *FIFO SVA Property & Vacuity Monitor*: Test concurrent assertion evaluation in the Preponed region and monitor vacuous vs exercised implication passes.
  - *Valid/Ready Handshake Simulator*: Toggle producer valid and consumer backpressure, with automated stability assertion checks.
  - *Asynchronous CDC Dual-Flop Gray Pointer Synchronizer*: Step write and read clock domains, with simulated bus skew hazard injection.
  - *Reset Recovery & Removal Timing Simulator*: Slide reset deassertion relative to clock edges to visualize the forbidden metastability window.
  - *Rotating Priority Round-Robin Arbiter*: Toggle 4 client requests and step rotating token rings with starvation tracking.
  - *NVLink/PCIe Credit-Based Flow Simulator*: Transmit flits across 4-stage pipelines, process buffers, and evaluate credit conservation in real time.
  - *UVM Phasing & Objection Lifecycle*: Raise/drop objections and adjust drain times to prevent premature test shutdown.
  - *MESI Cache Coherence Protocol*: Simulate Core 0/1 reads, writes, and snoop invalidations across shared memory.
- **End-of-Module Scoring & Self-Knowledge Assessment**:
  - *Question 1 (Module Quality)*: Rate 1–5 stars, evaluate technical depth, visual utility, winning tags, and qualitative replication notes.
  - *Question 2 (Topic Knowledge)*: Assess mastery level (Mastered / Partially Understood / Still Learning) and confidence.
- **User Knowledge Map**:
  - Dynamically computes mastery percentages across all 6 verification disciplines.
  - Visual status dots and pills (Mastered, Needs Review, Unexplored).
  - Personalized roadmap recommending the next modules to solidify.
- **Quality Insights & Module Generation Studio**:
  - Aggregates user feedback to identify high-rated winning module formats to replicate.
  - Flags low-rated modules needing technical depth or diagram improvements.
  - Exports a structured **AI Generation Brief** to generate new modules matching the user's exact preferences and knowledge gaps.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Main workspace shell, routing across Overview, Modules, Studio, Knowledge Map, and Insights |
| `src/learningModules.ts` | 10 comprehensive NVIDIA DV learning modules, key concepts, deep-dive sections, and references |
| `src/InteractiveVisualizers.tsx` | 10 custom interactive graphical simulators and waveform tools |
| `src/ModuleViewer.tsx` | Interactive studio, tabbed breakdowns, code with copy buttons, and evaluation modal |
| `src/ModulesCatalog.tsx` | Filterable, searchable catalog of advanced verification modules |
| `src/KnowledgeMap.tsx` | Visual mastery profile, domain breakdown, and personalized roadmap |
| `src/QualityInsights.tsx` | Analysis of module quality ratings, replication patterns, and AI brief generator |
| `src/domain.ts` | Learning module rating, state transitions, streaks, XP, schema-1 validation |
| `src/cloud.ts` | Supabase RPCs, revisions, retry recognition |
| `src/config.ts` | Public configuration validation, shared with deployment |
| `src/*.test.*` | Domain, React lifecycle, cloud, configuration, database tests |
| `supabase/schema.sql` | Single-owner allowlist, RLS, versioned load/save RPCs |
| `.github/workflows/deploy.yml` | Test, validate configuration, build, publish Pages |

## Validation limits

Automated tests exercise React using a simulated DOM, mock network failures/auth events, and execute the SQL using PGlite with simulated Supabase roles. Live acceptance steps in [SETUP.md](SETUP.md) test hosted Supabase Auth and cross-device syncing.
