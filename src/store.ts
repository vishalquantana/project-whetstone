import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RepResult } from './exercises/types';

export type ExerciseId = 'spar' | 'read-retain' | 'counter-prompting';
export type AiMode = 'byok' | 'paid' | 'demo';

export interface Settings {
  aiMode: AiMode;
  apiKey: string;
}

export interface HistoryEntry extends RepResult {
  exerciseId: ExerciseId;
  timestamp: number;
}

export interface WhetstoneState {
  cognitiveScore: number;
  streak: number;
  lastRepDate: string | null; // YYYY-MM-DD of the last day any rep was recorded
  repsToday: ExerciseId[]; // exercise ids completed on lastRepDate
  history: HistoryEntry[];
  settings: Settings;

  recordRep: (exerciseId: ExerciseId, result: RepResult) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetData: () => void;
}

/** Local date as YYYY-MM-DD (not UTC, so "today" matches the user's wall clock). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isYesterday(prev: string, today: string): boolean {
  const p = new Date(prev + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diff = Math.round((t.getTime() - p.getTime()) / 86_400_000);
  return diff === 1;
}

const initial = {
  cognitiveScore: 0,
  streak: 0,
  lastRepDate: null as string | null,
  repsToday: [] as ExerciseId[],
  history: [] as HistoryEntry[],
  settings: { aiMode: 'demo' as AiMode, apiKey: '' },
};

export const useStore = create<WhetstoneState>()(
  persist(
    (set) => ({
      ...initial,

      recordRep: (exerciseId, result) =>
        set((state) => {
          const today = todayKey();
          const isNewDay = state.lastRepDate !== today;

          let streak = state.streak;
          let repsToday = state.repsToday;

          if (isNewDay) {
            // First rep of a new day: bump or reset the streak.
            if (state.lastRepDate && isYesterday(state.lastRepDate, today)) {
              streak = state.streak + 1;
            } else {
              streak = 1; // streak start (or restart after a gap)
            }
            repsToday = [exerciseId];
          } else if (!repsToday.includes(exerciseId)) {
            repsToday = [...repsToday, exerciseId];
          }

          const entry: HistoryEntry = {
            ...result,
            exerciseId,
            timestamp: Date.now(),
          };

          return {
            cognitiveScore: state.cognitiveScore + result.scoreDelta,
            streak,
            lastRepDate: today,
            repsToday,
            history: [...state.history, entry],
          };
        }),

      setSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      resetData: () => set({ ...initial, settings: { aiMode: 'demo', apiKey: '' } }),
    }),
    {
      name: 'whetstone',
      version: 1,
    }
  )
);

/** Reps done today, accounting for a date rollover since the last recorded rep. */
export function repsDoneToday(state: WhetstoneState): ExerciseId[] {
  return state.lastRepDate === todayKey() ? state.repsToday : [];
}
