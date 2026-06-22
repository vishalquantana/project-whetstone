import { useState } from 'react';
import { Today } from './components/Today';
import { Settings } from './components/Settings';
import { ExerciseHost } from './components/ExerciseHost';
import { getExercise } from './exercises/registry';
import type { ExerciseModule } from './exercises/types';
import { useStore } from './store';
import { Landing } from './components/Landing';

type Tab = 'today' | ExerciseModule['id'] | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◎' },
  { id: 'spar', label: 'Spar', icon: '🥊' },
  { id: 'read-retain', label: 'Read', icon: '🧠' },
  { id: 'counter-prompting', label: 'Counter', icon: '🔎' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');

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

  const activeExercise =
    tab === 'spar' || tab === 'read-retain' || tab === 'counter-prompting'
      ? getExercise(tab)
      : undefined;

  const dark = activeExercise?.theme === 'dark';

  return (
    <div className={`app${dark ? ' theme-dark' : ''}`}>
      <main className="app-main">
        {tab === 'today' && <Today onOpen={(id) => setTab(id)} />}
        {tab === 'settings' && <Settings />}
        {activeExercise && (
          <ExerciseHost
            key={activeExercise.id}
            module={activeExercise}
            onExit={() => setTab('today')}
          />
        )}
      </main>

      <nav className="tabnav" aria-label="Main navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
          >
            <span className="tabicon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
