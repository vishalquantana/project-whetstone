# Whetstone Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beautiful marketing landing page that explains Project Whetstone and leads visitors into the existing app, deployable to GitHub Pages.

**Architecture:** Approach A — the landing page is a gate *inside* the existing single-page app (one bundle, no router). A persisted `entered` flag in the Zustand store decides whether `App` renders the full-screen `<Landing>` or the existing app shell. The page is split scrollytelling: sections alternate dark↔light, reusing the existing design tokens.

**Tech Stack:** Vite + React 18 + TypeScript, Zustand (persisted to localStorage), vite-plugin-pwa, Playwright (e2e smoke test). No new runtime dependencies.

## Global Constraints

- **No new dependencies** — runtime or dev. Use only React, the existing Zustand store, and CSS.
- **Design tokens only** — reuse `src/styles/tokens.css` (`--petrol`, `--coral`, `--mist`, `--chalk`, `--ink`, etc.) and the type trio (Space Grotesk display / Inter UI / Space Mono for stats). No new colors or fonts.
- **All motion gated by** `@media (prefers-reduced-motion: reduce)` — the global rule in `src/styles/global.css` already disables `transition`/`animation`; any JS-driven reveal must also check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- **No new research claims** beyond what `README.md` / the MVP spec already state.
- **No analytics, no tracking, no real paid-tier backend.**
- **Test cycle** = `npm run typecheck`, `npm run build`, and the Playwright e2e smoke test (`npm run e2e`, dev server must be running). There is no unit-test runner; do not add one.
- **GitHub Pages base path** is `/antigpt/` in production builds only; dev/e2e stay at `/`.
- **Copy/wordmark:** the product name is **Whetstone**; tagline **"Keep the edge AI is dulling."**

---

## File Structure

- `vite.config.ts` — *modify*: conditional `base`, align PWA manifest `start_url`/`scope`.
- `.github/workflows/deploy.yml` — *create*: build + publish `dist/` to GitHub Pages.
- `src/store.ts` — *modify*: add `entered: boolean` + `setEntered`; preserve `entered` on `resetData`.
- `src/App.tsx` — *modify*: gate on `entered`; render `<Landing>` when not entered.
- `src/components/useScrollReveal.ts` — *create*: IntersectionObserver reveal hook (reduced-motion aware).
- `src/components/Landing.tsx` — *create*: the landing page (hero + 3 content sections + footer), composed of small internal section components and a `CognitiveRing`.
- `src/components/Landing.css` — *create*: all landing styles (self-contained; renders outside the `.app` shell).
- `src/components/Settings.tsx` — *modify*: add a "View intro" action that calls `setEntered(false)`.
- `e2e.smoke.mjs` — *modify*: handle the landing gate at boot; add gate / returning-user / re-show assertions.

---

### Task 1: GitHub Pages hosting config

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a production build under base `/antigpt/`; dev/preview-serve stays at `/` so e2e is unaffected.

- [ ] **Step 1: Make `base` conditional and align the PWA manifest**

Replace the export in `vite.config.ts` with the function form so `base` only applies to production builds:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Project repo is served from a subpath on GitHub Pages; dev/e2e stay at root.
  base: command === 'build' ? '/antigpt/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Whetstone',
        short_name: 'Whetstone',
        description: 'Keep the edge AI is dulling. A daily 5-minute gym for the mental muscles that erode under heavy AI use.',
        theme_color: '#0E3D3A',
        background_color: '#E7EBEA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/antigpt/',
        scope: '/antigpt/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
}));
```

- [ ] **Step 2: Verify the build emits the subpath**

Run: `npm run build`
Expected: build succeeds. Confirm `dist/index.html` references assets under `/antigpt/` (e.g. `src="/antigpt/assets/...">`).

Run: `grep -c "/antigpt/" dist/index.html`
Expected: a count `>= 1`.

- [ ] **Step 3: Add the Pages deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Verify dev/e2e still serve at root**

Run: `npm run dev` (in a background shell), then `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`
Expected: `200` (base did not move the dev root). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts .github/workflows/deploy.yml
git commit -m "build: configure GitHub Pages hosting (base path + deploy workflow)"
```

---

### Task 2: `entered` gate (store + App) with minimal landing placeholder

This task installs the marketing↔app seam and its tests *before* the real UI exists, using a throwaway placeholder so the gate is provable. Task 3 replaces the placeholder body.

**Files:**
- Modify: `src/store.ts`
- Modify: `src/App.tsx`
- Create: `src/components/Landing.tsx` (placeholder body — replaced in Task 3)
- Modify: `e2e.smoke.mjs`

**Interfaces:**
- Produces:
  - `store`: `entered: boolean` (default `false`), `setEntered(v: boolean): void`. `resetData()` preserves the current `entered`.
  - `Landing` component: `export function Landing(props: { onEnter: () => void }): JSX.Element`. Renders at least one button with the exact accessible name **`Start training`** that calls `onEnter`.
  - `App`: renders `<Landing onEnter={...} />` (no `nav.tabnav`) when `!entered`; the existing shell otherwise.

- [ ] **Step 1: Write the failing test (extend e2e boot + add gate checks)**

In `e2e.smoke.mjs`, replace the `// ---- boot + reset ----` block (the `ctxLabel = 'boot'` section, currently lines ~30–39) with:

```js
  // ---- boot: landing gate ----
  ctxLabel = 'boot';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // First-time visitor lands on the marketing page (no tab bar yet).
  await page.getByRole('button', { name: 'Start training' }).first().waitFor({ timeout: 8000 });
  const tabBarOnLanding = await page.locator('nav.tabnav').count();
  if (tabBarOnLanding === 0) ok('boot: landing shown first (no tab bar)');
  else bad('boot: tab bar leaked onto landing', `count=${tabBarOnLanding}`);
  await shot('00-landing');

  // Enter the app.
  await page.getByRole('button', { name: 'Start training' }).first().click();
  await page.locator('.score-num').first().waitFor({ timeout: 8000 });
  await shot('01-today-initial');
  const s0 = await score();
  ok('boot: Start training enters the app (Today renders)', `score=${s0}`);

  // Returning visitor (entered flag persisted) skips the landing on reload.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.score-num').first().waitFor({ timeout: 8000 });
  const landingAfterReload = await page.getByRole('button', { name: 'Start training' }).count();
  if (landingAfterReload === 0) ok('boot: returning visitor skips the landing');
  else bad('boot: landing re-shown to returning visitor', `count=${landingAfterReload}`);
```

- [ ] **Step 2: Run e2e to verify it fails**

Run (dev server running): `npm run e2e`
Expected: FAIL — the "Start training" button does not exist yet (boot step times out / errors). Confirms the test exercises the new gate.

- [ ] **Step 3: Add the `entered` flag to the store**

In `src/store.ts`:

In the `WhetstoneState` interface, add after `settings: Settings;`:

```ts
  entered: boolean;
```

and add to the action signatures (after `setSettings`):

```ts
  setEntered: (v: boolean) => void;
```

In the `initial` object, add after `settings: { ... },`:

```ts
  entered: false,
```

In the store creator, add the action (after `setSettings`):

```ts
      setEntered: (v) => set({ entered: v }),
```

Change `resetData` to preserve `entered` so a data reset never kicks the user back to the landing:

```ts
      resetData: () =>
        set((state) => ({ ...initial, entered: state.entered, settings: { aiMode: 'demo', apiKey: '' } })),
```

- [ ] **Step 4: Create the placeholder `Landing` component**

Create `src/components/Landing.tsx` (temporary body — Task 3 replaces it):

```tsx
interface Props {
  onEnter: () => void;
}

export function Landing({ onEnter }: Props) {
  return (
    <div className="landing">
      <h1 className="grotesk">Keep the edge AI is dulling.</h1>
      <button className="btn" onClick={onEnter}>
        Start training
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Gate `App` on `entered`**

In `src/App.tsx`, add imports near the top:

```tsx
import { useStore } from './store';
import { Landing } from './components/Landing';
```

Inside `App`, before the existing `const activeExercise = ...`, add:

```tsx
  const entered = useStore((s) => s.entered);
  const setEntered = useStore((s) => s.setEntered);

  if (!entered) {
    return (
      <Landing
        onEnter={() => {
          setEntered(true);
          setTab('today');
        }}
      />
    );
  }
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 7: Run e2e to verify it passes**

Run (dev server running): `npm run e2e`
Expected: PASS — boot now reports "landing shown first", "Start training enters the app", and "returning visitor skips the landing"; all existing exercise/today/settings steps still pass.

- [ ] **Step 8: Commit**

```bash
git add src/store.ts src/App.tsx src/components/Landing.tsx e2e.smoke.mjs
git commit -m "feat: gate app behind an entered flag with a landing placeholder"
```

---

### Task 3: Landing hero (dark) + scroll-reveal hook + Cognitive Ring

Replaces the placeholder with the real page scaffold and the hero section. Later tasks append more sections to the same file.

**Files:**
- Create: `src/components/useScrollReveal.ts`
- Modify: `src/components/Landing.tsx` (replace placeholder)
- Create: `src/components/Landing.css`

**Interfaces:**
- Consumes: `Props { onEnter: () => void }` from Task 2.
- Produces:
  - `useScrollReveal(): void` — adds class `revealed` to every `[data-reveal]` element when it scrolls into view; reveals all immediately under reduced motion or when `IntersectionObserver` is missing.
  - `Landing` renders a `<div className="landing">` containing a `<header className="lr-nav">` (wordmark + `#why`/`#how`/`#faq` anchors) and `<section className="lr-hero">` with the **`Start training`** primary CTA (calls `onEnter`) and a **`See how it works`** secondary link to `#how`.

- [ ] **Step 1: Create the scroll-reveal hook**

Create `src/components/useScrollReveal.ts`:

```ts
import { useEffect } from 'react';

/**
 * Adds the `revealed` class to every element marked with `data-reveal` as it
 * scrolls into view. Reveals everything immediately when the user prefers
 * reduced motion or when IntersectionObserver is unavailable.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
```

- [ ] **Step 2: Replace `Landing.tsx` with the real scaffold + hero**

Replace the entire contents of `src/components/Landing.tsx` with:

```tsx
import { useScrollReveal } from './useScrollReveal';
import './Landing.css';

interface Props {
  onEnter: () => void;
}

function CognitiveRing() {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg className="lr-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="lr-ring-track" cx="60" cy="60" r={r} />
      <circle
        className="lr-ring-fill"
        cx="60"
        cy="60"
        r={r}
        style={{ strokeDasharray: c, strokeDashoffset: c * 0.18 }}
      />
    </svg>
  );
}

export function Landing({ onEnter }: Props) {
  useScrollReveal();

  return (
    <div className="landing">
      <header className="lr-nav">
        <span className="lr-wordmark grotesk">Whetstone</span>
        <nav className="lr-links">
          <a href="#why">Why</a>
          <a href="#how">How</a>
          <a href="#faq">FAQ</a>
        </nav>
      </header>

      <section className="lr-hero">
        <div className="lr-hero-copy" data-reveal>
          <div className="lr-eyebrow mono">A 5-minute daily cognitive gym</div>
          <h1 className="lr-h1 grotesk">Keep the edge AI is dulling.</h1>
          <p className="lr-sub">
            Heavy AI use quietly erodes the mental muscles you stop practising — reasoning,
            memory, and judgment. Whetstone is a daily five-minute workout that trains them
            back, using AI as a sparring partner instead of an oracle.
          </p>
          <div className="lr-cta-row">
            <button className="lr-btn lr-btn-primary grotesk" onClick={onEnter}>
              Start training
            </button>
            <a className="lr-btn lr-btn-ghost grotesk" href="#how">
              See how it works
            </a>
          </div>
        </div>
        <div className="lr-hero-art" data-reveal>
          <CognitiveRing />
          <div className="lr-ring-label mono">
            <span>COGNITIVE SCORE</span>
            <b>the edge, measured</b>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Create `Landing.css` (base layout + hero)**

Create `src/components/Landing.css`:

```css
/* Landing renders outside the .app shell, so it owns its own full-width layout. */
.landing {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--mist);
  color: var(--ink);
}

/* reveal animation (disabled globally under reduced motion via global.css) */
[data-reveal] {
  opacity: 0;
  transform: translateY(18px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
}
[data-reveal].revealed {
  opacity: 1;
  transform: none;
}

/* ---- nav ---- */
.lr-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px clamp(20px, 5vw, 64px);
  background: rgba(14, 61, 58, 0.85);
  backdrop-filter: blur(10px);
  color: var(--chalk);
}
.lr-wordmark {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.lr-links {
  display: flex;
  gap: clamp(14px, 3vw, 28px);
}
.lr-links a {
  color: #bfe0da;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
.lr-links a:hover {
  color: var(--coral);
}

/* ---- shared section buttons ---- */
.lr-btn {
  display: inline-block;
  cursor: pointer;
  border: 0;
  text-decoration: none;
  font-weight: 700;
  font-size: 15px;
  padding: 14px 24px;
  border-radius: var(--radius-sm);
  transition: 0.2s var(--ease);
}
.lr-btn-primary {
  background: var(--coral);
  color: #fff;
}
.lr-btn-primary:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}
.lr-btn-ghost {
  background: transparent;
  color: inherit;
  border: 1.5px solid currentColor;
  opacity: 0.85;
}
.lr-btn-ghost:hover {
  opacity: 1;
}
.lr-btn:focus-visible {
  outline: 3px solid var(--coral);
  outline-offset: 3px;
}

/* ---- hero (dark) ---- */
.lr-hero {
  background:
    radial-gradient(900px 500px at 75% -10%, #15514c 0%, transparent 60%),
    var(--petrol);
  color: var(--chalk);
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: center;
  padding: clamp(48px, 9vw, 110px) clamp(20px, 5vw, 64px) clamp(56px, 10vw, 120px);
}
.lr-eyebrow {
  color: #7fd8cb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 18px;
}
.lr-h1 {
  font-size: clamp(38px, 7vw, 68px);
  line-height: 1.02;
  letter-spacing: -0.02em;
  margin-bottom: 20px;
}
.lr-sub {
  font-size: clamp(16px, 2.2vw, 20px);
  line-height: 1.55;
  color: #cfe2de;
  max-width: 46ch;
  margin-bottom: 32px;
}
.lr-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.lr-hero-art {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.lr-ring {
  width: min(70vw, 300px);
  height: min(70vw, 300px);
  transform: rotate(-90deg);
}
.lr-ring-track {
  fill: none;
  stroke: #11403c;
  stroke-width: 8;
}
.lr-ring-fill {
  fill: none;
  stroke: var(--coral);
  stroke-width: 8;
  stroke-linecap: round;
  animation: lr-sweep 1.4s var(--ease) both;
}
@keyframes lr-sweep {
  from {
    stroke-dashoffset: 326.7;
  }
}
.lr-ring-label {
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #7fd8cb;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lr-ring-label b {
  color: var(--chalk);
  letter-spacing: 0;
  font-size: 14px;
}

/* desktop: hero two-column */
@media (min-width: 820px) {
  .lr-hero {
    grid-template-columns: 1.1fr 0.9fr;
  }
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS (no type or build errors).

- [ ] **Step 5: Run e2e (gate still green with the real hero)**

Run (dev server running): `npm run e2e`
Expected: PASS — boot still finds **Start training** and enters the app; the `00-landing` screenshot now shows the styled hero.

- [ ] **Step 6: Commit**

```bash
git add src/components/useScrollReveal.ts src/components/Landing.tsx src/components/Landing.css
git commit -m "feat: landing hero, scroll-reveal hook, and cognitive ring"
```

---

### Task 4: "The problem" (light) + "How it works" (dark) sections

**Files:**
- Modify: `src/components/Landing.tsx`
- Modify: `src/components/Landing.css`
- Modify: `e2e.smoke.mjs`

**Interfaces:**
- Consumes: the `Landing` scaffold from Task 3.
- Produces: a `<section id="why">` containing the literal text `AI as a black-box oracle` and a `<section id="how">` containing the literal exercise names `Spar`, `Read-and-Retain`, `Counter-Prompting`.

- [ ] **Step 1: Write the failing test (assert the new sections render)**

In `e2e.smoke.mjs`, immediately after the `00-landing` screenshot line (`await shot('00-landing');`) and *before* the "Enter the app" comment, add:

```js
  // Landing content sections render.
  {
    const principle = await page.getByText('AI as a black-box oracle', { exact: false }).count();
    const sparCard = await page.getByText('Read-and-Retain', { exact: false }).count();
    if (principle > 0 && sparCard > 0) ok('landing: problem + how-it-works sections render');
    else bad('landing: content sections missing', `principle=${principle} how=${sparCard}`);
  }
```

- [ ] **Step 2: Run e2e to verify it fails**

Run (dev server running): `npm run e2e`
Expected: FAIL — `principle=0 how=0`; that text does not exist yet.

- [ ] **Step 3: Add the two sections to `Landing.tsx`**

In `src/components/Landing.tsx`, add this data + components above the `export function Landing` line:

```tsx
const RESEARCH = [
  {
    src: 'MIT Media Lab',
    title: 'Your Brain on ChatGPT',
    body: 'Over four months, heavy LLM users showed weaker neural connectivity while writing, and 78%+ couldn’t quote their own essays. (Preliminary: n=54, not peer-reviewed.)',
    href: 'https://www.brainonllm.com/',
  },
  {
    src: 'Microsoft / CMU · CHI 2025',
    title: 'AI and critical thinking',
    body: 'Higher confidence in AI correlated with less critical thinking — effort shifted from doing the work to verifying it, a step people often skip.',
    href: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2025/01/lee_2025_ai_critical_thinking_survey.pdf',
  },
  {
    src: 'Roediger & Karpicke',
    title: 'Retrieval practice',
    body: 'Actively producing an answer from memory beats re-reading by a wide, well-replicated margin — the basis for how Whetstone trains.',
    href: 'https://www.nature.com/scitable/blog/mind-read/braintraining_apps_neuroscience_or_pseudoscience/',
  },
];

const STEPS = [
  { n: '01', t: 'Commit', d: 'You produce your own answer or argument first — before any AI assists.' },
  { n: '02', t: 'Get challenged', d: 'AI pushes back as a Socratic adversary: questions and counters, never the answer.' },
  { n: '03', t: 'Score', d: 'You’re graded on rigor, retention, and errors caught — and shown your weakest link.' },
  { n: '04', t: 'Streak', d: 'Reps compound into a Cognitive Score and a daily streak. Five minutes a day.' },
];

const EXERCISES = [
  { icon: '🥊', name: 'Spar', skill: 'Reasoning', d: 'Commit an argument on a daily claim, then defend it against a questions-only adversary for three rounds. Scored on rigor, evidence, and counter-arguments.' },
  { icon: '🧠', name: 'Read-and-Retain', skill: 'Memory', d: 'Paste an article; the summary comes back with key terms redacted. Answer a micro-challenge from memory to unlock the clean version. Fights the illusion of competence.' },
  { icon: '🔎', name: 'Counter-Prompting', skill: 'Verification', d: 'An AI answer hides a subtle flaw. Race the timer to spot it and rewrite the correction. Gamified skepticism.' },
];

function ProblemSection() {
  return (
    <section id="why" className="lr-problem">
      <div className="lr-section-head" data-reveal>
        <div className="lr-eyebrow-dark mono">The problem</div>
        <h2 className="lr-h2 grotesk">
          AI as a black-box oracle = atrophy.
          <br />
          AI as a Socratic sparring partner = augmentation.
        </h2>
        <p className="lr-lede">
          A growing body of 2025 research points to the same pattern: passive, excessive
          reliance on AI is linked to weaker performance on the skills you stop practising.
          The encouraging part — it’s reversible, and it’s about <em>how</em> you use AI, not
          <em> that</em> you use it.
        </p>
      </div>
      <div className="lr-cards">
        {RESEARCH.map((r) => (
          <a key={r.title} className="lr-card" href={r.href} target="_blank" rel="noreferrer" data-reveal>
            <div className="lr-card-src mono">{r.src}</div>
            <div className="lr-card-title grotesk">{r.title}</div>
            <p className="lr-card-body">{r.body}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section id="how" className="lr-how">
      <div className="lr-section-head" data-reveal>
        <div className="lr-eyebrow mono">How it works</div>
        <h2 className="lr-h2 lr-h2-light grotesk">One daily loop. Three reps.</h2>
        <p className="lr-lede lr-lede-light">
          Every exercise forces you to produce or verify <em>before</em> the AI helps — then
          rolls the result into a single Cognitive Score.
        </p>
      </div>

      <div className="lr-steps">
        {STEPS.map((s) => (
          <div key={s.n} className="lr-step" data-reveal>
            <span className="lr-step-n mono">{s.n}</span>
            <b className="grotesk">{s.t}</b>
            <small>{s.d}</small>
          </div>
        ))}
      </div>

      <div className="lr-ex-cards">
        {EXERCISES.map((e) => (
          <div key={e.name} className="lr-ex-card" data-reveal>
            <span className="lr-ex-ico" aria-hidden="true">{e.icon}</span>
            <div className="lr-ex-skill mono">{e.skill}</div>
            <div className="lr-ex-name grotesk">{e.name}</div>
            <p className="lr-ex-body">{e.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Then, inside the `Landing` return, add the two sections right after the closing `</section>` of `lr-hero`:

```tsx
      <ProblemSection />
      <HowSection />
```

- [ ] **Step 4: Add styles for both sections to `Landing.css`**

Append to `src/components/Landing.css`:

```css
/* ---- shared section heads ---- */
.lr-section-head {
  max-width: 760px;
  margin: 0 auto;
  text-align: center;
}
.lr-h2 {
  font-size: clamp(26px, 4.4vw, 44px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin-bottom: 18px;
}
.lr-h2-light {
  color: var(--chalk);
}
.lr-lede {
  font-size: clamp(15px, 2vw, 18px);
  line-height: 1.6;
  color: var(--graphite);
}
.lr-lede-light {
  color: #cfe2de;
}
.lr-eyebrow-dark {
  color: var(--coral);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 16px;
}

/* ---- problem (light) ---- */
.lr-problem {
  background: var(--mist);
  padding: clamp(56px, 9vw, 110px) clamp(20px, 5vw, 64px);
}
.lr-cards {
  margin-top: 44px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  max-width: 1040px;
  margin-left: auto;
  margin-right: auto;
}
.lr-card {
  display: block;
  text-decoration: none;
  color: var(--ink);
  background: var(--chalk);
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  padding: 24px;
  transition: 0.2s var(--ease);
}
.lr-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-soft);
  border-color: var(--coral);
}
.lr-card-src {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--graphite-2);
  margin-bottom: 12px;
}
.lr-card-title {
  font-size: 20px;
  margin-bottom: 10px;
}
.lr-card-body {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--graphite);
}

/* ---- how it works (dark) ---- */
.lr-how {
  background:
    radial-gradient(800px 400px at 20% 0%, #15514c 0%, transparent 55%),
    var(--petrol);
  color: var(--chalk);
  padding: clamp(56px, 9vw, 110px) clamp(20px, 5vw, 64px);
}
.lr-steps {
  margin: 44px auto 0;
  max-width: 1040px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.lr-step {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line-dark);
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lr-step-n {
  color: var(--coral);
  font-size: 13px;
  font-weight: 700;
}
.lr-step b {
  font-size: 17px;
}
.lr-step small {
  color: #aecfc9;
  font-size: 13.5px;
  line-height: 1.5;
}
.lr-ex-cards {
  margin: 22px auto 0;
  max-width: 1040px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
.lr-ex-card {
  background: #06201e;
  border: 1.5px solid var(--line-dark);
  border-radius: var(--radius);
  padding: 26px;
}
.lr-ex-ico {
  font-size: 30px;
}
.lr-ex-skill {
  margin-top: 14px;
  color: #7fd8cb;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.lr-ex-name {
  font-size: 24px;
  margin: 4px 0 10px;
}
.lr-ex-body {
  color: #cfe2de;
  font-size: 14.5px;
  line-height: 1.55;
}

@media (min-width: 720px) {
  .lr-cards,
  .lr-ex-cards {
    grid-template-columns: repeat(3, 1fr);
  }
  .lr-steps {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Run e2e to verify it passes**

Run (dev server running): `npm run e2e`
Expected: PASS — "landing: problem + how-it-works sections render" now reports PASS; all later steps still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Landing.tsx src/components/Landing.css e2e.smoke.mjs
git commit -m "feat: landing problem and how-it-works sections"
```

---

### Task 5: Proof · FAQ · footer (light) + Settings "View intro"

**Files:**
- Modify: `src/components/Landing.tsx`
- Modify: `src/components/Landing.css`
- Modify: `src/components/Settings.tsx`
- Modify: `e2e.smoke.mjs`

**Interfaces:**
- Consumes: `Landing` from Task 4; `useStore().setEntered` from Task 2.
- Produces:
  - `<section id="faq">` containing the literal text `Not brain-training games` and a final button named **`Start training`**.
  - In Settings, a button named exactly **`View intro`** that calls `setEntered(false)`.

- [ ] **Step 1: Write the failing tests (FAQ section + Settings re-show)**

In `e2e.smoke.mjs`, in the content-sections block from Task 4, extend the check to also require the proof strip. Replace that block with:

```js
  // Landing content sections render.
  {
    const principle = await page.getByText('AI as a black-box oracle', { exact: false }).count();
    const how = await page.getByText('Read-and-Retain', { exact: false }).count();
    const proof = await page.getByText('Not brain-training games', { exact: false }).count();
    if (principle > 0 && how > 0 && proof > 0) ok('landing: all sections render');
    else bad('landing: content sections missing', `principle=${principle} how=${how} proof=${proof}`);
  }
```

Then, in the `ctxLabel = 'settings'` block near the end, replace its `try { ... } catch` body with:

```js
  try {
    await nav('Settings').click();
    await page.getByRole('button', { name: 'View intro' }).waitFor({ timeout: 6000 });
    await shot('12-settings');
    // "View intro" returns the user to the landing page.
    await page.getByRole('button', { name: 'View intro' }).click();
    await page.getByRole('button', { name: 'Start training' }).first().waitFor({ timeout: 6000 });
    const tabBar = await page.locator('nav.tabnav').count();
    if (tabBar === 0) ok('settings: View intro re-shows the landing');
    else bad('settings: tab bar still present after View intro', `count=${tabBar}`);
  } catch (e) { await shot('ERR-settings'); bad('settings', e); }
```

- [ ] **Step 2: Run e2e to verify it fails**

Run (dev server running): `npm run e2e`
Expected: FAIL — `proof=0` (no proof strip yet) and the Settings step times out waiting for **View intro**.

- [ ] **Step 3: Add the proof/FAQ/footer section to `Landing.tsx`**

In `src/components/Landing.tsx`, add this data + component above `export function Landing`:

```tsx
const FAQ = [
  { q: 'Do I need an API key?', a: 'No. Demo mode works with scripted content and no key. For live AI, add your own Anthropic key in Settings — it stays on your device.' },
  { q: 'Does my data leave my device?', a: 'Your score, streak, and history are stored locally in your browser. With your own key, exercise prompts go directly from your device to Anthropic — never through our servers.' },
  { q: 'Is this just brain-training games?', a: 'No. Lumosity-style games don’t transfer to real cognition. Whetstone uses methods with evidence of transfer — retrieval practice, productive struggle, and forced justification.' },
  { q: 'How long does it take?', a: 'About five minutes a day across the three reps. Consistency is the point — the streak is the product.' },
];

function ProofSection({ onEnter }: { onEnter: () => void }) {
  return (
    <section id="faq" className="lr-proof">
      <div className="lr-strips">
        <div className="lr-strip" data-reveal>
          <div className="lr-eyebrow-dark mono">Not brain-training games</div>
          <p>
            Brain-training apps don’t transfer to real-world thinking. Whetstone trains the
            specific eroding skills with methods that have evidence of transfer.
          </p>
        </div>
        <div className="lr-strip" data-reveal>
          <div className="lr-eyebrow-dark mono">Private by default</div>
          <p>
            Local-first. Bring your own key or stay in Demo mode. Nothing about your reps
            leaves your browser.
          </p>
        </div>
      </div>

      <div className="lr-faq" data-reveal>
        {FAQ.map((f) => (
          <details key={f.q} className="lr-faq-item">
            <summary className="grotesk">{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="lr-final" data-reveal>
        <h2 className="lr-h2 grotesk">Keep your edge.</h2>
        <button className="lr-btn lr-btn-primary grotesk" onClick={onEnter}>
          Start training
        </button>
      </div>

      <footer className="lr-footer">
        <span className="mono">Whetstone — keep the edge AI is dulling.</span>
        <span className="lr-sources mono">
          Sources:{' '}
          <a href="https://arxiv.org/abs/2506.08872" target="_blank" rel="noreferrer">MIT</a>{' · '}
          <a href="https://www.microsoft.com/en-us/research/wp-content/uploads/2025/01/lee_2025_ai_critical_thinking_survey.pdf" target="_blank" rel="noreferrer">Microsoft/CMU</a>{' · '}
          <a href="https://www.sciencedirect.com/science/article/pii/S2451958826001764" target="_blank" rel="noreferrer">ScienceDirect</a>{' · '}
          <a href="https://www.nature.com/scitable/blog/mind-read/braintraining_apps_neuroscience_or_pseudoscience/" target="_blank" rel="noreferrer">Nature</a>
        </span>
      </footer>
    </section>
  );
}
```

Then add it inside the `Landing` return, after `<HowSection />`:

```tsx
      <ProofSection onEnter={onEnter} />
```

- [ ] **Step 4: Add proof/FAQ/footer styles to `Landing.css`**

Append to `src/components/Landing.css`:

```css
/* ---- proof / faq / footer (light) ---- */
.lr-proof {
  background: var(--mist);
  padding: clamp(56px, 9vw, 110px) clamp(20px, 5vw, 64px) 0;
}
.lr-strips {
  max-width: 1040px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
.lr-strip {
  background: var(--chalk);
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  padding: 24px;
}
.lr-strip p {
  margin-top: 10px;
  color: var(--graphite);
  font-size: 14.5px;
  line-height: 1.55;
}
.lr-faq {
  max-width: 760px;
  margin: 40px auto 0;
}
.lr-faq-item {
  border-bottom: 1.5px solid var(--line);
  padding: 16px 0;
}
.lr-faq-item summary {
  cursor: pointer;
  font-size: 17px;
  list-style: none;
}
.lr-faq-item summary::-webkit-details-marker {
  display: none;
}
.lr-faq-item summary::after {
  content: '+';
  float: right;
  color: var(--coral);
  font-weight: 700;
}
.lr-faq-item[open] summary::after {
  content: '–';
}
.lr-faq-item p {
  margin-top: 10px;
  color: var(--graphite);
  font-size: 14.5px;
  line-height: 1.6;
}
.lr-final {
  text-align: center;
  padding: clamp(48px, 8vw, 90px) 0;
}
.lr-final .lr-btn {
  margin-top: 8px;
}
.lr-footer {
  border-top: 1.5px solid var(--line);
  padding: 24px 0 40px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--graphite-2);
}
.lr-sources a {
  color: var(--graphite);
}

@media (min-width: 720px) {
  .lr-strips {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 5: Add "View intro" to Settings**

In `src/components/Settings.tsx`:

Add a selector for `setEntered` after the existing `resetData` selector (around line 15):

```tsx
  const setEntered = useStore((s) => s.setEntered);
```

Then, in the JSX, replace the existing `<div className="spacer" />` + reset button block at the bottom with:

```tsx
      <div className="card note-card">
        <b className="grotesk">About Whetstone</b>
        <p className="paid-note">Re-read what Whetstone is and the research behind it.</p>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setEntered(false)}>
          View intro
        </button>
      </div>

      <div className="spacer" />
      <button className="btn ghost reset-btn" onClick={onReset}>
        Reset data
      </button>
```

- [ ] **Step 6: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Run e2e to verify it passes**

Run (dev server running): `npm run e2e`
Expected: PASS — "landing: all sections render" and "settings: View intro re-shows the landing" both PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Landing.tsx src/components/Landing.css src/components/Settings.tsx e2e.smoke.mjs
git commit -m "feat: landing proof/FAQ/footer and Settings View intro"
```

---

### Task 6: Final verification pass

**Files:** none changed (verification + screenshot review only).

- [ ] **Step 1: Full clean build + typecheck**

Run: `npm run build`
Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 2: Confirm production base path**

Run: `grep -c "/antigpt/" dist/index.html`
Expected: count `>= 1` (assets served from the GitHub Pages subpath).

- [ ] **Step 3: Full e2e run, capture report**

Run (dev server running): `npm run e2e`
Expected: PASS — in the `E2E_REPORT_JSON` summary, `failed: 0`, `pageErrorCount: 0`, and `consoleErrorCount: 0`.

- [ ] **Step 4: Eyeball the landing screenshot**

Open `/tmp/whetstone-shots/00-landing.png` and confirm: dark hero with the headline + ring, and (after scroll in the full-page shot) the light problem section, dark how-it-works, and light proof/FAQ/footer are all present and styled.

- [ ] **Step 5: Reduced-motion sanity check (code review)**

Confirm `src/components/useScrollReveal.ts` reveals all `[data-reveal]` elements immediately when `prefers-reduced-motion: reduce` is set, and that `Landing.css` motion lives only in `transition`/`animation` (covered by the global reduced-motion rule). No code change expected; note the result.

---

## Self-Review

**Spec coverage:**
- Marketing landing page, landing→app flow, remember returning users → Task 2 (`entered` gate) ✓
- Approach A (one bundle, no router) → Tasks 2–5 ✓
- Split scrollytelling, alternating dark↔light → hero dark (T3), problem light + how dark (T4), proof light (T5) ✓
- Four sections (hero+CTA, problem/research, how it works, proof/FAQ/footer) → T3, T4, T5 ✓
- Cognitive Ring + scroll-reveal motion, reduced-motion gated → T3 (ring + hook), global rule ✓
- Re-visitable via Settings → T5 ("View intro") ✓
- GitHub Pages (base, manifest, workflow) → T1 ✓
- Testing (gate, returning user, sections, re-show, final pass) → T2, T4, T5, T6 ✓
- Out of scope respected (no new deps/colors/fonts/claims/analytics) → Global Constraints ✓

**Placeholder scan:** No "TBD/TODO"; every code step shows full code; the Task 2 `Landing` placeholder is explicitly temporary and fully replaced in Task 3.

**Type consistency:** `entered: boolean` / `setEntered(v: boolean)` consistent across store, App, Settings. `Landing` props `{ onEnter: () => void }` consistent in T2→T5. `useScrollReveal(): void` matches its usage. Exercise/section literal strings used in e2e assertions (`Start training`, `Read-and-Retain`, `AI as a black-box oracle`, `Not brain-training games`, `View intro`) match the JSX exactly.
