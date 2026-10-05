import { supabase } from '@/shared/services/supabase';

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

/**
 * Envia o e-mail de primeiro acesso com matrícula (senha temporária) e link de ativação.
 * Tenta via Backend Express (Resend) ou Supabase Edge Functions.
 */
export async function sendWelcomeEmail(payload: SendWelcomeEmailPayload): Promise<SendWelcomeEmailResult> {
  // Prioriza a URL configurada do app (ex: no Vercel VITE_APP_URL=https://meuapp.vercel.app),
  // ou dinamicamente o domínio atual do navegador (window.location.origin).
  const configuredUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_PUBLIC_URL || '';
  const currentOrigin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('file://')) 
    ? window.location.origin 
    : '';
  const origin = (configuredUrl || currentOrigin || 'http://localhost:3000').replace(/\/+$/, '');
  const resetLink = payload.link || `${origin}/colaborador?matricula=${encodeURIComponent(payload.matricula)}&primeiro_acesso=true`;

  const requestBody = {
    email: payload.email,
    nome: payload.nome,
    matricula: payload.matricula,
    link: resetLink
  };

  // 1. Tenta disparar através do Backend Express ou API configurada
  const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const endpoints = [
    ...(backendBase ? [`${backendBase}/api/auth/send-welcome-email`, `${backendBase}/send-welcome-email`] : []),
    '/api/auth/send-welcome-email',
    'http://localhost:5000/api/auth/send-welcome-email'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[emailService] Resposta do backend:', data);
        return {
          success: true,
          simulated: data.simulated,
          message: data.message || 'E-mail enviado com sucesso!',
          id: data.id
        };
      } else {
        const errJson = await response.json().catch(() => null);
        console.warn(`[emailService] Falha no endpoint ${endpoint}:`, errJson);
      }
    } catch (endpointErr) {
      console.warn(`[emailService] Erro ao conectar em ${endpoint}:`, endpointErr);
    }
  }

  // 2. Fallback: Tenta disparar através da Edge Function do Supabase (caso implantada)
  try {
    const { data, error } = await supabase.functions.invoke('send-welcome-email', {
      body: requestBody
    });

    if (!error && data) {
      return {
        success: true,
        simulated: data.simulated,
        message: 'E-mail enviado via Supabase Edge Function com sucesso!',
        id: data.id
      };
    }
  } catch (supabaseErr) {
    console.warn('Supabase Edge Function indisponível:', supabaseErr);
  }

  // 3. Fallback de Demonstração / Local
  console.log(`%c[PONTUAL - E-MAIL DE BOAS-VINDAS SIMULADO]`, 'color: #f89847; font-weight: bold; font-size: 14px;');
  console.log(`Para: ${payload.email}`);
  console.log(`Nome: ${payload.nome}`);
  console.log(`Senha Inicial (Matrícula): ${payload.matricula}`);
  console.log(`Link de Acesso: ${resetLink}`);

  return {
    success: true,
    simulated: true,
    message: `E-mail de ativação preparado para ${payload.email} com a senha ${payload.matricula}.`
  };
}
