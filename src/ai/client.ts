import type { AiClient } from '../exercises/types';
import { useStore } from '../store';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const API_VERSION = '2023-06-01';

interface CompleteOpts {
  system: string;
  user: string;
  maxTokens?: number;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string; type?: string };
}

/** Pull readable text out of the Claude messages response. */
function extractText(data: AnthropicResponse): string {
  if (!data.content || !Array.isArray(data.content)) {
    throw new Error('Claude returned an unexpected response shape.');
  }
  return data.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();
}

/** Strip ```json ... ``` (or plain ```) fences a model sometimes wraps JSON in. */
function stripFences(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

async function callClaude(opts: CompleteOpts, apiKey: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
    });
  } catch (e) {
    throw new Error(
      `Network error reaching Claude: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  let data: AnthropicResponse;
  try {
    data = (await res.json()) as AnthropicResponse;
  } catch {
    if (!res.ok) {
      throw new Error(`Claude request failed (HTTP ${res.status}).`);
    }
    throw new Error('Claude returned a response that was not valid JSON.');
  }

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Claude request failed: ${msg}`);
  }

  return extractText(data);
}

/** Read the API key from the store at call time (so a freshly saved key works). */
function currentApiKey(): string {
  const { settings } = useStore.getState();
  return settings.aiMode === 'byok' ? settings.apiKey.trim() : '';
}

export function createAiClient(): AiClient {
  return {
    get ready(): boolean {
      return currentApiKey().length > 0;
    },

    async complete(opts: CompleteOpts): Promise<string> {
      const key = currentApiKey();
      if (!key) {
        throw new Error('No Anthropic API key configured. Add one in Settings or use Demo mode.');
      }
      return callClaude(opts, key);
    },

    async completeJSON<T>(opts: CompleteOpts): Promise<T> {
      const text = await this.complete(opts);
      const cleaned = stripFences(text);
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new Error('Claude did not return valid JSON.');
      }
    },
  };
}

/** Singleton client used across the app. */
export const aiClient: AiClient = createAiClient();
