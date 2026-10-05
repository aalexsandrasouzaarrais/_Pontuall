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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const resetLink = payload.link || `${origin}/redefinir-senha?matricula=${encodeURIComponent(payload.matricula)}`;

  const requestBody = {
    email: payload.email,
    nome: payload.nome,
    matricula: payload.matricula,
    link: resetLink
  };

  // 1. Tenta disparar através do Backend Express (porta 5000 ou proxy relativo /api)
  const endpoints = [
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
