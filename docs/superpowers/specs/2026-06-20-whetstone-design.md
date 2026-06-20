# Project Whetstone — MVP Design Spec

**Date:** 2026-06-20
**Status:** Approved for build (working prototype)

## Vision

A daily ~5-minute "gym" for the mental muscles that erode under heavy LLM use. A library of cognitive *reps*, unified by a **Cognitive Score**, with a **Skill Decay Tracker** planned for v2 as the personalization spine.

Guiding principle: **AI as a Socratic sparring partner = augmentation; AI as a black-box oracle = atrophy.** Every exercise forces the user to produce/verify before the AI assists.

## Decisions (from brainstorm)

- **Audience:** knowledge workers / professionals concerned about AI skill erosion.
- **Platform:** web app / PWA first, mobile-responsive.
- **Storage:** local-first (browser). Account only needed for paid tier / sync (deferred).
- **AI backend:** dual — **BYOK** (user supplies Anthropic key; calls from browser) is the functional path in the prototype; a **paid tier** (single-digit $/month, server provides the model) is surfaced in-app but stubbed (needs a backend, deferred).
- **Model:** Claude Haiku (cost-appropriate for the rubric/challenge generation).
- **Rigid system prompts:** the AI's job is to generate a challenge / critique / gap-report, never to hand over the answer.

## MVP exercises (3)

1. **Spar** (Socratic reasoning). User commits an argument on a daily claim *before* AI unlocks → AI adversary challenges with questions/counters only (never answers) for ~3 rounds → AI scores rigor / evidence / counter-arguments (0–10) and names the weakest link. Dark "ring" theme.
2. **Read-and-Retain** (comprehension/retention). User pastes an article/text → AI produces a summary with key terms/data **redacted** → user must answer a conceptual micro-challenge to unlock the clean summary. Fights the "illusion of competence."
3. **Counter-Prompting** (verification). AI presents an answer containing a subtle flaw (logical/factual/syntax) → user races a timer to spot it and rewrite the prompt/correction → AI judges whether they caught it. Gamified skepticism.

## Spine

- **Cognitive Score:** a single number that rises with rigor, retention accuracy, and errors caught — and with consistency (streak). Shown on the Today hub. Stored locally; updated after each rep.
- **Today hub:** daily ring (reps done / due), per-exercise status cards (tap to start), streak, Cognitive Score. Light theme.
- **Settings:** AI mode (BYOK key entry vs. paid tier stub), reduced-motion respect, data reset.

## Tech stack

- **Vite + React + TypeScript** SPA (satisfies the "React" note; lighter than Next.js for a local-first BYOK prototype with no required server).
- **PWA** (manifest + service worker, installable, offline shell).
- **State:** local-first store (Zustand or React context + `localStorage`), typed.
- **AI client:** `@anthropic-ai/sdk` (or fetch) to Claude Haiku, BYOK; prompt-cached system prompts; graceful error/empty/loading states.
- **Design system:** port the mockup's tokens (petrol/coral/mist, Space Grotesk + Inter + Space Mono), Spar dark / others light.

## Architecture / components

- `app shell` — tab/route nav (Today, Spar, Read-and-Retain, Counter-Prompting, Settings).
- `store/` — cognitiveScore, streak, per-exercise history, settings, AI mode + key. Persisted to localStorage.
- `ai/` — typed client + one rigid system prompt per exercise + schema-validated parsing of model output; deterministic fallbacks if no key.
- `exercises/` — one self-contained module per exercise implementing a shared `Exercise` interface (metadata, screens, scoring → score delta).
- `components/` — shared UI (Phoneless responsive layout, score bars, ring, buttons, lock chip).
- `pwa/` — manifest, icons, service worker.

## Error handling

- No API key → exercises run in a clearly-labelled scripted/demo mode; Settings prompts to add a key for live AI.
- API error / rate limit / bad output → inline, in-voice error with retry; never crash the rep; never lose user input.
- Redaction/parse failures → fall back to showing the unredacted summary with a notice.

## Testing

- Unit: score math, redaction, store reducers.
- **E2E (browser):** click through every exercise's critical path in Chrome, verify gating locks, AI calls (BYOK or demo mode), score updates, streak, PWA load. Surface and fix breakages.

## Deferred to v2

- Skill Decay Tracker (core mental assets + AI-use logging + targeted challenges).
- Pure spaced-repetition Recall exercise.
- Real paid-tier backend + payments + accounts/sync.
- Push reminders.
