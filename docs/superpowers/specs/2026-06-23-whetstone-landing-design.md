# Project Whetstone — Landing Page Design Spec

**Date:** 2026-06-23
**Status:** Approved for build

## Vision

A beautiful marketing **landing page** that explains what Project Whetstone is, why it
exists, and how it works — then leads the visitor into the existing working app. It is the
first thing a new visitor sees; returning visitors skip straight into the app.

Guiding principle of the product (carried into the page's message): **AI as a black-box
oracle = atrophy; AI as a Socratic sparring partner = augmentation.**

## Decisions (from brainstorm)

- **Role:** marketing landing page (not an in-app About screen, not a replacement for the
  Today hub).
- **Entry flow:** landing → then app. "Start training" reveals the app shell (Today +
  exercises). The choice is remembered so returning users skip straight in.
- **Architecture:** Approach A — the landing page is a gate **inside the existing SPA**
  (one bundle, no router). Chosen over react-router (adds a dependency + a `404.html`
  redirect dance on GitHub Pages) and a standalone HTML page (duplicates the design
  system, not wired into the app flow).
- **Visual direction:** split / scrollytelling — sections alternate dark ↔ light to encode
  the two mental modes (sharpen vs. reflect).
- **Re-visitable:** an "Intro / About" affordance in Settings flips the gate back off so the
  page is never lost.
- **Hosting:** deployable to GitHub Pages.
- **Scope discipline:** no new copy claims beyond what the README/MVP spec already state;
  no analytics; no new fonts or colors.

## Architecture / components

One bundle, no router. The landing page is a presentational component gated by a persisted
flag.

- **`src/components/Landing.tsx` + `Landing.css`** — the landing page. Presentational; its
  only outward interaction is the CTA. Takes `onEnter: () => void`. Internal anchor links
  scroll to in-page sections (Why / How / FAQ).
- **`src/store.ts`** — add `entered: boolean` (default `false`) and `setEntered(v: boolean)`,
  persisted to `localStorage` alongside the existing state.
- **`src/App.tsx`** — read `entered` from the store. When `!entered`, render
  `<Landing onEnter={...} />` full-screen with **no tab bar**. `onEnter` calls
  `setEntered(true)` and sets the active tab to `today`. When `entered`, render the existing
  app shell unchanged.
- **`src/components/Settings.tsx`** — add an "Intro / About" action that calls
  `setEntered(false)` to re-show the landing page.

### Component boundaries

- `Landing` knows nothing about exercises or the store; it receives `onEnter` and renders
  static marketing content. It can be understood and tested in isolation.
- The gate logic lives in `App.tsx` and the `entered` flag in the store — a single, clear
  seam between "marketing" and "app".

## Sections (top → bottom)

Alternating dark ↔ light. Reuses existing tokens (petrol / coral / mist) and the type trio
(Space Grotesk display / Inter UI / Space Mono for stats/data).

1. **Hero — dark ("ring at night").** Deep-petrol background, one coral spark. Wordmark
   top-left; anchor nav (Why · How · FAQ) top-right. Headline *"Keep the edge AI is
   dulling."* and a subhead on the daily ~5-minute idea. Primary CTA **Start training**
   (→ `onEnter`); secondary **See how it works** (scrolls to How). Centerpiece: an
   animated **Cognitive Ring** SVG that sweeps in on load (static if reduced-motion).

2. **The problem — light ("study desk").** The core principle shown large: *AI as a
   black-box oracle = atrophy. AI as a Socratic sparring partner = augmentation.* Three
   research cards:
   - MIT Media Lab — *Your Brain on ChatGPT* (weaker neural connectivity; 78%+ couldn't
     quote their own essays; note: preliminary, n=54, not peer-reviewed).
   - Microsoft / CMU (CHI 2025) — higher AI confidence correlated with *less* critical
     thinking; effort shifts from doing to verifying.
   - Retrieval practice (Roediger & Karpicke) — producing an answer from memory beats
     re-reading.
   Each carries the honest caveat that the effect is **reversible** and is about *how* you
   use AI, not *that* you use it. Inline source links.

3. **How it works — dark.** The daily loop: *Commit → Get challenged → Score → Streak*
   (~5 min). Then three exercise cards, each naming the eroding skill it counters:
   - **Spar** — Socratic reasoning (commit your argument before AI unlocks; questions-only
     adversary; scored on rigor / evidence / counter-arguments).
   - **Read-and-Retain** — memory/comprehension (summary with key terms redacted until you
     answer a micro-challenge).
   - **Counter-Prompting** — verification (race a timer to catch a subtle flaw in an AI
     answer).
   A line on the **Cognitive Score** as the spine that ties the reps together.

4. **Proof · FAQ · footer — light.**
   - Differentiator strip: *"Not brain-training games"* — methods with evidence of transfer
     (retrieval practice + productive struggle + forced justification), unlike Lumosity-style
     games.
   - Privacy strip: local-first; bring-your-own-key; nothing leaves your browser; Demo mode
     needs no key.
   - FAQ: 3–4 items (e.g. *Do I need an API key? · Does my data leave my device? · Is this
     just brain games? · How long does it take?*).
   - Final **Start training** CTA.
   - Footer: the four sources (MIT, Microsoft/CMU, ScienceDirect, Nature Scitable) and the
     "keep the edge AI is dulling" tagline.

## Motion

- Scroll-reveal via `IntersectionObserver` — fade + slide-up, lightly staggered per section.
- All motion gated by `prefers-reduced-motion: reduce` (matches the rest of the app).
- The Cognitive Ring animates its stroke on load; static arc when reduced-motion.

## Data flow

- Landing is stateless apart from anchor scrolling.
- The only state mutation is the CTA → `onEnter()` → `setEntered(true)` + switch active tab
  to `today`.
- Anchor nav links scroll within the page; no routing.

## Responsive

- Mobile-first single column. Desktop: wider hero (headline + ring side-by-side), multi-column
  research/exercise card grids.

## GitHub Pages hosting

- `vite.config.ts`: set `base: '/antigpt/'` (project-repo subpath). If later moved to a
  `username.github.io` repo or a custom domain, `base` returns to `'/'`.
- PWA manifest: align `start_url` and `scope` with the base path.
- `.github/workflows/deploy.yml`: on push to `main`, `npm ci && npm run build`, then publish
  `dist/` to GitHub Pages via the official Pages actions.
- No backend required: Demo mode is fully static; BYOK calls go browser → Anthropic directly
  (unchanged).
- No `404.html` redirect needed — the app navigates via in-memory state, not URL routes.

## Error handling

- `localStorage` unavailable / blocked → default to `entered = false` (show the landing each
  time); never crash. This reuses the store's existing persistence behavior.

## Testing

- **Unit:** the `entered` store reducer (`setEntered` toggles and persists).
- **E2E (extend `e2e.smoke.mjs`):**
  - Landing renders on first load (CTA visible, tab bar absent).
  - Clicking **Start training** enters the app (Today hub visible, tab bar present).
  - A returning user (flag pre-set in `localStorage`) skips the landing and lands in the app.

## Out of scope

- No new research claims beyond the README/MVP spec.
- No analytics or tracking.
- No new fonts, colors, or design tokens.
- No real paid-tier backend (unchanged; stubbed as before).
