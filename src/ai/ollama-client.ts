/**
 * GuardianEye — Ollama Client
 * Streaming fetch client for the local Ollama REST API.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('ollama-client');

// ─── Constants ────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const MODEL = 'llama3.2:3b';
const REQUEST_TIMEOUT_MS = 300_000; // 5 minutes — CPU inference is slow

// ─── Error Types ──────────────────────────────────────────────────────────────

export class OllamaOfflineError extends Error {
  constructor(cause?: unknown) {
    super('Ollama is offline or not reachable at http://127.0.0.1:11434');
    this.name = 'OllamaOfflineError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export class OllamaModelError extends Error {
  constructor(model: string, cause?: unknown) {
    super(`Ollama model "${model}" is not available. Run: ollama pull ${model}`);
    this.name = 'OllamaModelError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

// ─── Ollama API Types ─────────────────────────────────────────────────────────

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveModel(): Promise<string> {
  // Quick connectivity check to Ollama
  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/tags`,
      { method: 'GET' },
      5_000
    );
    if (!response.ok) throw new OllamaOfflineError();
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name);
    // Accept both "llama3.2:3b" and "llama3.2" prefixes
    const found = names.find(
      (n) => n === MODEL || n.startsWith('llama3.2')
    );
    if (!found) {
      throw new OllamaModelError(MODEL);
    }
    log.info(`Using Ollama model: ${found}`);
    return found;
  } catch (err) {
    if (err instanceof OllamaOfflineError || err instanceof OllamaModelError) throw err;
    throw new OllamaOfflineError(err);
  }
}

// ─── Streaming Response ───────────────────────────────────────────────────────

export async function streamResponse(
  prompt: string,
  onToken: (token: string) => void
): Promise<string> {
  log.debug('Starting stream request to Ollama');

  let model: string;
  try {
    model = await resolveModel();
  } catch (err) {
    throw err instanceof OllamaOfflineError || err instanceof OllamaModelError
      ? err
      : new OllamaOfflineError(err);
  }

  const requestBody: OllamaGenerateRequest = {
    model,
    prompt,
    stream: true,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 300, // ~76s at 3.94 t/s — keeps response fast on CPU
    },
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OllamaOfflineError(new Error('Request timed out'));
    }
    throw new OllamaOfflineError(err);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    if (response.status === 404) throw new OllamaModelError(model);
    throw new OllamaOfflineError(new Error(`HTTP ${response.status}: ${text}`));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new OllamaOfflineError(new Error('Response body is null'));

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as OllamaStreamChunk;
          if (parsed.response) {
            onToken(parsed.response);
            accumulated += parsed.response;
          }
          if (parsed.done) {
            log.debug('Stream complete', { evalCount: parsed.eval_count });
          }
        } catch {
          // Partial line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  log.info(`Stream complete — ${accumulated.length} chars received`);
  return accumulated;
}

// ─── Non-Streaming Response ───────────────────────────────────────────────────

export async function generateResponse(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  log.debug('Starting non-streaming request to Ollama');

  let model: string;
  try {
    model = await resolveModel();
  } catch (err) {
    throw err instanceof OllamaOfflineError || err instanceof OllamaModelError
      ? err
      : new OllamaOfflineError(err);
  }

  const requestBody: OllamaGenerateRequest = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      top_p: 0.9,
      num_predict: options.maxTokens ?? 300,
    },
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    log.error('Fetch failed for generateResponse', err);
    throw new OllamaOfflineError(err);
  }

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// ─── Non-streaming (for JSON responses) ──────────────────────────────────────

export async function fetchResponse(prompt: string): Promise<string> {
  log.debug('Starting non-stream request to Ollama');

  let model: string;
  try {
    model = await resolveModel();
  } catch (err) {
    throw err instanceof OllamaOfflineError || err instanceof OllamaModelError
      ? err
      : new OllamaOfflineError(err);
  }

  const requestBody: OllamaGenerateRequest = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 256, // keep attacker JSON short and fast
    },
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OllamaOfflineError(new Error('Request timed out'));
    }
    throw new OllamaOfflineError(err);
  }

  if (!response.ok) {
    if (response.status === 404) throw new OllamaModelError(model);
    const text = await response.text().catch(() => response.statusText);
    throw new OllamaOfflineError(new Error(`HTTP ${response.status}: ${text}`));
  }

  const data = (await response.json()) as { response?: string };
  const result = data.response ?? '';

  log.info(`Non-stream complete — ${result.length} chars received`);
  return result;
}
