import { useMemo, useRef, useState } from 'react';
import type { ExerciseModule, ExerciseProps } from '../types';
import './readRetain.css';

const TITLE = 'Read & Retain';
const BLURB =
  'Read a source, then rebuild its meaning from memory. The AI hands you a summary with the load-bearing terms redacted — and one question only you can answer. Produce before you peek.';

/* ------------------------------------------------------------------ */
/* shape returned by the model / used in demo mode                     */
/* ------------------------------------------------------------------ */

interface RedactionPlan {
  /** Summary text with each redacted term written as "____" (or any run of underscores). */
  redactedSummary: string;
  /** The terms/data that were redacted, in order of appearance. */
  blanks: string[];
  /** A single conceptual micro-question the reader must answer to unlock. */
  question: string;
  /** The idea a correct answer should capture (used to judge recall). */
  expectedIdea: string;
}

interface Judgement {
  /** 0-100 — how well the answer captured the expected idea. */
  capture: number;
  /** One calm line of feedback (no apology, no flattery). */
  note: string;
}

/* ------------------------------------------------------------------ */
/* demo content (used when no API key is configured)                   */
/* ------------------------------------------------------------------ */

const DEMO_ARTICLE = `Spaced repetition is a learning technique that schedules reviews at increasing intervals over time. It exploits the "spacing effect": memories consolidate more durably when study sessions are separated rather than crammed together. Each time you successfully recall an item, the next review is pushed further out; each time you fail, the interval contracts. The act of effortful retrieval — not re-reading — is what strengthens the memory trace, a phenomenon known as the testing effect. Systems like Leitner boxes and algorithms like SM-2 automate this scheduling so that you spend your attention on the items closest to being forgotten.`;

const DEMO_PLAN: RedactionPlan = {
  redactedSummary:
    'A learning method that schedules reviews at ____ intervals. It relies on the ____ effect: memory lasts longer when study is ____ rather than crammed. Successful recall ____ the next interval; failure ____ it. Crucially, the gain comes from effortful ____ — not from re-reading — which is called the ____ effect.',
  blanks: [
    'increasing',
    'spacing',
    'separated',
    'lengthens',
    'shortens',
    'retrieval',
    'testing',
  ],
  question:
    'Why does spaced repetition strengthen memory more than simply re-reading the same material?',
  expectedIdea:
    'Effortful retrieval (actively recalling from memory) consolidates the memory trace far more than passive re-reading; spacing forces retrieval just as forgetting begins, which is the testing/spacing effect.',
};

/* ------------------------------------------------------------------ */
/* prompts                                                             */
/* ------------------------------------------------------------------ */

const REDACT_SYSTEM = `You build active-recall study cards from a source text. You NEVER summarise everything plainly — you deliberately remove the load-bearing concepts so the reader must reconstruct them.

Return ONLY JSON with this exact shape, no prose, no fences:
{
  "redactedSummary": string,   // a 3-6 sentence summary where each key term/figure is replaced by "____" (four underscores). Keep grammar intact around each gap.
  "blanks": string[],          // the removed terms in the SAME order they appear in redactedSummary; one entry per "____"
  "question": string,          // ONE conceptual question that tests understanding, not recall of a single word
  "expectedIdea": string       // the core idea a correct answer must convey (1-2 sentences)
}

Rules:
- Redact 5-8 of the most conceptually important terms or data points. Do NOT redact filler words.
- The number of "____" gaps MUST equal blanks.length.
- The question must require synthesis ("why", "how", "what trade-off"), never "what word is missing".
- Do NOT reveal the answer to the question anywhere in your output except expectedIdea.`;

const JUDGE_SYSTEM = `You judge whether a learner's answer captures a target idea. You are exacting but never cruel, and you never reveal extra information beyond the verdict.

Return ONLY JSON, no prose, no fences:
{ "capture": number, "note": string }

- "capture" is 0-100: how fully the answer conveys the target idea (partial credit allowed for partial understanding).
- "note" is ONE sentence of calm, specific feedback. State what was grasped or missed. Do not apologise, do not flatter, do not add new facts.`;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const GAP_RE = /_{2,}/g;

/** Split a redacted summary into text + gap tokens for rendering chips. */
function tokenizeSummary(summary: string): Array<{ kind: 'text' | 'gap'; value: string; gapIndex?: number }> {
  const out: Array<{ kind: 'text' | 'gap'; value: string; gapIndex?: number }> = [];
  let last = 0;
  let gapIndex = 0;
  let m: RegExpExecArray | null;
  GAP_RE.lastIndex = 0;
  while ((m = GAP_RE.exec(summary)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: summary.slice(last, m.index) });
    out.push({ kind: 'gap', value: '', gapIndex: gapIndex++ });
    last = m.index + m[0].length;
  }
  if (last < summary.length) out.push({ kind: 'text', value: summary.slice(last) });
  return out;
}

/** Reconstruct the clean summary by dropping the blanks back into the gaps. */
function fillSummary(summary: string, blanks: string[]): string {
  let i = 0;
  return summary.replace(GAP_RE, () => blanks[i++] ?? '____');
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'is',
  'are', 'was', 'were', 'be', 'it', 'its', 'that', 'this', 'than', 'then',
  'so', 'for', 'with', 'as', 'by', 'from', 'not', 'no', 'more', 'less',
  'because', 'which', 'when', 'why', 'how', 'what', 'you', 'your', 'we',
]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

/** Offline fallback judge: keyword overlap between answer and expected idea. */
function localJudge(answer: string, expectedIdea: string): Judgement {
  const want = keywords(expectedIdea);
  const got = keywords(answer);
  if (want.size === 0) return { capture: 50, note: 'Recorded — no reference idea was available to compare against.' };
  let hits = 0;
  want.forEach((w) => {
    if (got.has(w)) hits++;
  });
  const capture = Math.round((hits / want.size) * 100);
  const note =
    capture >= 70
      ? 'Strong overlap with the core idea — the load-bearing concepts are present.'
      : capture >= 40
        ? 'Partial — you reached the edges of the idea but left its centre implicit.'
        : 'The central mechanism is missing; compare your answer to the revealed summary.';
  return { capture, note };
}

/** Map a 0-100 capture score to a score delta in the 1-10 range. */
function captureToDelta(capture: number): number {
  return Math.max(1, Math.round((capture / 100) * 10));
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

type Phase = 'paste' | 'recall' | 'revealed';

const ReadRetainComponent: React.FC<ExerciseProps> = ({ ai, demoMode, onComplete, onExit }) => {
  const [phase, setPhase] = useState<Phase>('paste');
  const [article, setArticle] = useState('');
  const [plan, setPlan] = useState<RedactionPlan | null>(null);
  const [answer, setAnswer] = useState('');
  const [judgement, setJudgement] = useState<Judgement | null>(null);

  const [redacting, setRedacting] = useState(false);
  const [judging, setJudging] = useState(false);
  const [redactError, setRedactError] = useState<string | null>(null);
  const [judgeError, setJudgeError] = useState<string | null>(null);

  // captured once so a re-render doesn't double-fire onComplete
  const completedRef = useRef(false);

  const wordCount = useMemo(
    () => (article.trim() ? article.trim().split(/\s+/).length : 0),
    [article]
  );
  const canRedact = wordCount >= 20 && !redacting;

  const tokens = useMemo(
    () => (plan ? tokenizeSummary(plan.redactedSummary) : []),
    [plan]
  );

  /* -- step 2: build the redaction plan -- */
  async function buildPlan() {
    setRedactError(null);
    if (demoMode) {
      setRedacting(true);
      // tiny scripted "thinking" beat so the transition reads intentionally
      setPlan(DEMO_PLAN);
      setPhase('recall');
      setRedacting(false);
      return;
    }
    setRedacting(true);
    try {
      const result = await ai.completeJSON<RedactionPlan>({
        system: REDACT_SYSTEM,
        user: article.trim(),
        maxTokens: 900,
      });
      if (!result.redactedSummary || !Array.isArray(result.blanks) || !result.question) {
        throw new Error('The summary came back incomplete.');
      }
      setPlan(result);
      setPhase('recall');
    } catch (e) {
      setRedactError(e instanceof Error ? e.message : 'The summary could not be built.');
    } finally {
      setRedacting(false);
    }
  }

  /* -- step 3/4: judge the answer, unlock, record -- */
  async function submitAnswer() {
    if (!plan || !answer.trim() || completedRef.current) return;
    setJudgeError(null);
    setJudging(true);

    let verdict: Judgement;
    if (demoMode) {
      verdict = localJudge(answer, plan.expectedIdea);
    } else {
      try {
        const j = await ai.completeJSON<Judgement>({
          system: JUDGE_SYSTEM,
          user: `TARGET IDEA:\n${plan.expectedIdea}\n\nQUESTION:\n${plan.question}\n\nLEARNER ANSWER:\n${answer.trim()}`,
          maxTokens: 256,
        });
        verdict = {
          capture: Math.max(0, Math.min(100, Math.round(Number(j.capture) || 0))),
          note: typeof j.note === 'string' && j.note ? j.note : 'Recorded.',
        };
      } catch {
        // never lose the user's work — fall back to the local judge
        verdict = localJudge(answer, plan.expectedIdea);
        setJudgeError('Scored locally — the AI judge was unreachable.');
      }
    }

    setJudgement(verdict);
    setPhase('revealed');
    setJudging(false);
  }

  /** Reveal has been seen — NOW record the rep and return to Today. */
  function finishRR() {
    if (!plan || !judgement || completedRef.current) return;
    completedRef.current = true;
    onComplete({
      scoreDelta: captureToDelta(judgement.capture),
      detail: {
        capture: judgement.capture,
        blanksTotal: plan.blanks.length,
        wordCount,
        demo: demoMode,
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="rr">
      <div className="eyebrow">Exercise · Read &amp; Retain</div>
      <h2 className="grotesk rr-title">{TITLE}</h2>

      {phase === 'paste' && (
        <>
          <p className="rr-lede">{BLURB}</p>
          {demoMode && (
            <p className="mono rr-demo-tag">DEMO MODE — scripted source & redaction (no API key set).</p>
          )}

          <label className="rr-field-label mono" htmlFor="rr-source">
            SOURCE TEXT
          </label>
          <textarea
            id="rr-source"
            className="ta"
            placeholder="Paste an article, a passage, or something an AI just explained to you…"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
          />

          <div className="rr-row rr-meter">
            <span className="mono">{wordCount} words</span>
            {wordCount > 0 && wordCount < 20 && (
              <span className="mono rr-hint">need ~20+ to redact</span>
            )}
          </div>

          {demoMode && wordCount === 0 && (
            <button
              className="btn ghost rr-inline"
              onClick={() => setArticle(DEMO_ARTICLE)}
            >
              Load the sample passage
            </button>
          )}

          {redactError && <div className="rr-error mono">{redactError}</div>}

          <div className="spacer" />
          <button className="btn" disabled={!canRedact} onClick={buildPlan}>
            {redacting ? 'Redacting the source…' : 'Redact & begin'}
          </button>
          <button className="btn ghost" onClick={onExit} disabled={redacting}>
            Back
          </button>
        </>
      )}

      {phase === 'recall' && plan && (
        <>
          <p className="rr-lede">
            Here is the summary with its load-bearing terms removed. Read it, hold the gaps in
            mind, then answer the question to unlock the clean version.
          </p>

          <div className="card rr-summary" aria-label="Redacted summary">
            <p className="rr-summary-text">
              {tokens.map((t, i) =>
                t.kind === 'text' ? (
                  <span key={i}>{t.value}</span>
                ) : (
                  <span key={i} className="rr-gap mono" aria-label="redacted term">
                    {String((t.gapIndex ?? 0) + 1).padStart(2, '0')}
                  </span>
                )
              )}
            </p>
            <div className="rr-gap-count mono">{plan.blanks.length} terms redacted</div>
          </div>

          <div className="rr-question">
            <div className="mono rr-field-label">THE QUESTION</div>
            <p className="rr-question-text grotesk">{plan.question}</p>
          </div>

          <label className="rr-field-label mono" htmlFor="rr-answer">
            YOUR ANSWER — FROM MEMORY
          </label>
          <textarea
            id="rr-answer"
            className="ta rr-answer-ta"
            placeholder="Reconstruct the idea in your own words. The gap between this and the source is the lesson."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />

          {judgeError && <div className="rr-error mono">{judgeError}</div>}

          <div className="spacer" />
          <button
            className="btn"
            disabled={!answer.trim() || judging}
            onClick={submitAnswer}
          >
            {judging ? 'Weighing your recall…' : 'Unlock the summary'}
          </button>
          <button className="btn ghost" onClick={onExit} disabled={judging}>
            Leave without recording
          </button>
        </>
      )}

      {phase === 'revealed' && plan && judgement && (
        <>
          <div className="rr-verdict card">
            <div className="rr-verdict-head">
              <span className="mono rr-field-label">RECALL</span>
              <span className="grotesk rr-capture">{judgement.capture}%</span>
            </div>
            <div className="rr-meter-bar" aria-hidden="true">
              <span style={{ width: `${judgement.capture}%` }} />
            </div>
            <p className="rr-verdict-note">{judgement.note}</p>
          </div>

          <div className="mono rr-field-label rr-mt">THE CLEAN SUMMARY</div>
          <div className="card rr-clean">
            <p className="rr-summary-text">{fillSummary(plan.redactedSummary, plan.blanks)}</p>
          </div>

          <div className="mono rr-field-label rr-mt">TERMS YOU WOULD HAVE NEEDED</div>
          <div className="rr-blanks">
            {plan.blanks.map((b, i) => (
              <span key={i} className="rr-blank-chip mono">
                <em>{String(i + 1).padStart(2, '0')}</em>
                {b}
              </span>
            ))}
          </div>

          <p className="mono rr-recorded">Rep recorded · +{captureToDelta(judgement.capture)} to your score.</p>

          <div className="spacer" />
          <button className="btn" onClick={finishRR}>
            Done
          </button>
        </>
      )}
    </div>
  );
};

const module: ExerciseModule = {
  id: 'read-retain',
  title: TITLE,
  blurb: BLURB,
  theme: 'light',
  Component: ReadRetainComponent,
};

export default module;
