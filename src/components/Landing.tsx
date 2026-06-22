import { useScrollReveal } from './useScrollReveal';
import './Landing.css';

interface Props {
  onEnter: () => void;
}

const RESEARCH = [
  {
    src: 'MIT Media Lab',
    title: 'Your Brain on ChatGPT',
    body: "Over four months, heavy LLM users showed weaker neural connectivity while writing, and 78%+ couldn’t quote their own essays. (Preliminary: n=54, not peer-reviewed.)",
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
  { n: '03', t: 'Score', d: "You're graded on rigor, retention, and errors caught — and shown your weakest link." },
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
          The encouraging part — it's reversible, and it's about <em>how</em> you use AI, not
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
      <ProblemSection />
      <HowSection />
    </div>
  );
}
