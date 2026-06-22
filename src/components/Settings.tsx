import { useState } from 'react';
import { useStore } from '../store';
import type { AiMode } from '../store';
import './Settings.css';

const MODES: { id: AiMode; label: string; sub: string }[] = [
  { id: 'byok', label: 'Bring your own key', sub: 'Use your own Anthropic API key (stored only on this device).' },
  { id: 'paid', label: 'Paid tier', sub: 'A few dollars a month, no key needed.' },
  { id: 'demo', label: 'Demo', sub: 'Scripted content. No AI calls, no key required.' },
];

export function Settings() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const resetData = useStore((s) => s.resetData);
  const setEntered = useStore((s) => s.setEntered);

  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [saved, setSaved] = useState(false);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function chooseMode(mode: AiMode) {
    if (mode === 'paid') return; // stubbed
    setSettings({ aiMode: mode });
  }

  function saveKey() {
    setSettings({ apiKey: keyDraft.trim(), aiMode: 'byok' });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function onReset() {
    if (window.confirm('Reset all data? This clears your score, streak, and history.')) {
      resetData();
      setKeyDraft('');
    }
  }

  return (
    <div className="settings">
      <div className="eyebrow">Settings</div>
      <h2 className="grotesk settings-title">AI mode</h2>

      <div className="mode-list">
        {MODES.map((m) => {
          const active = settings.aiMode === m.id;
          const disabled = m.id === 'paid';
          return (
            <button
              key={m.id}
              className={`mode-row${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => chooseMode(m.id)}
              aria-pressed={active}
              disabled={disabled}
            >
              <span className={`radio${active ? ' on' : ''}`} aria-hidden="true" />
              <span className="mode-txt">
                <b className="grotesk">{m.label}</b>
                <small>{m.sub}</small>
              </span>
            </button>
          );
        })}
      </div>

      {settings.aiMode === 'byok' && (
        <div className="card byok-card">
          <label className="byok-label mono" htmlFor="apikey">
            Anthropic API key
          </label>
          <input
            id="apikey"
            className="input"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <button className="btn" style={{ marginTop: 12 }} onClick={saveKey}>
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          <p className="byok-note mono">
            Stored in this browser only. Calls go directly from your device to Anthropic.
          </p>
        </div>
      )}

      <div className="card paid-card">
        <b className="grotesk">Paid tier</b>
        <p className="paid-note">
          Coming soon, needs a backend. A few dollars a month, no API key required.
        </p>
        <button className="btn" disabled>
          Subscribe (coming soon)
        </button>
      </div>

      <div className="card note-card">
        <b className="grotesk">Motion</b>
        <p className="paid-note">
          {prefersReducedMotion
            ? 'Reduced motion is on — animations are minimised to match your system setting.'
            : 'Whetstone respects your system "reduce motion" setting automatically.'}
        </p>
      </div>

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
    </div>
  );
}
