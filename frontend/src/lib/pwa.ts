import { safeStorage } from '@/shared/utils/safeStorage';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaInstallSnapshot {
  canPromptInstall: boolean;
  isIos: boolean;
  isIosNonSafari: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  isDismissed: boolean;
}

const PWA_DISMISS_STORAGE_KEY = 'pontual_pwa_dismissed_until';
const DEFAULT_DISMISS_DAYS = 7;

export function detectIosUserAgent(
  userAgent: string,
  platform?: string,
  maxTouchPoints?: number
): boolean {
  if (!userAgent) return false;
  if (/iphone|ipad|ipod/i.test(userAgent) && !/windows phone/i.test(userAgent)) {
    return true;
  }
  if (platform === 'MacIntel' && (maxTouchPoints ?? 0) > 1) {
    return true;
  }
  return false;
}

export function detectIosNonSafariBrowser(userAgent: string): boolean {
  if (!userAgent) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}

export function isStandaloneDisplayMode(
  matchMediaStandalone: boolean,
  navigatorStandalone?: boolean,
  referrer?: string
): boolean {
  return Boolean(
    matchMediaStandalone ||
      navigatorStandalone ||
      (referrer && referrer.startsWith('android-app://'))
  );
}

export function isBannerDismissed(
  storedValue: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!storedValue) return false;
  const expiryMs = Number(storedValue);
  if (!Number.isFinite(expiryMs)) return false;
  return nowMs < expiryMs;
}

export function getDismissalExpiryTimestamp(
  nowMs: number = Date.now(),
  days: number = DEFAULT_DISMISS_DAYS
): string {
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_DISMISS_DAYS;
  return String(nowMs + safeDays * 24 * 60 * 60 * 1000);
}

export function isRunningAsInstalledPwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const navStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  const docReferrer = typeof document !== 'undefined' ? document.referrer : '';
  return isStandaloneDisplayMode(mediaStandalone, navStandalone, docReferrer);
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return detectIosUserAgent(
    navigator.userAgent || '',
    navigator.platform,
    navigator.maxTouchPoints
  );
}

export function isIosNonSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return detectIosNonSafariBrowser(navigator.userAgent || '');
}

export function isInstallBannerDismissed(): boolean {
  try {
    return isBannerDismissed(safeStorage.getItem(PWA_DISMISS_STORAGE_KEY));
  } catch {
    return false;
  }
}

let initialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstallingState = false;
let installedOverride = false;
const listeners = new Set<() => void>();

const INITIAL_SNAPSHOT: PwaInstallSnapshot = {
  canPromptInstall: false,
  isIos: false,
  isIosNonSafari: false,
  isInstalled: false,
  isInstalling: false,
  isDismissed: false,
};

let cachedSnapshot: PwaInstallSnapshot = INITIAL_SNAPSHOT;

function computeSnapshot(): PwaInstallSnapshot {
  const ios = isIosDevice();
  return {
    canPromptInstall: deferredPrompt !== null,
    isIos: ios,
    isIosNonSafari: ios && isIosNonSafari(),
    isInstalled: installedOverride || isRunningAsInstalledPwa(),
    isInstalling: isInstallingState,
    isDismissed: isInstallBannerDismissed(),
  };
}

function snapshotsEqual(a: PwaInstallSnapshot, b: PwaInstallSnapshot): boolean {
  return (
    a.canPromptInstall === b.canPromptInstall &&
    a.isIos === b.isIos &&
    a.isIosNonSafari === b.isIosNonSafari &&
    a.isInstalled === b.isInstalled &&
    a.isInstalling === b.isInstalling &&
    a.isDismissed === b.isDismissed
  );
}

function updateSnapshotAndNotify(): void {
  const next = computeSnapshot();
  if (!snapshotsEqual(cachedSnapshot, next)) {
    cachedSnapshot = next;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore listener errors so remaining subscribers still update
      }
    });
  }
}

export function dismissInstallBanner(): void {
  try {
    safeStorage.setItem(PWA_DISMISS_STORAGE_KEY, getDismissalExpiryTimestamp());
  } catch {
    // Ignore storage write errors
  }
  updateSnapshotAndNotify();
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  if (typeof window === 'undefined') {
    return INITIAL_SNAPSHOT;
  }
  const next = computeSnapshot();
  if (!snapshotsEqual(cachedSnapshot, next)) {
    cachedSnapshot = next;
  }
  return cachedSnapshot;
}

export function subscribePwaInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerPwaInstallPrompt(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  isInstallingState = true;
  updateSnapshotAndNotify();

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      installedOverride = true;
      return 'accepted';
    }
    return 'dismissed';
  } catch {
    return 'unavailable';
  } finally {
    isInstallingState = false;
    updateSnapshotAndNotify();
  }
}

function registerServiceWorker(): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    window.location.protocol === 'file:' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  const doRegister = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error) => {
        console.warn('[Pontual PWA] Falha ao registrar Service Worker:', error);
      });
  };

  if (typeof document !== 'undefined' && document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}

export function initPwa(): void {
  if (typeof window === 'undefined' || initialized) {
    return;
  }
  initialized = true;

  cachedSnapshot = computeSnapshot();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    updateSnapshotAndNotify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedOverride = true;
    isInstallingState = false;
    updateSnapshotAndNotify();
  });

  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => updateSnapshotAndNotify();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleDisplayChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleDisplayChange);
    }
  }

  registerServiceWorker();
}
