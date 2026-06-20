import type React from 'react';

export interface AiClient {
  ready: boolean; // true if an API key is configured
  complete(opts: { system: string; user: string; maxTokens?: number }): Promise<string>;
  completeJSON<T>(opts: { system: string; user: string; maxTokens?: number }): Promise<T>; // parses model JSON, throws on bad JSON
}

export interface RepResult {
  scoreDelta: number;
  detail: Record<string, unknown>;
}

export interface ExerciseProps {
  ai: AiClient;
  demoMode: boolean;
  onComplete: (r: RepResult) => void;
  onExit: () => void;
}

export interface ExerciseModule {
  id: 'spar' | 'read-retain' | 'counter-prompting';
  title: string;
  blurb: string;
  theme: 'dark' | 'light';
  Component: React.FC<ExerciseProps>;
}
