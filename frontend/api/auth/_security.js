import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_STRICT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FORBIDDEN_EMAIL_CHARS_RE = /[\r\n,;<>()\s]/;

const ipBuckets = new Map();
const memoryResetTokens = new Map();
let cachedDevJwtSecret = null;
let cachedTransporter = null;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (FORBIDDEN_EMAIL_CHARS_RE.test(trimmed)) return false;
  return EMAIL_STRICT_RE.test(trimmed);
}

export function maskEmail(email) {
  const trimmed = String(email || '').trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function quotePostgrestValue(value) {
  const cleaned = String(value ?? '').replace(/[\r\n\0]/g, '');
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export const SESSION_COOKIE_NAME = 'pontual_session';
const UUID_STRICT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_STRICT_RE.test(value.trim());
}

export function generateSecureMatricula(prefix = 'GST') {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSaoPauloTimeHHMM(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === 'hour')?.value || '00';
    const m = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }
}

export function evaluateServerEntryTolerance(scheduledStart, serverTimeHHMM, toleranceMinutes = 10) {
  if (!scheduledStart || !serverTimeHHMM) return 'present';
  const parseMins = (hhmm) => {
    const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };
  const schedMins = parseMins(scheduledStart);
  const actualMins = parseMins(serverTimeHHMM);
  if (schedMins === null || actualMins === null) return 'present';
  const diff = actualMins - schedMins;
  return diff > toleranceMinutes && diff < 720 ? 'late' : 'present';
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

function isHttpsReq(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || xfProto.split(',').some((p) => p.trim() === 'https');
}

function appendSetCookie(res, cookieStr) {
  const existing = res.getHeader?.('Set-Cookie');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else if (typeof existing === 'string' && existing) {
    res.setHeader('Set-Cookie', [existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }
}

export function setSessionCookie(req, res, token, ttlSeconds = 8 * 3600) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.max(1, Math.floor(ttlSeconds))}`,
  ];
  if (isHttpsReq(req)) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export function clearSessionCookie(req, res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isHttpsReq(req)) parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

export function safeTimingEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getTrustedAppUrl() {
  const vercelProdHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelHost = process.env.VERCEL_URL?.trim();
  const raw =
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.VITE_APP_URL ||
    (vercelProdHost ? `https://${vercelProdHost}` : '') ||
    (vercelHost ? `https://${vercelHost}` : '') ||
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

export function getAllowedCorsOrigin(reqOrigin) {
  if (!reqOrigin || typeof reqOrigin !== 'string') return null;
  const cleanOrigin = reqOrigin.trim().replace(/\/+$/, '');
  const dynamicVercel = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : '',
  ]
    .filter(Boolean)
    .join(',');

  const allowlist = [
    process.env.ALLOWED_ORIGINS || '',
    process.env.APP_URL || '',
    process.env.FRONTEND_URL || '',
    process.env.VITE_APP_URL || '',
    dynamicVercel,
  ]
    .join(',')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (allowlist.includes(cleanOrigin)) return cleanOrigin;
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) {
    return cleanOrigin;
  }
  return null;
}

export function applyCorsHeaders(req, res, methods = 'POST,OPTIONS') {
  const allowedOrigin = getAllowedCorsOrigin(req.headers.origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-CSRF-Token, X-Requested-With, Accept'
  );
}

export function checkRateLimit(req, res, bucketName = 'default', maxRequests = 10) {
  const fwd = req.headers['x-forwarded-for'];
  const clientIp = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
  const key = `${bucketName}:${clientIp}`;
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const timestamps = (ipBuckets.get(key) || []).filter((ts) => ts > windowStart);

  if (timestamps.length >= maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + RATE_WINDOW_MS - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    ipBuckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  ipBuckets.set(key, timestamps);
  return true;
}

export function getSupabaseAdmin() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSmtpUser() {
  return (process.env.EMAIL_USER || '').trim();
}

export function getMailTransporter() {
  const user = getSmtpUser();
  const pass = (process.env.EMAIL_PASS || '').trim();
  if (!user || !pass) return null;

  if (!cachedTransporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });
  }
  return cachedTransporter;
}

function getJwtSecret() {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (process.env.NODE_ENV === 'production') return null;
  if (!cachedDevJwtSecret) {
    cachedDevJwtSecret = crypto.randomBytes(32).toString('hex');
  }
  return cachedDevJwtSecret;
}

function toBase64Url(bufOrStr) {
  return Buffer.from(bufOrStr)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signHs256Jwt(payload, ttlSeconds = 8 * 3600) {
  const secret = getJwtSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const headerB64 = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = toBase64Url(JSON.stringify(fullPayload));
  const sigB64 = toBase64Url(crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest());
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

export function verifyHs256Jwt(token) {
  const secret = getJwtSecret();
  if (!secret) return null;
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

export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const bearerToken = match?.[1]?.trim();
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME]?.trim();
  const token = bearerToken || cookieToken;
  if (!token) return { status: 401, error: 'Autenticação obrigatória.' };

  const supabaseAdmin = getSupabaseAdmin();

  const decoded = verifyHs256Jwt(token);
  if (decoded) {
    let perfil = String(decoded.perfil || '').toLowerCase();
    let isMaster = decoded.isMasterManager === true;
    let companyId = decoded.companyId || null;
    let email = decoded.email || '';

    if (supabaseAdmin && decoded.sub) {
      const { data: activeColab } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master, Idf_Empresa, Flg_Ativo')
        .eq('Idf_Colaborador', decoded.sub)
        .eq('Flg_Ativo', true)
        .maybeSingle();

      if (!activeColab) {
        return { status: 401, error: 'Usuário não autorizado ou inativo.' };
      }
      perfil = String(activeColab.Tpo_Perfil || '').toLowerCase();
      isMaster = activeColab.Flg_Gestor_Master === true;
      companyId = activeColab.Idf_Empresa || null;
      email = activeColab.Eml_Corporativo || email;
    }

    return {
      status: 200,
      user: {
        sub: decoded.sub,
        email,
        perfil,
        isMasterManager: isMaster,
        companyId,
      },
    };
  }

  if (!supabaseAdmin) {
    return { status: 401, error: 'Sessão inválida ou servidor sem verificação configurada.' };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const userEmail = data?.user?.email?.trim().toLowerCase();
    if (error || !userEmail || !isValidEmail(userEmail)) {
      return { status: 401, error: 'Sessão inválida ou expirada.' };
    }

    const quotedEmail = quotePostgrestValue(userEmail);
    const { data: colab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master, Idf_Empresa')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .eq('Flg_Ativo', true)
      .limit(1)
      .maybeSingle();

    if (!colab) return { status: 401, error: 'Usuário não autorizado ou inativo.' };
    const perfil = String(colab.Tpo_Perfil || '').toLowerCase();

    return {
      status: 200,
      user: {
        sub: colab.Idf_Colaborador,
        email: colab.Eml_Corporativo || userEmail,
        perfil,
        isMasterManager: Boolean(colab.Flg_Gestor_Master),
        companyId: colab.Idf_Empresa || null,
      },
    };
  } catch {
    return { status: 401, error: 'Falha ao validar sessão.' };
  }
}

export async function authorizeRoles(req, allowedRoles = ['gestor', 'rh', 'admin']) {
  const auth = await authenticateRequest(req);
  if (auth.status !== 200) return auth;

  const normalizedAllowed = new Set(allowedRoles.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean));
  const perfilLower = String(auth.user.perfil || '').toLowerCase();
  const allowsManagerial = normalizedAllowed.has('gestor') || normalizedAllowed.has('rh') || normalizedAllowed.has('admin');

  const allowed = normalizedAllowed.has(perfilLower) || (allowsManagerial && auth.user.isMasterManager === true);
  if (!allowed) {
    return { status: 403, error: 'Permissão insuficiente para executar esta ação.' };
  }

  return auth;
}

export async function authorizeManagerOrRh(req) {
  return authorizeRoles(req, ['gestor', 'rh', 'admin']);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createPasswordResetToken(colaboradorId, matricula = '') {
  const now = Date.now();
  for (const [key, entry] of memoryResetTokens.entries()) {
    if (entry.used || entry.expiresAt <= now) memoryResetTokens.delete(key);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const cleanMatricula = String(matricula || '').trim().slice(0, 60);
  const expiresAtIso = new Date(now + PASSWORD_RESET_TTL_MS).toISOString();

  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from('TAB_Password_Reset_Token')
        .insert({
          Idf_Colaborador: colaboradorId,
          Cod_Matricula: cleanMatricula || null,
          Cod_Token_Hash: tokenHash,
          Dta_Expira_Em: expiresAtIso,
          Flg_Utilizado: false,
        });
      if (!error) return rawToken;
    } catch {
      // Fallback para memória se a tabela ainda não tiver sido aplicada
    }
  }

  memoryResetTokens.set(tokenHash, {
    colaboradorId,
    matricula: cleanMatricula,
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    used: false,
  });
  return rawToken;
}

export async function consumePasswordResetToken(rawToken) {
  if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return null;
  }

  const tokenHash = hashToken(rawToken.trim().toLowerCase());
  const nowIso = new Date().toISOString();

  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('TAB_Password_Reset_Token')
        .update({
          Flg_Utilizado: true,
          Dta_Utilizado_Em: nowIso,
        })
        .eq('Cod_Token_Hash', tokenHash)
        .eq('Flg_Utilizado', false)
        .gt('Dta_Expira_Em', nowIso)
        .select('Idf_Colaborador, Cod_Matricula')
        .maybeSingle();

      if (!error && data) {
        return {
          colaboradorId: data.Idf_Colaborador,
          matricula: data.Cod_Matricula || '',
        };
      }
    } catch {
      // Fallback para cache em memória
    }
  }

  const entry = memoryResetTokens.get(tokenHash);
  if (!entry) return null;
  if (entry.used || Date.now() > entry.expiresAt) {
    memoryResetTokens.delete(tokenHash);
    return null;
  }

  entry.used = true;
  memoryResetTokens.delete(tokenHash);
  return {
    colaboradorId: entry.colaboradorId,
    matricula: entry.matricula,
  };
}
