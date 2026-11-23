import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from './supabase.js';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  perfil: string;
  isMasterManager: boolean;
  companyId: string | null;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthTokenPayload;
}

interface PasswordResetEntry {
  colaboradorId: string;
  matricula: string;
  expiresAt: number;
  used: boolean;
}

let cachedDevJwtSecret: string | null = null;
const passwordResetTokens = new Map<string, PasswordResetEntry>();

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_STRICT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FORBIDDEN_EMAIL_CHARS_RE = /[\r\n,;<>()\s]/;
const UUID_STRICT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SESSION_COOKIE_NAME = 'pontual_session';

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
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

function isHttpsRequest(req: Request): boolean {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || req.secure || xfProto.split(',').some(p => p.trim() === 'https');
}

export function setSessionCookie(req: Request, res: Response, token: string, ttlSeconds = 8 * 3600): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.max(1, Math.floor(ttlSeconds))}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function getSaoPauloTimeHHMM(date: Date = new Date()): string {
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

export function evaluateServerEntryTolerance(
  scheduledStart?: string | null,
  serverTimeHHMM?: string,
  toleranceMinutes = 10
): 'present' | 'late' {
  if (!scheduledStart || !serverTimeHHMM) return 'present';
  const parseMins = (hhmm: string): number | null => {
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

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_STRICT_RE.test(value.trim());
}

export function quotePostgrestValue(value: string): string {
  const cleaned = String(value ?? '').replace(/[\r\n\0]/g, '');
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function generateSecureMatricula(prefix: 'PNT' | 'GST' | 'COL' | 'PJ' = 'PNT'): string {
  const num = crypto.randomInt(100000, 999999);
  return `${prefix}-${num}`;
}

export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Raio da Terra em metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function safeTimingEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }
  if (!cachedDevJwtSecret) {
    cachedDevJwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[authSecurity] JWT_SECRET não definido no ambiente. Utilizando segredo efêmero em memória apenas para desenvolvimento.');
  }
  return cachedDevJwtSecret;
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signAuthToken(payload: AuthTokenPayload, ttlSeconds = 8 * 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const headerB64 = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(signingInput).digest();
  return `${signingInput}.${toBase64Url(sig)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const header = JSON.parse(fromBase64Url(headerB64).toString('utf8'));
    if (!header || header.alg !== 'HS256') return null;

    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', getJwtSecret()).update(signingInput).digest();
    const receivedSig = fromBase64Url(sigB64);

    if (expectedSig.length !== receivedSig.length || !crypto.timingSafeEqual(expectedSig, receivedSig)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadB64).toString('utf8')) as AuthTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(
  req: Request
): Promise<{ ok: true; user: AuthTokenPayload } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const bearerToken = match?.[1]?.trim();
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME]?.trim();
  const token = bearerToken || cookieToken;

  if (!token) {
    return { ok: false, status: 401, error: 'Autenticação obrigatória.' };
  }

  // 1. Tenta validar JWT assinado pelo próprio backend e confirma usuário ativo no banco
  const decoded = verifyAuthToken(token);
  if (decoded && isUuid(decoded.sub)) {
    const { data: activeColab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master, Idf_Empresa, Flg_Ativo')
      .eq('Idf_Colaborador', decoded.sub)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (!activeColab) {
      return { ok: false, status: 401, error: 'Usuário não autorizado ou inativo.' };
    }

    return {
      ok: true,
      user: {
        sub: activeColab.Idf_Colaborador,
        email: activeColab.Eml_Corporativo || decoded.email,
        perfil: activeColab.Tpo_Perfil,
        isMasterManager: Boolean(activeColab.Flg_Gestor_Master),
        companyId: activeColab.Idf_Empresa || null,
      },
    };
  }

  // 2. Fallback: valida token de sessão do Supabase Auth (ex.: Google OAuth)
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const userEmail = data?.user?.email?.trim().toLowerCase();
    if (error || !userEmail || !isValidEmail(userEmail)) {
      return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
    }

    let { data: colab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master, Idf_Empresa')
      .eq('Eml_Corporativo', userEmail)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (!colab) {
      const secondaryRes = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Eml_Corporativo, Tpo_Perfil, Flg_Gestor_Master, Idf_Empresa')
        .eq('Eml_Secundario', userEmail)
        .eq('Flg_Ativo', true)
        .maybeSingle();
      colab = secondaryRes.data;
    }

    if (!colab) {
      return { ok: false, status: 401, error: 'Usuário não autorizado ou inativo.' };
    }

    return {
      ok: true,
      user: {
        sub: colab.Idf_Colaborador,
        email: colab.Eml_Corporativo || userEmail,
        perfil: colab.Tpo_Perfil,
        isMasterManager: Boolean(colab.Flg_Gestor_Master),
        companyId: colab.Idf_Empresa || null,
      },
    };
  } catch {
    return { ok: false, status: 401, error: 'Falha ao validar sessão.' };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = await resolveAuthenticatedUser(req);
  if (!result.ok) {
    res.status(result.status).json({ success: false, error: result.error });
    return;
  }
  (req as AuthenticatedRequest).authUser = result.user;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  const normalizedAllowed = new Set(
    allowedRoles.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean)
  );

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await resolveAuthenticatedUser(req);
    if (!result.ok) {
      res.status(result.status).json({ success: false, error: result.error });
      return;
    }

    const perfilLower = String(result.user.perfil || '').toLowerCase();
    const allowsManagerial =
      normalizedAllowed.has('gestor') ||
      normalizedAllowed.has('rh') ||
      normalizedAllowed.has('admin');

    const hasRole =
      normalizedAllowed.has(perfilLower) ||
      (allowsManagerial && result.user.isMasterManager === true);

    if (!hasRole) {
      res.status(403).json({ success: false, error: 'Permissão insuficiente para executar esta ação.' });
      return;
    }

    (req as AuthenticatedRequest).authUser = result.user;
    next();
  };
}

export const requireManagerOrRhAuth = requireRole('gestor', 'rh', 'admin');

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (FORBIDDEN_EMAIL_CHARS_RE.test(trimmed)) return false;
  return EMAIL_STRICT_RE.test(trimmed);
}

export function maskEmail(email: string): string {
  const trimmed = String(email || '').trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function getTrustedAppUrl(): string | null {
  const raw =
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.VITE_APP_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');

  if (!raw) return null;

  try {
    const parsed = new URL(raw.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createPasswordResetToken(colaboradorId: string, matricula = ''): Promise<string> {
  const now = Date.now();
  for (const [key, entry] of passwordResetTokens.entries()) {
    if (entry.used || entry.expiresAt <= now) {
      passwordResetTokens.delete(key);
    }
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const cleanMatricula = String(matricula || '').trim().slice(0, 60);
  const expiresAtIso = new Date(now + PASSWORD_RESET_TTL_MS).toISOString();

  // Persiste preferencialmente em TAB_Password_Reset_Token para compatibilidade serverless/multi-instância
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

    if (!error) {
      return rawToken;
    }
  } catch {
    // Fallback em memória caso a tabela ainda não tenha sido criada no banco
  }

  passwordResetTokens.set(tokenHash, {
    colaboradorId,
    matricula: cleanMatricula,
    expiresAt: now + PASSWORD_RESET_TTL_MS,
    used: false,
  });

  return rawToken;
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ colaboradorId: string; matricula: string } | null> {
  if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
    return null;
  }

  const tokenHash = hashToken(rawToken.trim().toLowerCase());
  const nowIso = new Date().toISOString();

  // 1. Tenta consumir atomicamente do banco de dados
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
    // Fallback para cache em memória se tabela não existir
  }

  // 2. Fallback em memória (desenvolvimento local sem tabela)
  const entry = passwordResetTokens.get(tokenHash);
  if (!entry) return null;

  if (entry.used || Date.now() > entry.expiresAt) {
    passwordResetTokens.delete(tokenHash);
    return null;
  }

  entry.used = true;
  passwordResetTokens.delete(tokenHash);

  return {
    colaboradorId: entry.colaboradorId,
    matricula: entry.matricula,
  };
}
