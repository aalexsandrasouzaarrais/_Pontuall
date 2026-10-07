/**
 * Utilitário de armazenamento resiliente (SafeStorage)
 * Previne falhas de 'SecurityError: Access is denied for this document'
 * que ocorrem em navegadores quando cookies/armazenamento local estão restritos ou em sandboxes.
 */

const memoryStorageFallback: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Ignora erro de segurança do navegador e utiliza memória
    }
    return memoryStorageFallback[key] ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignora erro de segurança do navegador e armazena em memória
    }
    memoryStorageFallback[key] = String(value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignora erro de segurança do navegador
    }
    delete memoryStorageFallback[key];
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.clear();
      }
    } catch {
      // Ignora erro de segurança do navegador
    }
    Object.keys(memoryStorageFallback).forEach(k => delete memoryStorageFallback[k]);
  }
};
