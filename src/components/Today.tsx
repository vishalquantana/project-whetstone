import { useStore, repsDoneToday } from '../store';
import { exercises } from '../exercises/registry';
import type { ExerciseId } from '../store';
import type { ExerciseModule } from '../exercises/types';
import './Today.css';

interface Props {
  onOpen: (id: ExerciseModule['id']) => void;
}

const ICONS: Record<ExerciseId, string> = {
  spar: '🥊',
  'read-retain': '🧠',
  'counter-prompting': '🔎',
};

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export function Today({ onOpen }: Props) {
  const cognitiveScore = useStore((s) => s.cognitiveScore);
  const streak = useStore((s) => s.streak);
  const done = useStore((s) => repsDoneToday(s));

  const total = exercises.length;
  const completed = done.length;

  // SVG ring geometry (r = 52, viewBox 120)
  const r = 52;
  const circumference = 2 * Math.PI * r; // ~326.7
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="today">
      <div className="today-head">
        <div>
          <div className="home-hi grotesk">{greeting()}</div>
          <div className="home-sub mono">
            {streak > 0 ? `Day ${streak} · keep the edge` : 'Start your streak today'}
          </div>
        </div>
        <span className="streak mono">
          <span aria-hidden="true">🔥</span> {streak}
        </span>
      </div>

      <div className="ring-wrap" role="img" aria-label={`${completed} of ${total} reps done today`}>
        <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r={r} />
          <circle
            className="ring-fill"
            cx="60"
            cy="60"
            r={r}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="ring-center">
          <b className="grotesk">
            {completed}/{total}
          </b>
          <span className="mono">reps today</span>
        </div>
      </div>

      <div className="score-block">
        <div className="score-num grotesk">{cognitiveScore}</div>
        <div className="score-lab mono">Cognitive score</div>
      </div>

      <div className="eyebrow" style={{ marginTop: 8 }}>
        Today's training
      </div>

      {exercises.map((ex) => {
        const isDone = done.includes(ex.id);
        return (
          <button
            key={ex.id}
            className={`exrow${isDone ? ' done' : ''}`}
            onClick={() => onOpen(ex.id)}
            aria-label={`${ex.title} — ${isDone ? 'done' : 'due'}`}
          >
            <span className="exico" aria-hidden="true">
              {ICONS[ex.id]}
            </span>
            <span className="extxt">
              <b className="grotesk">{ex.title}</b>
              <small>{isDone ? 'Done — back tomorrow' : ex.blurb}</small>
            </span>
            {isDone ? (
              <span className="exstatus" aria-hidden="true">
                ✓
              </span>
            ) : (
              <span className="exchev" aria-hidden="true">
                ›
              </span>
            )}
          </button>
        );
      })}

      <div className="spacer" />
      <div className="home-foot mono">Three reps a day keeps the muscle.</div>
    </div>
  );
}
