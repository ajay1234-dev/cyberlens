/**
 * GuardianEye — Permission Engine
 * Intercepts browser permission requests (camera, mic, geolocation, notifications)
 * via prototype patching in the content script context.
 *
 * IMPORTANT: This module must run early in the content script lifecycle,
 * before any page scripts that might call these APIs.
 */

import type { PermissionRequest, PermissionScanResult } from '@/types/risk.types';
import type { PermissionInterceptedMessage } from '@/types/detection.types';
import { createLogger } from '@/utils/logger';

const log = createLogger('permission-engine');

// ─── Internal State ───────────────────────────────────────────────────────────

const interceptedRequests: PermissionRequest[] = [];

// ─── Notification Helper ──────────────────────────────────────────────────────

function notifyBackground(request: PermissionRequest): void {
  const message: PermissionInterceptedMessage = {
    type: 'PERMISSION_INTERCEPTED',
    payload: request,
  };

  try {
    chrome.runtime.sendMessage(message);
  } catch (err) {
    log.warn('Failed to notify background of permission intercept', err);
  }
}

// ─── Camera / Microphone Intercept ────────────────────────────────────────────

function patchGetUserMedia(): void {
  if (!navigator.mediaDevices?.getUserMedia) return;

  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = async function (
    constraints: MediaStreamConstraints
  ): Promise<MediaStream> {
    const hasVideo = Boolean(constraints?.video);
    const hasAudio = Boolean(constraints?.audio);

    if (hasVideo) {
      const req: PermissionRequest = {
        kind: 'camera',
        requestedAt: Date.now(),
        allowed: true,
      };
      interceptedRequests.push(req);
      notifyBackground(req);
      log.warn('Camera access requested by page');
    }

    if (hasAudio) {
      const req: PermissionRequest = {
        kind: 'microphone',
        requestedAt: Date.now(),
        allowed: true,
      };
      interceptedRequests.push(req);
      notifyBackground(req);
      log.warn('Microphone access requested by page');
    }

    return original(constraints);
  };

  log.debug('getUserMedia patched');
}

// ─── Geolocation Intercept ────────────────────────────────────────────────────

function patchGeolocation(): void {
  if (!navigator.geolocation?.getCurrentPosition) return;

  const originalGetCurrent = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const originalWatch = navigator.geolocation.watchPosition.bind(navigator.geolocation);

  // Patch getCurrentPosition
  navigator.geolocation.getCurrentPosition = function (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ): void {
    const req: PermissionRequest = {
      kind: 'geolocation',
      requestedAt: Date.now(),
      allowed: true,
    };
    interceptedRequests.push(req);
    notifyBackground(req);
    log.warn('Geolocation (getCurrentPosition) requested by page');
    originalGetCurrent(success, error ?? undefined, options);
  };

  // Patch watchPosition
  navigator.geolocation.watchPosition = function (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ): number {
    const req: PermissionRequest = {
      kind: 'geolocation',
      requestedAt: Date.now(),
      allowed: true,
    };
    interceptedRequests.push(req);
    notifyBackground(req);
    log.warn('Geolocation (watchPosition) requested by page');
    return originalWatch(success, error ?? undefined, options);
  };

  log.debug('Geolocation patched');
}

// ─── Notification Intercept ───────────────────────────────────────────────────

function patchNotifications(): void {
  if (typeof Notification === 'undefined') return;

  const originalRequest = Notification.requestPermission.bind(Notification);

  Notification.requestPermission = async function (
    callback?: NotificationPermissionCallback
  ): Promise<NotificationPermission> {
    const req: PermissionRequest = {
      kind: 'notifications',
      requestedAt: Date.now(),
      allowed: true,
    };
    interceptedRequests.push(req);
    notifyBackground(req);
    log.warn('Notification permission requested by page');

    if (callback) {
      return originalRequest(callback);
    }
    return originalRequest();
  };

  log.debug('Notification.requestPermission patched');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Install all permission interceptors. Call once at content script start.
 * Must run before page scripts execute (use run_at: document_start in manifest
 * for maximum coverage, though document_idle covers most SPAs).
 */
export function installPermissionInterceptors(): void {
  try {
    patchGetUserMedia();
  } catch (err) {
    log.error('Failed to patch getUserMedia', err);
  }

  try {
    patchGeolocation();
  } catch (err) {
    log.error('Failed to patch geolocation', err);
  }

  try {
    patchNotifications();
  } catch (err) {
    log.error('Failed to patch Notification', err);
  }

  log.info('Permission interceptors installed');
}

/**
 * Returns the current snapshot of all intercepted permission requests.
 */
export function getPermissionScanResult(): PermissionScanResult {
  const HIGH_RISK_KINDS: PermissionRequest['kind'][] = ['camera', 'microphone', 'geolocation'];
  const hasHighRiskPermissions = interceptedRequests.some(r => HIGH_RISK_KINDS.includes(r.kind));

  return {
    requests: [...interceptedRequests],
    hasHighRiskPermissions,
  };
}

/**
 * Clear intercepted state (call on navigation).
 */
export function resetPermissionState(): void {
  interceptedRequests.length = 0;
}
