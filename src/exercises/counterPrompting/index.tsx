import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExerciseModule, ExerciseProps, RepResult } from '../types';
import './counterPrompting.css';

const TITLE = 'Counter-Prompting';
const BLURB =
  'The AI hands you a confident answer with one buried flaw. Find it before the clock runs out, then write the correction. The machine judges your catch — it never tells you the answer up front.';

const TIME_LIMIT = 60; // seconds

type FlawType = 'logical' | 'factual' | 'syntax';

interface Challenge {
  question: string;
  flawedAnswer: string;
  flawType: FlawType;
  theFlaw: string;
  fix: string;
}

interface Judgement {
  caught: boolean;
  confidence: number; // 0-10, how well they identified it
  verdict: string; // one or two terse sentences
}

type Phase = 'intro' | 'loading' | 'error' | 'solving' | 'judging' | 'result';

/* ---------------------------------------------------------------- */
/* Demo content — scripted flawed answers, rotated per rep          */
/* ---------------------------------------------------------------- */

const DEMO_CHALLENGES: Challenge[] = [
  {
    question: 'A company grew revenue 50% one year, then fell 50% the next. What is the net change over the two years?',
    flawedAnswer:
      'The two moves cancel out exactly. A 50% gain followed by a 50% loss returns the company to its original revenue, so the net change over the two years is 0%.',
    flawType: 'logical',
    theFlaw:
      'Percentage gains and losses are not symmetric. +50% then −50% multiplies the original by 1.5 × 0.5 = 0.75, a net decline of 25% — not zero.',
    fix: 'Net change = (1 + 0.50) × (1 − 0.50) − 1 = −0.25, i.e. revenue ends 25% below where it started.',
  },
  {
    question: 'In what year did the Berlin Wall fall, and how long had it stood?',
    flawedAnswer:
      'The Berlin Wall fell in 1989, having stood since it was built in 1949 — so it divided the city for almost exactly 40 years.',
    flawType: 'factual',
    theFlaw:
      'The Wall was built in 1961, not 1949 (1949 is when East and West Germany were founded). It therefore stood for about 28 years, not 40.',
    fix: 'The Berlin Wall was erected in 1961 and fell in 1989 — it stood for roughly 28 years.',
  },
  {
    question: 'Write a JavaScript function that returns the sum of an array of numbers.',
    flawedAnswer:
      'function sum(arr) {\n  return arr.reduce((total, n) => total + n);\n}\n\n// sum([]) safely returns 0 for an empty array.',
    flawType: 'syntax',
    theFlaw:
      'reduce() with no initial value throws "Reduce of empty array with no initial value" on an empty array — it does NOT return 0. The claim in the comment is false.',
    fix: 'Provide the initial accumulator: arr.reduce((total, n) => total + n, 0). Now sum([]) correctly returns 0.',
  },
  {
    question: 'If a test has 95% accuracy and 1% of people have a rare disease, is a positive result very likely to be correct?',
    flawedAnswer:
      'Yes. With 95% accuracy, a positive test result is correct about 95% of the time, so you can be highly confident the person has the disease.',
    flawType: 'logical',
    theFlaw:
      'This ignores base rates. With 1% prevalence, false positives from the 99% healthy majority swamp the true positives, so a positive is correct far less than 95% of the time (often well under 20%).',
    fix: 'Apply Bayes’ theorem: P(disease | positive) depends on prevalence, not just accuracy. At 1% prevalence and 5% false-positive rate, the answer is roughly 16%, not 95%.',
  },
];

const FLAW_LABEL: Record<FlawType, string> = {
  logical: 'Logical flaw',
  factual: 'Factual error',
  syntax: 'Syntax / code bug',
};

/* ---------------------------------------------------------------- */
/* Scoring                                                          */
/* ---------------------------------------------------------------- */

// Heuristic offline grader for demo mode (no AI). Looks for overlap with
// the real flaw's key terms — generous but not a giveaway.
function gradeOffline(challenge: Challenge, whatsWrong: string): Judgement {
  const text = whatsWrong.toLowerCase();
  const source = `${challenge.theFlaw} ${challenge.flawType}`.toLowerCase();
  const keyTerms = source
    .replace(/[^a-z0-9\s%]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const unique = Array.from(new Set(keyTerms));
  const hits = unique.filter((w) => text.includes(w)).length;
  const ratio = unique.length ? hits / unique.length : 0;
  const enough = whatsWrong.trim().length >= 12;
  const caught = enough && (ratio >= 0.18 || hits >= 3);
  const confidence = Math.max(0, Math.min(10, Math.round(ratio * 22) + (enough ? 1 : 0)));
  return {
    caught,
    confidence,
    verdict: caught
      ? 'You located the flaw. The reasoning holds.'
      : 'That misses the core defect. Read the reveal and re-run the logic.',
  };
}

function computeScore(judgement: Judgement, secondsLeft: number): number {
  if (!judgement.caught) return 1; // showing up still counts a little
  const base = 5;
  const quality = Math.round((judgement.confidence / 10) * 3); // 0..3
  const speedBonus = Math.round((secondsLeft / TIME_LIMIT) * 4); // 0..4 for speed
  return base + quality + speedBonus;
}

/* ---------------------------------------------------------------- */
/* Component                                                        */
/* ---------------------------------------------------------------- */

const CounterPromptingComponent: React.FC<ExerciseProps> = ({
  ai,
  demoMode,
  onComplete,
  onExit,
}) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [errorMsg, setErrorMsg] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT);
  const [frozenSeconds, setFrozenSeconds] = useState(0); // time left at submit
  const [whatsWrong, setWhatsWrong] = useState('');
  const [correction, setCorrection] = useState('');
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [scoreDelta, setScoreDelta] = useState(0);

  const demoIndexRef = useRef(Math.floor(Math.random() * DEMO_CHALLENGES.length));
  const tickRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /* ---- generate a challenge ---- */
  const startChallenge = useCallback(async () => {
    setErrorMsg('');
    setWhatsWrong('');
    setCorrection('');
    setJudgement(null);
    setScoreDelta(0);
    setSecondsLeft(TIME_LIMIT);

    if (demoMode || !ai.ready) {
      const idx = demoIndexRef.current % DEMO_CHALLENGES.length;
      demoIndexRef.current = idx + 1;
      setChallenge(DEMO_CHALLENGES[idx]);
      setPhase('solving');
      return;
    }

    setPhase('loading');
    try {
      const result = await ai.completeJSON<Challenge>({
        system:
          'You design counter-prompting drills. Produce a plausible, confident-sounding answer to a question that contains EXACTLY ONE subtle flaw — logical, factual, or a code/syntax bug. The flaw must be real but easy to miss on a quick read; everything else must be correct. Never flag or hint at the flaw inside the answer itself. Reply ONLY with minified JSON of shape {"question":string,"flawedAnswer":string,"flawType":"logical"|"factual"|"syntax","theFlaw":string,"fix":string}. theFlaw explains what is wrong; fix gives the corrected version. Keep question and flawedAnswer under 90 words each.',
        user:
          'Generate one fresh drill. Vary the domain (math, science, history, programming, economics, everyday reasoning). Make the flaw genuinely subtle.',
        maxTokens: 700,
      });
      if (
        !result?.question ||
        !result?.flawedAnswer ||
        !result?.theFlaw ||
        !result?.fix
      ) {
        throw new Error('incomplete');
      }
      setChallenge({
        ...result,
        flawType: (['logical', 'factual', 'syntax'] as FlawType[]).includes(result.flawType)
          ? result.flawType
          : 'logical',
      });
      setPhase('solving');
    } catch {
      setErrorMsg('The drill generator did not respond. Try again, or run a demo drill.');
      setPhase('error');
    }
  }, [ai, demoMode]);

  /* ---- countdown ---- */
  useEffect(() => {
    if (phase !== 'solving') {
      clearTimer();
      return;
    }
    clearTimer();
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, clearTimer]);

  const timeUp = phase === 'solving' && secondsLeft === 0;

  /* ---- submit for judgement ---- */
  const submit = useCallback(async () => {
    if (!challenge) return;
    clearTimer();
    const captured = secondsLeft;
    setFrozenSeconds(captured);

    if (demoMode || !ai.ready) {
      const j = gradeOffline(challenge, whatsWrong);
      const delta = computeScore(j, captured);
      setJudgement(j);
      setScoreDelta(delta);
      setPhase('result');
      return;
    }

    setPhase('judging');
    try {
      const j = await ai.completeJSON<Judgement>({
        system:
          'You are a strict but fair judge of counter-prompting. You are given a question, a flawed answer, the true flaw, and a learner’s critique. Decide whether the learner identified the SAME core flaw (wording may differ). Do NOT reward vague or generic complaints. Reply ONLY with minified JSON {"caught":boolean,"confidence":number(0-10),"verdict":string}. confidence = how clearly they pinned the real flaw. verdict = one or two terse sentences, no apologies, never reveal the fix.',
        user: JSON.stringify({
          question: challenge.question,
          flawedAnswer: challenge.flawedAnswer,
          theFlaw: challenge.theFlaw,
          flawType: challenge.flawType,
          learnerCritique: whatsWrong,
          learnerCorrection: correction,
        }),
        maxTokens: 300,
      });
      const safe: Judgement = {
        caught: Boolean(j?.caught),
        confidence: Math.max(0, Math.min(10, Number(j?.confidence) || 0)),
        verdict:
          typeof j?.verdict === 'string' && j.verdict.trim()
            ? j.verdict.trim()
            : j?.caught
              ? 'Flaw identified.'
              : 'That is not the core flaw.',
      };
      const delta = computeScore(safe, captured);
      setJudgement(safe);
      setScoreDelta(delta);
      setPhase('result');
    } catch {
      // Never lose the user's work — fall back to the offline grader.
      const j = gradeOffline(challenge, whatsWrong);
      const delta = computeScore(j, captured);
      setJudgement(j);
      setScoreDelta(delta);
      setPhase('result');
    }
  }, [ai, challenge, clearTimer, correction, demoMode, secondsLeft, whatsWrong]);

  const finish = useCallback(() => {
    if (!judgement) return;
    const result: RepResult = {
      scoreDelta,
      detail: {
        caught: judgement.caught,
        confidence: judgement.confidence,
        flawType: challenge?.flawType ?? 'unknown',
        secondsLeft: frozenSeconds,
      },
    };
    onComplete(result);
  }, [challenge, frozenSeconds, judgement, onComplete, scoreDelta]);

  const canSubmit = whatsWrong.trim().length > 0 && !timeUp;

  /* -------------------------------------------------------------- */
  /* Render                                                         */
  /* -------------------------------------------------------------- */

  // INTRO
  if (phase === 'intro') {
    return (
      <div className="cp">
        <div className="eyebrow">Exercise · counter-prompting</div>
        <h2 className="cp-title grotesk">{TITLE}</h2>
        <p className="cp-blurb">{BLURB}</p>

        <ol className="cp-steps mono">
          <li>The AI states a confident answer with one hidden flaw.</li>
          <li>
            A {TIME_LIMIT}s clock starts. Read fast, think faster.
          </li>
          <li>Say what is wrong and write the correction.</li>
          <li>The AI judges your catch — speed earns bonus points.</li>
        </ol>

        {demoMode && (
          <p className="cp-demo mono">DEMO MODE — scripted drills (no API key set).</p>
        )}

        <div className="spacer" />
        <button className="btn" onClick={startChallenge}>
          Begin drill
        </button>
        <button className="btn ghost" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  // LOADING
  if (phase === 'loading') {
    return (
      <div className="cp cp-center">
        <div className="eyebrow">Exercise · counter-prompting</div>
        <div className="cp-spinner" aria-hidden="true" />
        <p className="cp-status mono">Forging a flawed answer…</p>
        <div className="spacer" />
        <button className="btn ghost" onClick={onExit}>
          Cancel
        </button>
      </div>
    );
  }

  // ERROR
  if (phase === 'error') {
    return (
      <div className="cp cp-center">
        <div className="eyebrow">Exercise · counter-prompting</div>
        <p className="cp-status">{errorMsg}</p>
        <div className="spacer" />
        <button className="btn" onClick={startChallenge}>
          Retry
        </button>
        <button className="btn ghost" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  // SOLVING
  if (phase === 'solving' && challenge) {
    const pct = (secondsLeft / TIME_LIMIT) * 100;
    const urgent = secondsLeft <= 10;
    return (
      <div className="cp">
        <div className="cp-topbar">
          <div className="eyebrow">Find the flaw</div>
          <div
            className={`cp-timer mono${urgent ? ' cp-timer-urgent' : ''}`}
            role="timer"
            aria-live="off"
          >
            {timeUp ? "TIME" : `0:${String(secondsLeft).padStart(2, '0')}`}
          </div>
        </div>
        <div className="cp-track" aria-hidden="true">
          <div
            className={`cp-track-fill${urgent ? ' cp-track-urgent' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="card cp-question">
          <span className="cp-q-label mono">PROMPT</span>
          <p>{challenge.question}</p>
        </div>

        <div className="card cp-answer">
          <span className="cp-q-label mono">AI ANSWER · trust nothing</span>
          <p className="cp-answer-body">{challenge.flawedAnswer}</p>
        </div>

        <label className="cp-field-label mono" htmlFor="cp-wrong">
          What is wrong?
        </label>
        <textarea
          id="cp-wrong"
          className="ta cp-ta"
          placeholder="Name the flaw precisely — which claim, line, or step breaks?"
          value={whatsWrong}
          onChange={(e) => setWhatsWrong(e.target.value)}
          disabled={timeUp}
        />

        <label className="cp-field-label mono" htmlFor="cp-fix">
          Your correction <span className="cp-optional">(optional)</span>
        </label>
        <textarea
          id="cp-fix"
          className="ta cp-ta cp-ta-short"
          placeholder="Rewrite the answer or prompt so it is right."
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          disabled={timeUp}
        />

        {timeUp && (
          <p className="cp-status cp-timeup mono">
            Clock done. Submit what you have.
          </p>
        )}

        <div className="spacer" />
        <button className="btn" onClick={submit} disabled={!canSubmit && !timeUp}>
          {timeUp ? 'Submit (time up)' : 'Lock in answer'}
        </button>
        <button className="btn ghost" onClick={onExit}>
          Abandon drill
        </button>
      </div>
    );
  }

  // JUDGING
  if (phase === 'judging') {
    return (
      <div className="cp cp-center">
        <div className="eyebrow">Counter-prompting</div>
        <div className="cp-spinner" aria-hidden="true" />
        <p className="cp-status mono">Weighing your catch…</p>
      </div>
    );
  }

  // RESULT
  if (phase === 'result' && challenge && judgement) {
    return (
      <div className="cp">
        <div className="eyebrow">{judgement.caught ? 'Caught' : 'Missed'}</div>
        <h2 className="cp-title grotesk">
          {judgement.caught ? 'You caught it.' : 'It slipped past.'}
        </h2>

        <div className={`cp-score${judgement.caught ? ' cp-score-win' : ''}`}>
          <span className="cp-score-num grotesk">+{scoreDelta}</span>
          <span className="cp-score-label mono">
            {judgement.caught
              ? `clarity ${judgement.confidence}/10 · ${frozenSeconds}s left`
              : 'partial credit'}
          </span>
        </div>

        <p className="cp-verdict">{judgement.verdict}</p>

        <div className="card cp-reveal">
          <span className="cp-reveal-tag mono">{FLAW_LABEL[challenge.flawType]}</span>
          <h3 className="cp-reveal-h grotesk">The flaw</h3>
          <p>{challenge.theFlaw}</p>
          <h3 className="cp-reveal-h grotesk">The fix</h3>
          <p>{challenge.fix}</p>
        </div>

        <div className="spacer" />
        <button className="btn" onClick={finish}>
          Save rep
        </button>
        <button className="btn ghost" onClick={startChallenge}>
          Another drill (don’t save)
        </button>
      </div>
    );
  }

  return null;
};

const exerciseModule: ExerciseModule = {
  id: 'counter-prompting',
  title: TITLE,
  blurb: BLURB,
  theme: 'light',
  Component: CounterPromptingComponent,
};

export default exerciseModule;
