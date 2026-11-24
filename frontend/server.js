import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim();
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 10;
const ipHits = new Map();

const EMAIL_STRICT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FORBIDDEN_EMAIL_CHARS_RE = /[\r\n,;<>()\s]/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (FORBIDDEN_EMAIL_CHARS_RE.test(trimmed)) return false;
  return EMAIL_STRICT_RE.test(trimmed);
}

function maskEmail(email) {
  const trimmed = String(email || '').trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function getTrustedAppUrl() {
  const raw =
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.VITE_APP_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function verifyHs256Jwt(token) {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const pad = (s) => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const header = JSON.parse(Buffer.from(pad(headerB64), 'base64').toString('utf8'));
    if (!header || header.alg !== 'HS256') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
    const received = Buffer.from(pad(sigB64), 'base64');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
    const payload = JSON.parse(Buffer.from(pad(payloadB64), 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function authorizeManagerOrRh(req) {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const token = match?.[1]?.trim();
  if (!token) return { status: 401, error: 'Autenticação obrigatória.' };

  const decoded = verifyHs256Jwt(token);
  if (decoded) {
    const allowed = decoded.perfil === 'gestor' || decoded.perfil === 'rh' || decoded.isMasterManager === true;
    if (!allowed) return { status: 403, error: 'Acesso restrito a gestores e RH.' };
    return { status: 200, user: decoded };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return { status: 401, error: 'Sessão inválida ou servidor sem verificação configurada.' };
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const userEmail = data?.user?.email?.trim().toLowerCase();
    if (error || !userEmail || !isValidEmail(userEmail)) {
      return { status: 401, error: 'Sessão inválida ou expirada.' };
    }

    let { data: colab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master')
      .eq('Eml_Corporativo', userEmail)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (!colab) {
      const secRes = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master')
        .eq('Eml_Secundario', userEmail)
        .eq('Flg_Ativo', true)
        .maybeSingle();
      colab = secRes.data;
    }

    if (!colab) return { status: 401, error: 'Usuário não autorizado ou inativo.' };
    const allowed = colab.Tpo_Perfil === 'gestor' || colab.Tpo_Perfil === 'rh' || colab.Flg_Gestor_Master === true;
    if (!allowed) return { status: 403, error: 'Acesso restrito a gestores e RH.' };

    return { status: 200, user: colab };
  } catch {
    return { status: 401, error: 'Falha ao validar sessão.' };
  }
}

function checkRateLimit(req, res) {
  const fwd = req.headers['x-forwarded-for'];
  const clientIp = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const timestamps = (ipHits.get(clientIp) || []).filter((ts) => ts > windowStart);

  if (timestamps.length >= RATE_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + RATE_WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    ipHits.set(clientIp, timestamps);
    return false;
  }

  timestamps.push(now);
  ipHits.set(clientIp, timestamps);
  return true;
}

const allowedOriginsList = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || process.env.VITE_APP_URL || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const clean = origin.replace(/\/+$/, '');
      if (allowedOriginsList.includes(clean)) return cb(null, true);
      if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50kb' }));

const PORT = process.env.PORT || 5000;

let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  });

  transporter.verify((error) => {
    if (error) {
      console.error('[SMTP] Erro ao autenticar no servidor SMTP:', error.message);
    } else {
      console.log('[SMTP] Autenticação SMTP configurada com sucesso.');
    }
  });
}

const handleSendWelcomeEmail = async (req, res) => {
  if (!checkRateLimit(req, res)) {
    return res.status(429).json({ success: false, message: 'Muitas requisições. Tente novamente em alguns minutos.' });
  }

  const auth = await authorizeManagerOrRh(req);
  if (auth.status !== 200) {
    return res.status(auth.status).json({ success: false, message: auth.error });
  }

  if (!transporter) {
    return res.status(503).json({ success: false, message: 'Serviço SMTP não configurado no servidor.' });
  }

  const appUrl = getTrustedAppUrl();
  if (!appUrl) {
    return res.status(500).json({ success: false, message: 'APP_URL não configurada no servidor.' });
  }

  const { email, nome, matricula } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'E-mail do destinatário inválido ou não informado.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanNome = String(nome || 'Colaborador').trim().slice(0, 100);
  const cleanMatricula = String(matricula || 'PNT-1000').trim().slice(0, 40);
  const resetLink = `${appUrl}/login`;

  const safeNome = escapeHtml(cleanNome);
  const safeMatricula = escapeHtml(cleanMatricula);
  const safeResetLink = escapeHtml(resetLink);

  const plainText = [
    `Olá, ${cleanNome}!`,
    '',
    'Sua conta de colaborador na plataforma Pontual foi ativada com sucesso pelo RH da sua organização.',
    '',
    '--------------------------------------------------',
    `MATRÍCULA DE ACESSO: ${cleanMatricula}`,
    '--------------------------------------------------',
    '',
    'Para acessar o Portal do Colaborador, utilize o link seguro abaixo:',
    resetLink,
    '',
    'Recomendamos que você realize o seu primeiro acesso para consultar sua escala de trabalho e verificar seus dados cadastrais.',
    '',
    'Atenciosamente,',
    'Equipe Pontual - Gestão de Escalas e Pessoas',
    'Mensagem automática do sistema Pontual. Caso tenha dúvidas, consulte a equipe de RH.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ativação de Acesso - Pontual Gestão de Pessoas</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
      <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9; opacity: 0; mso-hide: all;">
        Sua conta de colaborador na Pontual está pronta para uso. Acesse suas escalas e registros de jornada.
      </div>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); text-align: left;">
              <tr>
                <td style="height: 4px; background-color: #670D20; font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 16px 32px; border-bottom: 1px solid #f1f5f9;">
                  <span style="color: #670D20; font-weight: 800; font-size: 19px; letter-spacing: -0.5px;">PONTUAL</span>
                  <span style="color: #94a3b8; font-size: 13px; font-weight: 500; margin-left: 8px;">| Gestão de Escalas</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 28px 32px 32px 32px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                    Olá, ${safeNome}
                  </h2>
                  <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                    Sua conta de colaborador na plataforma <strong>Pontual</strong> foi ativada com sucesso pelo setor de Recursos Humanos.
                  </p>
                  <p style="margin: 0 0 20px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                    A partir de agora, você já pode acessar o sistema para consultar sua escala de trabalho, solicitar folgas e acompanhar seus turnos.
                  </p>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid #670D20;">
                    <tr>
                      <td style="padding: 18px 20px;">
                        <div style="font-size: 11px; font-weight: 700; color: #670D20; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
                          SUA MATRÍCULA DE IDENTIFICAÇÃO
                        </div>
                        <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                          ${safeMatricula}
                        </div>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Clique no botão abaixo para acessar o Portal do Colaborador e concluir o seu acesso:
                  </p>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 26px 0;">
                    <tr>
                      <td>
                        <a href="${safeResetLink}" target="_blank" style="display: inline-block; background-color: #670D20; color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 600; padding: 13px 28px; border-radius: 8px; text-align: center;">
                          Acessar Portal do Colaborador
                        </a>
                      </td>
                    </tr>
                  </table>
                  <div style="margin: 0 0 28px 0; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      Se preferir, copie e cole o link direto em seu navegador:
                    </p>
                    <a href="${safeResetLink}" target="_blank" style="font-size: 12px; color: #2563eb; text-decoration: underline; word-break: break-all; line-height: 1.5;">
                      ${safeResetLink}
                    </a>
                  </div>
                  <div style="font-size: 11.5px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                    Pontual Gestão de Escalas • Mensagem automática institucional.<br>
                    Você recebeu este e-mail porque foi cadastrado na plataforma pela sua empresa. Em caso de dúvidas, consulte o seu gestor ou departamento de RH.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Pontual Gestão de Pessoas" <${EMAIL_USER}>`,
      replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
      to: cleanEmail,
      subject: `Ativação de Acesso - Pontual Gestão de Pessoas`,
      text: plainText,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${maskEmail(cleanEmail)}! ID: ${info.messageId}`);
    return res.json({
      success: true,
      simulated: false,
      message: 'E-mail de ativação enviado com sucesso!',
      id: info.messageId,
    });
  } catch (error) {
    console.error('[SMTP] Erro ao disparar e-mail:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: 'Falha ao enviar e-mail.',
    });
  }
};

app.post('/api/auth/send-welcome-email', handleSendWelcomeEmail);
app.post('/api/send-welcome-email', handleSendWelcomeEmail);

app.listen(PORT, () => {
  console.log(`[Servidor Backend Pontual] Rodando na porta ${PORT}`);
});
