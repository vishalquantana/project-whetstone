import { useMemo, useRef, useState } from 'react';
import type { ExerciseModule, ExerciseProps, RepResult } from '../types';
import './spar.css';

const TITLE = 'Spar';
const BLURB =
  'Build and defend an argument against a Socratic adversary. Commit your own take before the AI is unlocked — then it argues back, but never hands you the answer.';

/** Rounds of adversarial back-and-forth before the verdict. */
const ROUNDS = 3;
/** The lock: the opening position must clear this word count before sparring. */
const MIN_WORDS = 12;

/** The rigid system prompt — the adversary challenges, it NEVER answers. */
const ADVERSARY_SYSTEM = [
  'You are a Socratic sparring partner in a cognitive-fitness app. The user is defending',
  'a position on a debatable claim. Your ONLY job is to make them think harder.',
  'STRICT RULES — never break them:',
  '1. NEVER state your own conclusion, opinion, or "the right answer".',
  '2. NEVER do the user\'s reasoning for them or supply facts/evidence to use.',
  '3. Reply with ONE sharp move: a probing question, a counter-example to weigh,',
  '   a demand for evidence, or an exposed hidden assumption.',
  '4. Be terse and pointed (2-4 sentences). Adversarial but respectful — no insults.',
  '5. Do not summarise their argument back to them; press on its weakest joint.',
  'Output only your challenge — no preamble, no "great point", no meta commentary.',
].join(' ');

const VERDICT_SYSTEM = [
  'You are judging a sparring match in a cognitive-fitness app. You will receive the',
  'claim, the user\'s opening position, and their rebuttals to challenges.',
  'Score the USER\'s argumentation on three axes, each 0-10 (integers):',
  '- rigor: logical structure, internal consistency, precision.',
  '- evidence: use of concrete support, examples, data, or sound reasoning.',
  '- counters: how well they anticipated/handled opposing points.',
  'Also name the single weakest link in their case in one blunt sentence (no fix, just the flaw).',
  'Do NOT argue your own position. Reply ONLY with JSON:',
  '{"rigor":n,"evidence":n,"counters":n,"weakest":"..."}',
].join(' ');

interface Verdict {
  rigor: number;
  evidence: number;
  counters: number;
  weakest: string;
}

/** Scripted fallback so the exercise works with no API key. */
const DEMO_CLAIM =
  'Remote work makes most knowledge teams more productive than working in an office.';
const DEMO_CHALLENGES = [
  'Productive by whose measure? If you mean output-per-hour, how would you separate the effect of remote work from the kind of people who self-select into it?',
  'Grant the productivity bump for individual tasks. What happens to the work that depends on unplanned collision — mentoring juniors, debugging across teams, early-stage ideation?',
  'You lean on autonomy. Name the case that would change your mind: what evidence, if you found it, would make you concede the office wins?',
];
const DEMO_VERDICT: Verdict = {
  rigor: 7,
  evidence: 5,
  counters: 6,
  weakest:
    'You assert a productivity gain but never define the metric or isolate it from selection effects.',
};

type Phase = 'commit' | 'spar' | 'verdict';

interface Turn {
  who: 'you' | 'foe';
  text: string;
}

function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

function pickDailyClaim(): string {
  // Deterministic per-day so a session always sees the same claim.
  const claims = [
    'Remote work makes most knowledge teams more productive than working in an office.',
    'Universal basic income would do more good than harm in wealthy economies.',
    'Standardised testing should be abolished in secondary schools.',
    'Social media has been a net negative for democratic discourse.',
    'Most people would be happier working four days a week for the same pay.',
    'Nuclear power is essential to any realistic plan to decarbonise.',
    'Reading fiction makes you a better decision-maker than reading non-fiction.',
  ];
  const day = Math.floor(Date.now() / 86_400_000);
  return claims[day % claims.length];
}

const SparComponent: React.FC<ExerciseProps> = ({ ai, demoMode, onComplete, onExit }) => {
  const claim = useMemo(() => (demoMode ? DEMO_CLAIM : pickDailyClaim()), [demoMode]);

  const [phase, setPhase] = useState<Phase>('commit');
  const [round, setRound] = useState(0); // 0-indexed; which challenge we're on
  const [thread, setThread] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // Keep the user's own arguments so the verdict can score the whole case.
  const positionRef = useRef('');
  const rebuttalsRef = useRef<string[]>([]);

  const words = wordCount(draft);
  const locked = phase === 'commit' && words < MIN_WORDS;

  /** Build the adversary's next challenge from the running transcript. */
  async function nextChallenge(transcript: Turn[]): Promise<string> {
    if (demoMode || !ai.ready) {
      const idx = transcript.filter((t) => t.who === 'foe').length;
      return DEMO_CHALLENGES[Math.min(idx, DEMO_CHALLENGES.length - 1)];
    }
    const convo = transcript
      .map((t) => `${t.who === 'you' ? 'DEFENDER' : 'ADVERSARY'}: ${t.text}`)
      .join('\n\n');
    return ai.complete({
      system: ADVERSARY_SYSTEM,
      user: `CLAIM: ${claim}\n\n${convo}\n\nGive your next challenge to the DEFENDER.`,
      maxTokens: 300,
    });
  }

  /** Phase 1 → 2: lock the opening position, get the first challenge. */
  async function handleCommit() {
    if (locked || busy) return;
    setError(null);
    const position = draft.trim();
    positionRef.current = position;
    const opening: Turn[] = [{ who: 'you', text: position }];
    setThread(opening);
    setDraft('');
    setBusy(true);
    try {
      const challenge = await nextChallenge(opening);
      setThread([...opening, { who: 'foe', text: challenge }]);
      setPhase('spar');
      setRound(0);
    } catch (e) {
      // Don't lose their input — restore the draft and stay on commit.
      setDraft(position);
      setThread([]);
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  /** Phase 2: send a rebuttal; either get the next challenge or trigger the verdict. */
  async function handleRebuttal() {
    if (busy) return;
    const reply = draft.trim();
    if (!reply) return;
    setError(null);
    rebuttalsRef.current = [...rebuttalsRef.current, reply];
    const withReply: Turn[] = [...thread, { who: 'you', text: reply }];
    setThread(withReply);
    setDraft('');
    setBusy(true);

    const isLastRound = round + 1 >= ROUNDS;
    try {
      if (isLastRound) {
        const v = await getVerdict();
        setVerdict(v);
        setPhase('verdict');
      } else {
        const challenge = await nextChallenge(withReply);
        setThread([...withReply, { who: 'foe', text: challenge }]);
        setRound(round + 1);
      }
    } catch (e) {
      // Roll the draft back so nothing is lost; let them retry.
      setDraft(reply);
      rebuttalsRef.current = rebuttalsRef.current.slice(0, -1);
      setThread(thread);
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function getVerdict(): Promise<Verdict> {
    if (demoMode || !ai.ready) return DEMO_VERDICT;
    const rebuttals = rebuttalsRef.current
      .map((r, i) => `REBUTTAL ${i + 1}: ${r}`)
      .join('\n\n');
    const raw = await ai.completeJSON<Partial<Verdict>>({
      system: VERDICT_SYSTEM,
      user: `CLAIM: ${claim}\n\nOPENING POSITION: ${positionRef.current}\n\n${rebuttals}`,
      maxTokens: 300,
    });
    return {
      rigor: clampScore(raw.rigor),
      evidence: clampScore(raw.evidence),
      counters: clampScore(raw.counters),
      weakest:
        typeof raw.weakest === 'string' && raw.weakest.trim()
          ? raw.weakest.trim()
          : 'No single flaw stood out — but the case was never truly tested.',
    };
  }

  function finish() {
    if (!verdict) return;
    const scoreDelta = Math.round((verdict.rigor + verdict.evidence + verdict.counters) / 3);
    const result: RepResult = {
      scoreDelta,
      detail: {
        rigor: verdict.rigor,
        evidence: verdict.evidence,
        counters: verdict.counters,
        weakest: verdict.weakest,
        claim,
        rounds: ROUNDS,
      },
    };
    onComplete(result);
  }

  // ---- render -------------------------------------------------------------

  return (
    <div className="spar">
      <div className="spar-head">
        <div className="eyebrow">Spar · Socratic adversary</div>
        {phase === 'spar' && (
          <div className="spar-round-pips" aria-label={`Round ${round + 1} of ${ROUNDS}`}>
            {Array.from({ length: ROUNDS }).map((_, i) => (
              <span
                key={i}
                className={`spar-pip${i < round ? ' is-done' : ''}${
                  i === round ? ' is-active' : ''
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {demoMode && (
        <p className="mono" style={{ marginTop: 10, fontSize: 11, color: '#8fb8b2' }}>
          DEMO MODE — scripted opponent (no API key set).
        </p>
      )}

      <div className="spar-claim">
        <div className="spar-claim-label">Today&rsquo;s claim</div>
        <div className="spar-claim-text">{claim}</div>
      </div>

      {/* ---- Phase 1: commit your position ---- */}
      {phase === 'commit' && (
        <>
          <p style={{ marginTop: 16, fontSize: 14, color: '#bcd6d1' }}>
            Stake your position before the adversary is unlocked. Say where you stand and why —
            no hedging.
          </p>
          <div className="spar-composer">
            <textarea
              className="ta"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="I think the claim is… because…"
              aria-label="Your opening position"
              autoFocus
            />
            <div className="spar-counter">
              <span className={words >= MIN_WORDS ? 'is-met' : ''}>
                {words} / {MIN_WORDS}+ words
              </span>
              {locked && <span>get sparring locked</span>}
            </div>
          </div>
          {error && (
            <div className="spar-error" role="alert">
              {error}
            </div>
          )}
          <div className="spar-actions">
            <button className="btn" onClick={handleCommit} disabled={locked || busy}>
              {busy ? 'Squaring up…' : 'Get sparring'}
            </button>
            <button className="btn ghost" onClick={onExit} disabled={busy}>
              Back
            </button>
          </div>
        </>
      )}

      {/* ---- Phase 2: the bout ---- */}
      {phase === 'spar' && (
        <>
          <div className="spar-thread">
            {thread.map((t, i) => (
              <div key={i} className={`spar-turn ${t.who === 'you' ? 'is-you' : 'is-foe'}`}>
                <div className="spar-turn-who">
                  {t.who === 'you' ? 'You' : 'Adversary'}
                </div>
                {t.text}
              </div>
            ))}
            {busy && (
              <div className="spar-turn is-foe" aria-live="polite">
                <div className="spar-turn-who">Adversary</div>
                <span className="spar-thinking" aria-label="thinking">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>

          <div className="spar-composer">
            <textarea
              className="ta"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Answer the challenge. Hold your ground or concede ground deliberately."
              aria-label="Your rebuttal"
              disabled={busy}
            />
            <div className="spar-counter">
              <span>{wordCount(draft)} words</span>
              <span>
                Round {round + 1} of {ROUNDS}
              </span>
            </div>
          </div>
          {error && (
            <div className="spar-error" role="alert">
              {error}
            </div>
          )}
          <div className="spar-actions">
            <button
              className="btn"
              onClick={handleRebuttal}
              disabled={busy || !draft.trim()}
            >
              {busy
                ? round + 1 >= ROUNDS
                  ? 'Tallying the bout…'
                  : 'Sending…'
                : round + 1 >= ROUNDS
                  ? 'Land final blow & get scored'
                  : 'Fire back'}
            </button>
            <button className="btn ghost" onClick={onExit} disabled={busy}>
              Leave without scoring
            </button>
          </div>
        </>
      )}

      {/* ---- Phase 3: verdict ---- */}
      {phase === 'verdict' && verdict && (
        <>
          <div className="spar-scores" aria-label="Scorecard">
            {(
              [
                ['Rigor', verdict.rigor],
                ['Evidence', verdict.evidence],
                ['Counters', verdict.counters],
              ] as const
            ).map(([label, val]) => (
              <div className="spar-score-row" key={label}>
                <span className="spar-score-label">{label}</span>
                <span className="spar-score-bar">
                  <i style={{ width: `${val * 10}%` }} />
                </span>
                <span className="spar-score-num">{val}/10</span>
              </div>
            ))}
          </div>

          <div className="spar-weakest">
            <div className="spar-weakest-label">Weakest link</div>
            <div className="spar-weakest-text">{verdict.weakest}</div>
          </div>

          <div className="spar-delta">
            You earned{' '}
            <b>
              +{Math.round((verdict.rigor + verdict.evidence + verdict.counters) / 3)}
            </b>{' '}
            to your cognitive score.
          </div>

          <div className="spacer" />
          <div className="spar-actions">
            <button className="btn" onClick={finish}>
              Bank the rep
            </button>
          </div>
        </>
      )}
    </div>
  );
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'The adversary went quiet. Try that again.';
}

const module: ExerciseModule = {
  id: 'spar',
  title: TITLE,
  blurb: BLURB,
  theme: 'dark',
  Component: SparComponent,
};

export default module;
