import type { ExerciseModule } from './types';
import spar from './spar/index';
import readRetain from './readRetain/index';
import counterPrompting from './counterPrompting/index';

export const exercises: ExerciseModule[] = [spar, readRetain, counterPrompting];

export function getExercise(id: ExerciseModule['id']): ExerciseModule | undefined {
  return exercises.find((e) => e.id === id);
}
