/**
 * GuardianEye — Risk Types
 * All shared risk and threat related interfaces and enums.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ThreatLevel {
  SAFE    = 'SAFE',
  CAUTION = 'CAUTION',
  WARNING = 'WARNING',
  DANGER  = 'DANGER',
}

export enum TacticType {
  URGENCY  = 'URGENCY',
  FEAR     = 'FEAR',
  SCARCITY = 'SCARCITY',
  REWARD   = 'REWARD',
  PRESSURE = 'PRESSURE',
}

// ─── Psychological Manipulation ───────────────────────────────────────────────

export interface TacticInstance {
  /** Which tactic category this instance belongs to */
  tactic: TacticType;
  /** The exact matched text snippet from the page */
  text: string;
  /** CSS selector path to the element containing the match */
  element: string;
}

export interface PsychDetectionResult {
  tactics: TacticType[];
  instances: TacticInstance[];
}

// ─── Field Scanning ───────────────────────────────────────────────────────────

export type SensitiveFieldKind =
  | 'email'
  | 'password'
  | 'phone'
  | 'credit_card'
  | 'cvv'
  | 'ssn'
  | 'dob'
  | 'address'
  | 'unknown';

export interface FieldScan {
  kind: SensitiveFieldKind;
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  formAction: string;
  formActionIsHttps: boolean;
  isThirdPartyAction: boolean;
}

export interface FieldScanResult {
  fields: FieldScan[];
  highRisk: boolean;
  formCount: number;
}

// ─── Permission Requests ──────────────────────────────────────────────────────

export type PermissionKind = 'camera' | 'microphone' | 'geolocation' | 'notifications';

export interface PermissionRequest {
  kind: PermissionKind;
  requestedAt: number;
  allowed: boolean;
}

export interface PermissionScanResult {
  requests: PermissionRequest[];
  hasHighRiskPermissions: boolean;
}

// ─── Download Risk ────────────────────────────────────────────────────────────

export enum DownloadRiskLevel {
  SAFE      = 'SAFE',
  SUSPICIOUS = 'SUSPICIOUS',
  DANGEROUS  = 'DANGEROUS',
}

export interface DownloadRisk {
  filename: string;
  url: string;
  mimeType: string;
  riskLevel: DownloadRiskLevel;
  explanation: string;
  detectedAt: number;
}

export interface DownloadScanResult {
  downloads: DownloadRisk[];
  hasRiskyDownload: boolean;
}

// ─── Trust Score ──────────────────────────────────────────────────────────────

export interface TrustScoreBreakdown {
  base: number;
  psychDeduction: number;
  fieldDeduction: number;
  permissionDeduction: number;
  downloadDeduction: number;
  httpsBonus: number;
  final: number;
}

// ─── Aggregated Risk Report ───────────────────────────────────────────────────

export interface RiskReport {
  url: string;
  hostname: string;
  analyzedAt: number;
  threatLevel: ThreatLevel;
  trustScore: number;
  scoreBreakdown: TrustScoreBreakdown;
  psychDetection: PsychDetectionResult;
  fieldScan: FieldScanResult;
  permissionScan: PermissionScanResult;
  downloadScan: DownloadScanResult;
  isHttps: boolean;
  metaSignals: MetaSignals;
}

export interface MetaSignals {
  hasPrivacyPolicy: boolean;
  hasContactInfo: boolean;
  hasSecureForms: boolean;
  domainAge: 'unknown' | 'new' | 'established';
}

// ─── AI Response Types ────────────────────────────────────────────────────────

export interface AttackerViewReport {
  dataAtRisk: string[];
  attackerGoal: string;
  exploitVector: string;
  recommendation: string;
}
