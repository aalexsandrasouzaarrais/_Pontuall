/**
 * Utilitário de armazenamento resiliente (SafeStorage)
 * Utiliza sessionStorage para garantir que a sessão ativa expire ao fechar o navegador/aba,
 * e previne auto-login indevido ao abrir links ou atualizar telas sem sessão.
 * Previne falhas de 'SecurityError: Access is denied for this document'.
 */

const memoryStorageFallback: Record<string, string> = {};

const SESSION_KEYS = new Set([
  'pontual_active_user',
  'pontual_role',
  'pontual_google_avatar'
]);

const isSessionKey = (key: string): boolean => {
  return SESSION_KEYS.has(key) || (key.startsWith('sb-') && key.endsWith('-auth-token'));
};

// Limpa qualquer resquício antigo de sessão deixado no localStorage em versões anteriores
try {
  if (typeof window !== 'undefined' && 'localStorage' in window) {
    window.localStorage.removeItem('pontual_active_user');
    window.localStorage.removeItem('pontual_role');
    window.localStorage.removeItem('pontual_google_avatar');
  }
} catch {}

export const safeStorage = {
  getItem: (key: string): string | null => {
    // Chaves de sessão e tokens de autenticação vivem estritamente na sessão da aba
    if (isSessionKey(key)) {
      try {
        if (typeof window !== 'undefined' && 'sessionStorage' in window) {
          const val = window.sessionStorage.getItem(key);
          if (val !== null) return val;
        }
      } catch {}
      return memoryStorageFallback[key] ?? null;
    }

    // Chaves persistentes (ex: cadastros offline, preferências de tema)
    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        const val = window.sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {}
    return memoryStorageFallback[key] ?? null;
  },

  setItem: (key: string, value: string): void => {
    if (isSessionKey(key)) {
      try {
        if (typeof window !== 'undefined' && 'sessionStorage' in window) {
          window.sessionStorage.setItem(key, value);
        }
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          window.localStorage.removeItem(key);
        }
      } catch {}
      memoryStorageFallback[key] = String(value);
      return;
    }

    try {
      if (typeof window !== 'undefined' && 'sessionStorage' in window) {
        window.sessionStorage.setItem(key, value);
      }
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
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
    } catch {}
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
    } catch {}
    Object.keys(memoryStorageFallback).forEach(k => delete memoryStorageFallback[k]);
  }
};
