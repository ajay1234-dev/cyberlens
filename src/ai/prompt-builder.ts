/**
 * GuardianEye — Prompt Builder
 * Constructs AI prompts for the Mentor and Attacker-View modes.
 */

import type { RiskReport } from '@/types/risk.types';
import { ThreatLevel, TacticType } from '@/types/risk.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatThreatLevel(level: ThreatLevel): string {
  const labels: Record<ThreatLevel, string> = {
    [ThreatLevel.SAFE]:    'Safe',
    [ThreatLevel.CAUTION]: 'Caution',
    [ThreatLevel.WARNING]: 'Warning',
    [ThreatLevel.DANGER]:  'Danger',
  };
  return labels[level];
}

function formatTactics(tactics: TacticType[]): string {
  if (tactics.length === 0) return 'None detected';
  const labels: Record<TacticType, string> = {
    [TacticType.URGENCY]:  'Urgency (time pressure)',
    [TacticType.FEAR]:     'Fear (account threats, security alerts)',
    [TacticType.SCARCITY]: 'Scarcity (limited stock/availability)',
    [TacticType.REWARD]:   'Reward (prizes, free gifts)',
    [TacticType.PRESSURE]: 'Social pressure (other viewers/buyers)',
  };
  return tactics.map(t => `• ${labels[t]}`).join('\n');
}

function formatSensitiveFields(report: RiskReport): string {
  const uniqueKinds = [...new Set(report.fieldScan.fields.map(f => f.kind))].filter(
    k => k !== 'unknown'
  );
  if (uniqueKinds.length === 0) return 'No sensitive fields detected';
  return uniqueKinds.map(k => `• ${k.replace(/_/g, ' ')}`).join('\n');
}

function formatPermissions(report: RiskReport): string {
  const uniqueKinds = [...new Set(report.permissionScan.requests.map(r => r.kind))];
  if (uniqueKinds.length === 0) return 'No permissions requested';
  return uniqueKinds.map(k => `• ${k}`).join('\n');
}

function formatScoreBreakdown(report: RiskReport): string {
  const b = report.scoreBreakdown;
  const lines: string[] = [
    `  Base score:            100`,
    `  Manipulation deduction: -${b.psychDeduction}`,
    `  Sensitive fields:       -${b.fieldDeduction}`,
    `  Permissions:            -${b.permissionDeduction}`,
    `  Risky downloads:        -${b.downloadDeduction}`,
    `  HTTPS/clean signals:    +${b.httpsBonus}`,
    `  ─────────────────────────`,
    `  Final trust score:       ${b.final}/100`,
  ];
  return lines.join('\n');
}

// ─── Mentor Prompt ────────────────────────────────────────────────────────────

/**
 * Builds the human-friendly mentor analysis prompt.
 * The AI acts as a friendly security advisor explaining risks in plain English.
 */
export function buildMentorPrompt(report: RiskReport): string {
  return `SYSTEM: You are GuardianEye, a friendly and approachable cybersecurity mentor. Your job is to help everyday users understand how a website might be trying to influence, manipulate, collect, or expose their sensitive information. You speak in plain English — no jargon, no technical acronyms, no scare tactics. You are calm, clear, and helpful. You always end with one concrete action the user should take.

ANALYSIS REPORT:
Website: ${report.url}
Trust Score: ${report.trustScore}/100 (${formatThreatLevel(report.threatLevel)})
HTTPS: ${report.isHttps ? 'Yes (encrypted connection)' : 'No (unencrypted — data visible to networks)'}

Score Breakdown:
${formatScoreBreakdown(report)}

Psychological Manipulation Tactics Found:
${formatTactics(report.psychDetection.tactics)}
(${report.psychDetection.instances.length} instance(s) detected on the page)

Sensitive Data Fields:
${formatSensitiveFields(report)}
Forms: ${report.fieldScan.formCount} form(s), High Risk: ${report.fieldScan.highRisk ? 'Yes' : 'No'}

Browser Permissions Requested:
${formatPermissions(report)}

Risky Downloads: ${report.downloadScan.hasRiskyDownload ? 'Yes — suspicious file(s) detected' : 'None'}

Privacy Signals:
• Privacy Policy present: ${report.metaSignals.hasPrivacyPolicy ? 'Yes' : 'No'}
• Contact information: ${report.metaSignals.hasContactInfo ? 'Yes' : 'No'}
• All forms secure: ${report.metaSignals.hasSecureForms ? 'Yes' : 'No'}

USER INSTRUCTION:
Based on the report above, write 3 to 4 short paragraphs in plain English that:
1. Explain what this website appears to be doing or attempting to do with the user
2. Highlight the most important risks in a calm, non-alarmist way
3. Describe what information is at risk and why it matters
4. End with one clear, specific action the user should take right now

Do NOT use bullet points. Do NOT use technical terms without immediately explaining them. Write as if you are talking to a non-technical friend who is worried about their safety online. Keep your total response under 250 words.

RESPONSE:`.trim();
}

// ─── Attacker-View Prompt ─────────────────────────────────────────────────────

/**
 * Builds the red-team / attacker perspective prompt.
 * The AI acts as a red team analyst and responds ONLY with valid JSON.
 */
export function buildAttackerPrompt(report: RiskReport): string {
  const highRiskFields = report.fieldScan.fields
    .filter(f => f.kind !== 'unknown')
    .map(f => f.kind.replace(/_/g, ' '))
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  const activeTactics = report.psychDetection.tactics.map(t => t.toLowerCase());

  return `SYSTEM: You are a red team cybersecurity analyst writing a technical reconnaissance report for a security audit. Your job is to assess a webpage from an attacker's perspective and identify what data could be harvested, what manipulation vectors are present, and what the most likely attack goal is. Be precise and objective. Respond ONLY with valid JSON — no markdown, no explanation, no preamble.

PAGE INTELLIGENCE:
URL: ${report.url}
HTTPS: ${report.isHttps}
Trust Score: ${report.trustScore}/100
Threat Level: ${report.threatLevel}

Sensitive Fields Exposed: ${highRiskFields.length > 0 ? highRiskFields.join(', ') : 'none'}
Form Count: ${report.fieldScan.formCount}
Third-Party Form Actions: ${report.fieldScan.fields.some(f => f.isThirdPartyAction) ? 'yes' : 'no'}
Insecure Form Actions (HTTP): ${report.fieldScan.fields.some(f => !f.formActionIsHttps) ? 'yes' : 'no'}

Manipulation Tactics Active: ${activeTactics.length > 0 ? activeTactics.join(', ') : 'none'}
Total Manipulation Instances: ${report.psychDetection.instances.length}

Permissions Requested: ${report.permissionScan.requests.map(r => r.kind).join(', ') || 'none'}
Risky Downloads: ${report.downloadScan.hasRiskyDownload ? 'yes' : 'no'}

REQUIRED OUTPUT FORMAT (respond with ONLY this JSON, no other text):
{
  "dataAtRisk": ["list of specific data types the attacker could harvest"],
  "attackerGoal": "one sentence describing the most likely goal of the site operator or attacker",
  "exploitVector": "one sentence describing the primary method of exploitation or manipulation",
  "recommendation": "one sentence — the single most important protective action for the user"
}`.trim();
}
