/**
 * GuardianEye — Detection Types
 * Interfaces specifically for the detection engine pipeline.
 */

// Re-export from risk.types for convenience to consumers of detection types
export type {
  FieldScan,
  FieldScanResult,
  SensitiveFieldKind,
  PermissionRequest,
  PermissionScanResult,
  PermissionKind,
  DownloadRisk,
  DownloadScanResult,
  DownloadRiskLevel,
} from './risk.types';

// ─── Message Types (content ↔ background) ────────────────────────────────────

export type MessageType =
  | 'RISK_REPORT'
  | 'REQUEST_MENTOR'
  | 'MENTOR_TOKEN'
  | 'MENTOR_DONE'
  | 'REQUEST_ATTACKER_VIEW'
  | 'ATTACKER_VIEW_RESULT'
  | 'PERMISSION_INTERCEPTED'
  | 'DOWNLOAD_FLAGGED'
  | 'ERROR';

export interface BaseMessage {
  type: MessageType;
  tabId?: number;
}

export interface RiskReportMessage extends BaseMessage {
  type: 'RISK_REPORT';
  payload: import('./risk.types').RiskReport;
}

export interface RequestMentorMessage extends BaseMessage {
  type: 'REQUEST_MENTOR';
}

export interface MentorTokenMessage extends BaseMessage {
  type: 'MENTOR_TOKEN';
  token: string;
}

export interface MentorDoneMessage extends BaseMessage {
  type: 'MENTOR_DONE';
}

export interface RequestAttackerViewMessage extends BaseMessage {
  type: 'REQUEST_ATTACKER_VIEW';
}

export interface AttackerViewResultMessage extends BaseMessage {
  type: 'ATTACKER_VIEW_RESULT';
  payload: import('./risk.types').AttackerViewReport;
}

export interface PermissionInterceptedMessage extends BaseMessage {
  type: 'PERMISSION_INTERCEPTED';
  payload: import('./risk.types').PermissionRequest;
}

export interface DownloadFlaggedMessage extends BaseMessage {
  type: 'DOWNLOAD_FLAGGED';
  payload: import('./risk.types').DownloadRisk;
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  error: string;
}

export type ExtensionMessage =
  | RiskReportMessage
  | RequestMentorMessage
  | MentorTokenMessage
  | MentorDoneMessage
  | RequestAttackerViewMessage
  | AttackerViewResultMessage
  | PermissionInterceptedMessage
  | DownloadFlaggedMessage
  | ErrorMessage;

// ─── Engine Input Context ─────────────────────────────────────────────────────

export interface PageContext {
  url: string;
  hostname: string;
  isHttps: boolean;
  bodyText: string;
  document: Document;
}
