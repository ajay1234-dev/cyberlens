/**
 * GuardianEye — Dynamic AI Threat Analyzer
 * Uses the local Ollama LLM to dynamically score the risk of a page based on its content.
 */

import { generateResponse } from '@/ai/ollama-client';
import { createLogger } from '@/utils/logger';


const log = createLogger('ai-threat-analyzer');

export interface AiThreatResult {
  score: number;       // 0 to 100 deduction (100 = highly malicious)
  reason: string;
  isMalicious: boolean;
}

export async function analyzePageDynamically(url: string, pageText: string): Promise<AiThreatResult> {
  log.info('Running dynamic AI threat analysis on URL:', url);

  const truncatedText = pageText.slice(0, 1500); // Send only enough text for context

  const prompt = `You are a strict cybersecurity scanner. Evaluate if the following webpage is a phishing attack, scam, or malicious site.
URL: ${url}

PAGE CONTENT:
${truncatedText}

Respond ONLY with a valid JSON object in this exact format:
{
  "malicious_score": <number 0 to 100, where 100 is definitely malicious/phishing>,
  "reason": "<short 1 sentence explanation>"
}`;

  try {
    const rawResponse = await generateResponse(prompt, { maxTokens: 100, temperature: 0.1 });
    log.debug('AI dynamic response:', rawResponse);
    
    // Parse JSON from response
    const jsonStr = rawResponse.substring(rawResponse.indexOf('{'), rawResponse.lastIndexOf('}') + 1);
    const result = JSON.parse(jsonStr);

    const score = typeof result.malicious_score === 'number' ? result.malicious_score : 0;
    
    return {
      score,
      reason: result.reason || 'AI dynamic analysis completed',
      isMalicious: score > 75,
    };
  } catch (err) {
    log.error('Dynamic AI analysis failed:', err);
    return { score: 0, reason: 'Analysis failed or offline', isMalicious: false };
  }
}
