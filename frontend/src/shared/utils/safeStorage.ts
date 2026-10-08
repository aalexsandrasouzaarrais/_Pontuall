/**
 * Utilitário de armazenamento resiliente (SafeStorage)
 * Utiliza sessionStorage para garantir que a sessão expire ao fechar o navegador/aba,
 * e previne falhas de 'SecurityError: Access is denied for this document'.
 */

const memoryStorageFallback: Record<string, string> = {};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Ignora erro de segurança do navegador
    }
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Ignora erro de segurança do navegador
    }
    return memoryStorageFallback[key] ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        window.sessionStorage.setItem(key, value);
      }
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
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        window.sessionStorage.removeItem(key);
      }
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
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        window.sessionStorage.clear();
      }
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.clear();
      }
    } catch {
      // Ignora erro de segurança do navegador
    }
    Object.keys(memoryStorageFallback).forEach(k => delete memoryStorageFallback[k]);
  }
};
