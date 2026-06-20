# Project Whetstone

> Keep the edge AI is dulling.

**Whetstone** is a concept for a daily ~5-minute "gym" for the mental muscles that research suggests erode under heavy LLM use — reasoning, argument construction, verification, and memory of your own work.

This repository contains two things:

1. **A working web-app prototype** (Vite + React + TypeScript + PWA) — the real MVP, with three functioning exercises, a Cognitive Score, a Today hub, and live AI via your own Anthropic key (BYOK) or a no-key Demo mode.
2. **The original clickable mockup** (`whetstone-mockup.html`) — a self-contained design prototype of the flows.

---

## Why this exists

A growing body of 2025 research points to a consistent pattern: *passive, excessive reliance* on LLMs is associated with reduced cognitive engagement and weaker performance on skills you stop practising. Crucially, the same research shows the effect is **about how you use AI, not that you use it** — and that the harm is reversible through structure.

- **MIT Media Lab — "Your Brain on ChatGPT" (2025, preprint):** Over four months, LLM users showed weaker neural connectivity while writing, and 78%+ couldn't quote their own essays. The study's authors stress it is preliminary (n=54, not peer-reviewed) and ask against alarmist "brain rot" framing.
- **Microsoft / Carnegie Mellon (CHI 2025):** Higher confidence in AI correlated with *less* critical thinking; AI use shifted effort from doing the work to verifying it — a step people often skip — and produced less diverse outcomes.
- **Retrieval practice (Roediger & Karpicke):** Actively producing an answer from memory beats re-reading by a wide, well-replicated margin.

The guiding principle, drawn from the interventions that actually worked: **AI as a Socratic sparring partner = augmentation; AI as a black-box oracle = atrophy.**

> ⚠️ Note: brain-training games (Lumosity-style) are deliberately *not* the model here — their gains are well-documented to not transfer to real-world cognition. Whetstone trains the specific eroding skills using methods with evidence of transfer (retrieval practice + productive struggle + forced justification).

---

## What's in the mockup

The prototype is one product with a shared daily habit and two exercises:

| Screen | What it is | The eroding skill it counters |
|---|---|---|
| **Today** | A home hub: one daily ring covering both reps. | Frictionless daily maintenance. |
| **Spar** *(Concept 1 — "Steelman")* | You commit your own argument **before** AI unlocks, then a Socratic adversary challenges it (questions only, never answers), then you're scored on rigor / evidence / counter-arguments. | Reasoning, verification, outcome diversity. |
| **Recall** *(Concept 2 — "Explain-it-back")* | Things you had AI explain resurface days later; you rebuild them from memory, get a gap report, and re-encode on a spaced schedule. | Memory of your own work, comprehension. |

**Design direction:** *Spar* runs on a dark "ring at night" theme (adversarial); *Recall* runs light, like a study desk (reflective). That contrast encodes the two mental modes. Type pairs Space Grotesk (display) + Inter (UI) + Space Mono (the "rep data").

---

## Run the app

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build` (type-check + production PWA build), `npm run typecheck`, `npm run e2e` (headless Playwright smoke test of all three flows — dev server must be running).

- **Demo mode** (default): everything works with scripted content, no key required.
- **Live AI:** open **Settings → Bring your own key**, paste an Anthropic API key (stored only in your browser), and the exercises call **Claude Haiku** directly. The paid tier is stubbed (needs a backend).

### Architecture (quick map)

- `src/store.ts` — local-first Zustand store (Cognitive Score, streak, history, settings) persisted to `localStorage`.
- `src/ai/client.ts` — BYOK Claude client (`complete` / `completeJSON`); falls back to Demo mode with no key.
- `src/exercises/{spar,readRetain,counterPrompting}/` — one self-contained module each, conforming to `src/exercises/types.ts`.
- `src/components/` — Today hub (daily ring + score), Settings, ExerciseHost.
- `e2e.smoke.mjs` — Playwright end-to-end test driving every exercise in Demo mode.

## The mockup

`whetstone-mockup.html` is a single self-contained file (no build). Open it directly or serve with `python3 -m http.server`. It shows the original design exploration of the flows.

---

## Status & roadmap

This is an early-stage concept. Current direction (subject to a proper design spec):

- **Audience:** knowledge workers / professionals concerned about AI-driven skill erosion.
- **Platform:** web app / PWA first.
- **Open questions:** MVP cut (both exercises vs. one), real LLM backend (e.g. Claude API) for sparring + grading, and how Recall sources content.

A full design spec and implementation plan will follow before any production build.

---

## Sources

- MIT Media Lab — *Your Brain on ChatGPT* ([arXiv:2506.08872](https://arxiv.org/abs/2506.08872), [project site](https://www.brainonllm.com/))
- Microsoft Research / CMU — *The Impact of Generative AI on Critical Thinking* ([CHI 2025 PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2025/01/lee_2025_ai_critical_thinking_survey.pdf))
- *AI-overdependence and human cognitive decline* ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2451958826001764))
- Brain-training transfer limits ([Nature Scitable](https://www.nature.com/scitable/blog/mind-read/braintraining_apps_neuroscience_or_pseudoscience/))

---

*This mockup is a design prototype. Research summaries are condensed; follow the linked sources for full context and caveats.*
