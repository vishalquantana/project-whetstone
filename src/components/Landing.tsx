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
