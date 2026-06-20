import type { ExerciseProps } from './types';

interface Props extends ExerciseProps {
  title: string;
  blurb: string;
}

/**
 * Shared placeholder so the app builds before the real exercise
 * implementations land. Renders a titled card with Start / Exit.
 */
export function PlaceholderExercise({ title, blurb, demoMode, onComplete, onExit }: Props) {
  return (
    <>
      <div className="eyebrow">Exercise · placeholder</div>
      <h2
        className="grotesk"
        style={{ fontSize: 26, letterSpacing: '-0.02em', marginTop: 12 }}
      >
        {title}
      </h2>
      <p style={{ marginTop: 12, color: 'var(--graphite)' }}>{blurb}</p>
      {demoMode && (
        <p className="mono" style={{ marginTop: 16, fontSize: 12, color: 'var(--graphite-2)' }}>
          DEMO MODE — scripted content (no API key set).
        </p>
      )}
      <div className="spacer" />
      <button className="btn" onClick={() => onComplete({ scoreDelta: 5, detail: {} })}>
        Start (placeholder rep)
      </button>
      <button className="btn ghost" onClick={onExit}>
        Back
      </button>
    </>
  );
}
