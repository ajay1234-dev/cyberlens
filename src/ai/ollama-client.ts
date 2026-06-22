/**
 * GuardianEye — Groq API Client (Temporarily replacing Ollama)
 * Streaming fetch client for the Groq REST API.
 */

import { createLogger } from '@/utils/logger';

const log = createLogger('groq-client');

// ─── Constants ────────────────────────────────────────────────────────────────

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'llama3-8b-8192'; // Groq fast model
const REQUEST_TIMEOUT_MS = 60_000;

const getApiKey = () => import.meta.env.VITE_GROQ_API_KEY || '';

// ─── Error Types ──────────────────────────────────────────────────────────────

export class OllamaOfflineError extends Error {
  constructor(cause?: unknown) {
    super('Groq API Error: Check your internet connection or API key');
    this.name = 'GroqApiError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export class OllamaModelError extends Error {
  constructor(model: string, cause?: unknown) {
    super(`Groq model "${model}" is not available`);
    this.name = 'GroqModelError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
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
  if (!getApiKey()) {
    throw new Error('VITE_GROQ_API_KEY is not set in .env');
  }
  return PRIMARY_MODEL;
}

// ─── Streaming Response ───────────────────────────────────────────────────────

export async function streamResponse(
  prompt: string,
  onToken: (token: string) => void
): Promise<string> {
  log.debug('Starting stream request to Groq');

  const model = await resolveModel();
  const requestBody = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      GROQ_BASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify(requestBody),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    throw new OllamaOfflineError(err);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new OllamaOfflineError(new Error(`HTTP ${response.status}: ${errorText}`));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new OllamaOfflineError(new Error('Response body is null'));
  }

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const dataStr = line.replace(/^data: /, '').trim();
        if (dataStr === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            onToken(content);
            accumulated += content;
          }
        } catch {
          // Parse error on partial JSON, skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  log.info(`Stream complete — ${accumulated.length} chars received`);
  return accumulated;
}

// ─── Non-streaming (for JSON responses) ──────────────────────────────────────

export async function fetchResponse(prompt: string): Promise<string> {
  log.debug('Starting non-stream request to Groq');

  const model = await resolveModel();
  const requestBody = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    temperature: 0.2, // Lower temperature for structured JSON
    max_tokens: 1024,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      GROQ_BASE_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify(requestBody),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    throw new OllamaOfflineError(err);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new OllamaOfflineError(new Error(`HTTP ${response.status}: ${errorText}`));
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content ?? '';

  log.info(`Non-stream complete — ${result.length} chars received`);
  return result;
}
