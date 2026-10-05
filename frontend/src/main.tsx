import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Proteção global contra 'SecurityError: Access is denied for this document'
(function initGlobalSafeStorage() {
  let isWorking = false;
  try {
    const test = '__pontual_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    isWorking = true;
  } catch {
    isWorking = false;
  }

  if (!isWorking) {
    console.warn('[Pontuall] localStorage restrito pelo navegador. Ativando emulação de contingência.');
    const memStore: Record<string, string> = {};
    const mockStorage: Storage = {
      get length() { return Object.keys(memStore).length; },
      clear() { Object.keys(memStore).forEach(k => delete memStore[k]); },
      getItem(k: string) { return memStore[k] ?? null; },
      key(i: number) { return Object.keys(memStore)[i] ?? null; },
      removeItem(k: string) { delete memStore[k]; },
      setItem(k: string, v: string) { memStore[k] = String(v); }
    };
    try {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        configurable: true,
        enumerable: true,
        writable: true
      });
    } catch {
      // Ignora se o browser travar a redefinição de propriedade
    }
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
