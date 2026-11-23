import DOMPurify from 'dompurify';

export const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const ALLOWED_DOCUMENT_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const FORMULA_TRIGGER_RE = /^[\s]*[=+\-@\t\r]/;
const DATA_IMAGE_SAFE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i;

/**
 * Sanitiza conteúdo HTML de notas ricas para prevenir XSS armazenado (Stored XSS).
 */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'a', 'img'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src'],
  });
}

/**
 * Valida e normaliza URLs externas/anexos contra esquemas perigosos (javascript:, vbscript:, data:text/html, svg).
 */
export function sanitizeSafeUrl(
  rawUrl?: string | null,
  options?: {
    allowDataImage?: boolean;
    allowBlob?: boolean;
    allowMailto?: boolean;
    fallback?: string;
  }
): string {
  const fallback = options?.fallback ?? '#';
  if (typeof rawUrl !== 'string') return fallback;

  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return fallback;
  }

  // Caminhos relativos seguros dentro da própria aplicação (nunca '//evil.com')
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  if (options?.allowDataImage && DATA_IMAGE_SAFE_RE.test(trimmed)) {
    return trimmed;
  }

  if (options?.allowBlob && trimmed.startsWith('blob:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = ['http:', 'https:'];
    if (options?.allowMailto) {
      allowedProtocols.push('mailto:');
    }
    if (!allowedProtocols.includes(parsed.protocol)) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

/**
 * Neutraliza payloads de CSV / Spreadsheet Formula Injection (=, +, -, @, TAB, CR).
 */
export function sanitizeSpreadsheetFormulaText(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw) return '';
  if (FORMULA_TRIGGER_RE.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * Escapa célula CSV protegendo contra quebra de colunas e Formula Injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  const safeText = sanitizeSpreadsheetFormulaText(value).replace(/\r?\n/g, ' ');
  return `"${safeText.replace(/"/g, '""')}"`;
}

/**
 * Remove caracteres de controle e operadores PostgREST de entradas livres em filtros .or().
 */
export function stripPostgrestControlChars(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\0]/g, '').trim();
}

export function quotePostgrestValue(value: unknown): string {
  const cleaned = stripPostgrestControlChars(value);
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Valida arquivos enviados pelo usuário contra uploads maliciosos (SVG, HTML, scripts, oversized).
 */
export function validateUploadFile(
  file: File | null | undefined,
  options?: {
    mode?: 'document' | 'image';
    maxSizeBytes?: number;
  }
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  const mode = options?.mode ?? 'document';
  const maxSizeBytes = options?.maxSizeBytes ?? 5 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxSizeBytes) {
    const maxMb = Math.round((maxSizeBytes / (1024 * 1024)) * 10) / 10;
    return { valid: false, error: `Arquivo inválido ou acima do limite permitido (${maxMb} MB).` };
  }

  const mime = (file.type || '').trim().toLowerCase();
  const allowedMimes = mode === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_DOCUMENT_MIMES;
  const allowedExts = mode === 'image' ? ALLOWED_IMAGE_EXTS : ALLOWED_DOCUMENT_EXTS;

  const fileName = (file.name || '').trim().toLowerCase();
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx) : '';

  if (mime === 'image/svg+xml' || ext === '.svg' || mime === 'text/html' || ext === '.html' || ext === '.htm') {
    return { valid: false, error: 'Por segurança, arquivos SVG ou HTML não são permitidos.' };
  }

  if (mime && !allowedMimes.has(mime)) {
    return {
      valid: false,
      error: mode === 'image'
        ? 'Formato inválido. Utilize apenas imagens PNG, JPG, WEBP ou GIF.'
        : 'Formato inválido. Utilize apenas PDF, PNG, JPG ou WEBP.',
    };
  }

  if (!ext || !allowedExts.has(ext)) {
    return {
      valid: false,
      error: mode === 'image'
        ? 'Extensão de arquivo não permitida. Utilize .png, .jpg, .jpeg, .webp ou .gif.'
        : 'Extensão de arquivo não permitida. Utilize .pdf, .png, .jpg, .jpeg ou .webp.',
    };
  }

  return { valid: true };
}
