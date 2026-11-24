import { describe, it, expect } from 'vitest';
import {
  sanitizeNoteHtml,
  sanitizeSafeUrl,
  normalizeExternalHttpUrl,
  sanitizeSpreadsheetFormulaText,
  sanitizeCsvCell,
  quotePostgrestValue,
  validateUploadFile,
  detectFileMagicMime,
  validateUploadMagicBytes,
} from '@/shared/utils/security';

function makeBinaryFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('Fase 3 Security Utilities', () => {
  describe('sanitizeNoteHtml (XSS prevention)', () => {
    it('removes script/img/svg/event attributes while preserving safe formatting tags', () => {
      const dirty =
        '<p onclick="alert(1)">Texto <strong style="color:red">importante</strong></p>' +
        '<script>alert("xss")</script>' +
        '<img src=x onerror=alert(2)>' +
        '<svg onload=alert(3)></svg>' +
        '<ul><li>Item</li></ul>';
      const clean = sanitizeNoteHtml(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('<img');
      expect(clean).not.toContain('<svg');
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('onload');
      expect(clean).toContain('<p>');
      expect(clean).toContain('<strong>importante</strong>');
      expect(clean).toContain('<ul><li>Item</li></ul>');
    });
  });

  describe('sanitizeSafeUrl & normalizeExternalHttpUrl', () => {
    it('blocks dangerous schemes and control chars', () => {
      expect(sanitizeSafeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeSafeUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitizeSafeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(sanitizeSafeUrl('//evil.com/phish')).toBe('#');
      expect(sanitizeSafeUrl('https://pontuall.vercel.app/app')).toBe('https://pontuall.vercel.app/app');
    });

    it('normalizes external URLs safely and rejects javascript: even without https prefix', () => {
      expect(normalizeExternalHttpUrl('github.com/org/repo')).toBe('https://github.com/org/repo');
      expect(normalizeExternalHttpUrl('https://docs.google.com/a')).toBe('https://docs.google.com/a');
      expect(normalizeExternalHttpUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeExternalHttpUrl('httpEvil:alert(1)')).toBeNull();
      expect(normalizeExternalHttpUrl('//evil.com')).toBeNull();
      expect(normalizeExternalHttpUrl('   ')).toBeNull();
    });
  });

  describe('CSV / Spreadsheet Formula Injection', () => {
    it('prefixes dangerous leading formula characters and escapes quotes/newlines', () => {
      expect(sanitizeSpreadsheetFormulaText('=CMD|"/C calc"!A0')).toBe("'=CMD|\"/C calc\"!A0");
      expect(sanitizeSpreadsheetFormulaText('+1+1')).toBe("'+1+1");
      expect(sanitizeSpreadsheetFormulaText('-2+3')).toBe("'-2+3");
      expect(sanitizeSpreadsheetFormulaText('@SUM(1,2)')).toBe("'@SUM(1,2)");
      expect(sanitizeCsvCell('=1+1')).toBe('"\'=1+1"');
      expect(sanitizeCsvCell('10/05/2026')).toBe('"10/05/2026"');
      expect(sanitizeCsvCell('linha 1\nlinha "2"')).toBe('"linha 1 linha ""2"""');
    });
  });

  describe('quotePostgrestValue (PostgREST Filter Injection)', () => {
    it('quotes values and strips CR/LF/NUL control chars while escaping double quotes', () => {
      expect(quotePostgrestValue('user@empresa.com')).toBe('"user@empresa.com"');
      expect(quotePostgrestValue('a,Eml_Corporativo.ilike.%admin%')).toBe('"a,Eml_Corporativo.ilike.%admin%"');
      expect(quotePostgrestValue('foo"bar\\baz\r\n')).toBe('"foo\\"bar\\\\baz"');
    });
  });

  describe('validateUploadFile, detectFileMagicMime & validateUploadMagicBytes', () => {
    it('detects magic bytes for PDF, PNG, JPEG, GIF, and WEBP', () => {
      expect(detectFileMagicMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe('application/pdf');
      expect(detectFileMagicMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
      expect(detectFileMagicMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
      expect(detectFileMagicMime(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
      expect(
        detectFileMagicMime(
          new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
        )
      ).toBe('image/webp');
      expect(detectFileMagicMime(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    });

    it('rejects renamed SVG/HTML disguised as PNG or PDF via magic-byte check', async () => {
      const fakePng = makeBinaryFile(
        Array.from(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
        'fake.png',
        'image/png'
      );
      expect(validateUploadFile(fakePng, { mode: 'image' }).valid).toBe(true);
      const magicRes = await validateUploadMagicBytes(fakePng, { mode: 'image' });
      expect(magicRes.valid).toBe(false);

      const realPdf = makeBinaryFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], 'atestado.pdf', 'application/pdf');
      expect(validateUploadFile(realPdf, { mode: 'document' }).valid).toBe(true);
      const pdfMagic = await validateUploadMagicBytes(realPdf, { mode: 'document' });
      expect(pdfMagic.valid).toBe(true);
      expect(pdfMagic.detectedMime).toBe('application/pdf');

      const gifAsDocument = makeBinaryFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00], 'anim.gif', 'image/gif');
      expect(validateUploadFile(gifAsDocument, { mode: 'document' }).valid).toBe(false);
      expect((await validateUploadMagicBytes(gifAsDocument, { mode: 'document' })).valid).toBe(false);
    });
  });
});
