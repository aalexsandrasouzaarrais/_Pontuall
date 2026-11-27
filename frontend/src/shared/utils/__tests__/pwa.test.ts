import { describe, it, expect } from 'vitest';
import {
  detectIosUserAgent,
  detectIosNonSafariBrowser,
  isStandaloneDisplayMode,
  isBannerDismissed,
  getDismissalExpiryTimestamp,
  requestPwaInstall,
} from '@/lib/pwa';

describe('PWA Helpers', () => {
  describe('detectIosUserAgent', () => {
    it('detects iPhone and iPad user agents', () => {
      expect(
        detectIosUserAgent(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
        )
      ).toBe(true);
      expect(
        detectIosUserAgent(
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        )
      ).toBe(true);
    });

    it('detects iPadOS desktop-mode user agent via MacIntel + touch points', () => {
      expect(
        detectIosUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
          'MacIntel',
          5
        )
      ).toBe(true);
    });

    it('returns false for desktop macOS, Android, and Windows', () => {
      expect(
        detectIosUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
          'MacIntel',
          0
        )
      ).toBe(false);
      expect(
        detectIosUserAgent(
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36'
        )
      ).toBe(false);
      expect(
        detectIosUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      ).toBe(false);
    });
  });

  describe('detectIosNonSafariBrowser', () => {
    it('detects Chrome, Firefox, Edge, and Opera on iOS', () => {
      expect(detectIosNonSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) CriOS/124.0')).toBe(true);
      expect(detectIosNonSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) FxiOS/124.0')).toBe(true);
      expect(detectIosNonSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) EdgiOS/124.0')).toBe(true);
      expect(detectIosNonSafariBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) OPiOS/16.0')).toBe(true);
    });

    it('returns false for Safari on iOS', () => {
      expect(
        detectIosNonSafariBrowser(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
        )
      ).toBe(false);
    });
  });

  describe('isStandaloneDisplayMode', () => {
    it('detects standalone display-mode, iOS navigator.standalone, and Android TWA referrer', () => {
      expect(isStandaloneDisplayMode(true, false, '')).toBe(true);
      expect(isStandaloneDisplayMode(false, true, '')).toBe(true);
      expect(isStandaloneDisplayMode(false, false, 'android-app://com.pontual.app')).toBe(true);
      expect(isStandaloneDisplayMode(false, false, 'https://pontual.vercel.app')).toBe(false);
    });
  });

  describe('isBannerDismissed & getDismissalExpiryTimestamp', () => {
    it('respects future expiry timestamps and expires past ones', () => {
      const now = 1_700_000_000_000;
      const expiry = getDismissalExpiryTimestamp(now, 7);
      expect(Number(expiry)).toBe(now + 7 * 24 * 60 * 60 * 1000);

      expect(isBannerDismissed(expiry, now + 1000)).toBe(true);
      expect(isBannerDismissed(expiry, Number(expiry))).toBe(false);
      expect(isBannerDismissed(expiry, Number(expiry) + 1)).toBe(false);
    });

    it('handles null and invalid stored values safely', () => {
      expect(isBannerDismissed(null)).toBe(false);
      expect(isBannerDismissed('')).toBe(false);
      expect(isBannerDismissed('invalid-number')).toBe(false);
    });
  });

  describe('requestPwaInstall', () => {
    it('falls back to opening the install guide when browser prompt is unavailable', async () => {
      await expect(requestPwaInstall()).resolves.toBe('guide');
    });
  });
});
