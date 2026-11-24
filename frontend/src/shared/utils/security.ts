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

const SAFE_NOTE_TAG_SET = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span']);

function fallbackStripNoteHtml(raw: string): string {
  const withoutDangerousBlocks = raw.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );
  return withoutDangerousBlocks.replace(/<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi, (_full, slash, tagName) => {
    const lower = String(tagName).toLowerCase();
    if (!SAFE_NOTE_TAG_SET.has(lower)) {
      return '';
    }
    return slash ? `</${lower}>` : `<${lower}>`;
  });
}

/**
 * Sanitiza conteúdo HTML de notas ricas para prevenir XSS armazenado (Stored XSS).
 */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return '';
  const raw = String(html);
  const purify = DOMPurify as unknown as { sanitize?: typeof DOMPurify.sanitize };
  if (typeof purify?.sanitize === 'function') {
    return purify.sanitize(raw, {
      ALLOWED_TAGS: Array.from(SAFE_NOTE_TAG_SET),
      ALLOWED_ATTR: [],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'a', 'img'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src'],
    });
  }
  return fallbackStripNoteHtml(raw);
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

/**
 * Normaliza links externos inseridos pelo usuário para URLs HTTP/HTTPS válidas.
 * Bloqueia esquemas perigosos (javascript:, vbscript:, data:, file:, etc.).
 */
export function normalizeExternalHttpUrl(rawUrl?: string | null): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (!hasScheme && (trimmed.startsWith('//') || trimmed.startsWith('/'))) {
    return null;
  }

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  const safe = sanitizeSafeUrl(candidate, { fallback: '' });
  return /^https?:\/\//i.test(safe) ? safe : null;
}

/**
 * Identifica o MIME real do arquivo pelos primeiros bytes (magic bytes / assinatura binária).
 */
export function detectFileMagicMime(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 4) return null;

  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: GIF87a ou GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

async function readFileHeaderBytes(file: File, length = 16): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  if (typeof slice.arrayBuffer === 'function') {
    return new Uint8Array(await slice.arrayBuffer());
  }

  if (typeof FileReader !== 'undefined') {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result));
        } else {
          resolve(new Uint8Array(0));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler assinatura do arquivo.'));
      reader.readAsArrayBuffer(slice);
    });
  }

  return new Uint8Array(0);
}

/**
 * Valida a assinatura binária real (magic bytes) contra arquivos renomeados/spoofados.
 */
export async function validateUploadMagicBytes(
  file: File | null | undefined,
  options?: { mode?: 'document' | 'image' }
): Promise<{ valid: boolean; detectedMime?: string; error?: string }> {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  const mode = options?.mode ?? 'document';
  const allowedMimes = mode === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_DOCUMENT_MIMES;

  try {
    const headerBytes = await readFileHeaderBytes(file, 16);
    const detectedMime = detectFileMagicMime(headerBytes);
    if (!detectedMime || !allowedMimes.has(detectedMime)) {
      return {
        valid: false,
        error:
          mode === 'image'
            ? 'Assinatura de imagem inválida. Envie apenas PNG, JPG, WEBP ou GIF reais.'
            : 'Assinatura de documento inválida. Envie apenas PDF, PNG, JPG ou WEBP reais.',
      };
    }

    return { valid: true, detectedMime };
  } catch {
    return { valid: false, error: 'Não foi possível validar o conteúdo do arquivo selecionado.' };
  }
}
