import { supabase } from '@/shared/services/supabase';
import { safeStorage } from '@/shared/utils/safeStorage';

export interface SendWelcomeEmailPayload {
  email: string;
  nome: string;
  matricula: string;
  link?: string;
}

export interface SendWelcomeEmailResult {
  success: boolean;
  simulated?: boolean;
  message: string;
  id?: string;
}

async function resolveAuthToken(): Promise<string | null> {
  const localToken = safeStorage.getItem('pontual_auth_token');
  if (localToken) return localToken;

  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {}

  return null;
}

/**
 * Envia o e-mail de primeiro acesso com matrícula e link seguro gerado no servidor.
 * Exige sessão autenticada de Gestor/RH.
 */
export async function sendWelcomeEmail(payload: SendWelcomeEmailPayload): Promise<SendWelcomeEmailResult> {
  const requestBody = {
    email: payload.email,
    nome: payload.nome,
    matricula: payload.matricula,
  };

  const token = await resolveAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 1. Tenta disparar através do Backend Express ou API configurada
  const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const endpoints = [
    ...(backendBase ? [`${backendBase}/api/auth/send-welcome-email`, `${backendBase}/send-welcome-email`] : []),
    '/api/auth/send-welcome-email',
    'http://localhost:5000/api/auth/send-welcome-email',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          simulated: Boolean(data.simulated),
          message: data.message || 'E-mail enviado com sucesso!',
          id: data.id,
        };
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn(`[emailService] Falha no endpoint ${endpoint}:`, errJson?.message || errJson?.error || response.status);
      }
    } catch (endpointErr) {
      console.warn(`[emailService] Erro ao conectar em ${endpoint}:`, endpointErr);
    }
  }

  // 2. Fallback: Tenta disparar através da Edge Function do Supabase (caso implantada)
  try {
    const { data, error } = await supabase.functions.invoke('send-welcome-email', {
      body: requestBody,
    });

    if (!error && data) {
      return {
        success: true,
        simulated: Boolean(data.simulated),
        message: 'E-mail enviado via Supabase Edge Function com sucesso!',
        id: data.id,
      };
    }
  } catch (supabaseErr) {
    console.warn('Supabase Edge Function indisponível:', supabaseErr);
  }

  return {
    success: false,
    simulated: false,
    message: 'Não foi possível enviar o e-mail de ativação. Verifique a autenticação e a configuração SMTP do servidor.',
  };
}
