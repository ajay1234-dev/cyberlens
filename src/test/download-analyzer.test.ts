/**
 * Unit Tests — Download Analyzer
 */

import { describe, it, expect } from 'vitest';
import { analyzeDownload } from '@/engines/download-analyzer';
import { DownloadRiskLevel } from '@/types/risk.types';

describe('download-analyzer', () => {

  // ─── Safe Files ───────────────────────────────────────────────────────────────

  describe('safe files', () => {
    it('marks a plain PDF as safe', () => {
      const result = analyzeDownload({ filename: 'report.pdf', url: 'https://example.com/report.pdf', mime: 'application/pdf' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SAFE);
    });

    it('marks a PNG image as safe', () => {
      const result = analyzeDownload({ filename: 'photo.png', url: 'https://example.com/photo.png', mime: 'image/png' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SAFE);
    });

    it('marks a plain text file as safe', () => {
      const result = analyzeDownload({ filename: 'readme.txt', url: 'https://example.com/readme.txt', mime: 'text/plain' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SAFE);
    });

    it('marks a zip file without suspicious name as safe', () => {
      const result = analyzeDownload({ filename: 'photos.zip', url: 'https://example.com/photos.zip', mime: 'application/zip' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SAFE);
    });
  });

  // ─── Dangerous: Executable Extensions ────────────────────────────────────────

  describe('dangerous: executable extensions', () => {
    const dangerousExts = ['exe', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'msi'];

    for (const ext of dangerousExts) {
      it(`marks .${ext} as DANGEROUS`, () => {
        const result = analyzeDownload({
          filename: `malware.${ext}`,
          url: `https://example.com/malware.${ext}`,
          mime: 'application/octet-stream',
        });
        expect(result.riskLevel).toBe(DownloadRiskLevel.DANGEROUS);
      });
    }
  });

  // ─── Dangerous: Double Extensions ────────────────────────────────────────────

  describe('dangerous: double extensions', () => {
    it('detects invoice.pdf.exe as DANGEROUS', () => {
      const result = analyzeDownload({ filename: 'invoice.pdf.exe', url: 'http://evil.com/invoice.pdf.exe', mime: 'application/octet-stream' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.DANGEROUS);
    });

    it('detects document.docx.bat as DANGEROUS', () => {
      const result = analyzeDownload({ filename: 'document.docx.bat', url: 'http://evil.com/doc.bat', mime: 'application/octet-stream' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.DANGEROUS);
    });

    it('detects statement.pdf.scr as DANGEROUS', () => {
      const result = analyzeDownload({ filename: 'statement.pdf.scr', url: 'http://evil.com/x.scr', mime: 'application/octet-stream' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.DANGEROUS);
    });
  });

  // ─── Suspicious: MIME Mismatch ────────────────────────────────────────────────

  describe('suspicious: MIME mismatch', () => {
    it('marks a .pdf file with image/jpeg MIME as suspicious', () => {
      const result = analyzeDownload({ filename: 'document.pdf', url: 'https://example.com/document.pdf', mime: 'image/jpeg' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SUSPICIOUS);
    });

    it('marks a .txt file with application/zip MIME as suspicious', () => {
      const result = analyzeDownload({ filename: 'data.txt', url: 'https://example.com/data.txt', mime: 'application/zip' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SUSPICIOUS);
    });
  });

  // ─── Suspicious: Phishing Archive Names ──────────────────────────────────────

  describe('suspicious: phishing archive names', () => {
    it('flags invoice.zip as suspicious', () => {
      const result = analyzeDownload({ filename: 'invoice.zip', url: 'http://phish.com/invoice.zip', mime: 'application/zip' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SUSPICIOUS);
    });

    it('flags receipt.rar as suspicious', () => {
      const result = analyzeDownload({ filename: 'receipt.rar', url: 'http://phish.com/receipt.rar', mime: 'application/octet-stream' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SUSPICIOUS);
    });

    it('flags payment_statement.zip as suspicious', () => {
      const result = analyzeDownload({ filename: 'payment_statement.zip', url: 'http://phish.com/file.zip', mime: 'application/zip' });
      expect(result.riskLevel).toBe(DownloadRiskLevel.SUSPICIOUS);
    });
  });

  // ─── Result Shape ─────────────────────────────────────────────────────────────

  describe('result metadata', () => {
    it('always includes filename, url, mimeType, riskLevel, explanation, detectedAt', () => {
      const result = analyzeDownload({ filename: 'test.exe', url: 'http://bad.com/test.exe', mime: 'application/octet-stream' });
      expect(typeof result.filename).toBe('string');
      expect(typeof result.url).toBe('string');
      expect(typeof result.mimeType).toBe('string');
      expect(typeof result.riskLevel).toBe('string');
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(typeof result.detectedAt).toBe('number');
    });

    it('strips path prefix from filename', () => {
      const result = analyzeDownload({ filename: '/downloads/subdir/malware.exe', url: 'http://bad.com', mime: 'application/octet-stream' });
      expect(result.filename).toBe('malware.exe');
    });

    it('provides a non-empty plain-English explanation for dangerous files', () => {
      const result = analyzeDownload({ filename: 'nasty.exe', url: 'http://bad.com', mime: 'application/octet-stream' });
      expect(result.explanation).toContain('dangerous');
    });

    it('provides a safe explanation for clean files', () => {
      const result = analyzeDownload({ filename: 'resume.pdf', url: 'https://good.com', mime: 'application/pdf' });
      expect(result.explanation.toLowerCase()).toContain('safe');
    });
  });
});
