import { useCallback, useSyncExternalStore } from 'react';
import {
  dismissInstallBanner,
  getPwaInstallSnapshot,
  isInstallBannerDismissed,
  subscribePwaInstallState,
  triggerPwaInstallPrompt,
  type PwaInstallSnapshot,
} from '@/lib/pwa';

const SERVER_SNAPSHOT: PwaInstallSnapshot = {
  canPromptInstall: false,
  isIos: false,
  isIosNonSafari: false,
  isInstalled: false,
  isInstalling: false,
  isDismissed: false,
  forceShowGuide: false,
};

export function usePwaInstall() {
  const snapshot = useSyncExternalStore(
    subscribePwaInstallState,
    getPwaInstallSnapshot,
    () => SERVER_SNAPSHOT
  );

  const dismissed = snapshot.isDismissed || isInstallBannerDismissed();
  const shouldShowBanner =
    !snapshot.isInstalled &&
    (snapshot.forceShowGuide || (!dismissed && (snapshot.canPromptInstall || snapshot.isIos)));

  const install = useCallback(async () => {
    return triggerPwaInstallPrompt();
  }, []);

  const dismiss = useCallback(() => {
    dismissInstallBanner();
  }, []);

  return {
    shouldShowBanner,
    canPromptInstall: snapshot.canPromptInstall,
    isIos: snapshot.isIos,
    isIosNonSafari: snapshot.isIosNonSafari,
    isInstalled: snapshot.isInstalled,
    isInstalling: snapshot.isInstalling,
    forceShowGuide: snapshot.forceShowGuide,
    install,
    dismiss,
  };
}
