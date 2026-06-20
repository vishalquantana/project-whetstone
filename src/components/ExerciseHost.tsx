import { useStore } from '../store';
import { aiClient } from '../ai/client';
import type { ExerciseModule, RepResult } from '../exercises/types';

interface Props {
  module: ExerciseModule;
  onExit: () => void;
}

/** Wires the store + AI client into an exercise module's Component. */
export function ExerciseHost({ module, onExit }: Props) {
  const recordRep = useStore((s) => s.recordRep);
  const aiMode = useStore((s) => s.settings.aiMode);

  // Demo mode whenever the client isn't ready (no key) or the user picked demo/paid.
  const demoMode = aiMode !== 'byok' || !aiClient.ready;

  function handleComplete(result: RepResult) {
    recordRep(module.id, result);
    onExit();
  }

  const { Component } = module;
  return (
    <Component
      ai={aiClient}
      demoMode={demoMode}
      onComplete={handleComplete}
      onExit={onExit}
    />
  );
}
