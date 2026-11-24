import crypto from 'crypto';

export const ALLOWED_STORAGE_BUCKETS = new Set(['atestados', 'documentos']);

export const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export const ALLOWED_DOCUMENT_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
export const MAX_STORAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateStorageUploadMetadata({ bucket, fileName, contentType, fileSize }) {
  const targetBucket = String(bucket || 'atestados').trim().toLowerCase();
  if (!ALLOWED_STORAGE_BUCKETS.has(targetBucket)) {
    return { ok: false, status: 400, error: 'Bucket de armazenamento não permitido.' };
  }

  const rawName = String(fileName || '').trim();
  if (!rawName || /[\u0000-\u001F\u007F]/.test(rawName)) {
    return { ok: false, status: 400, error: 'Nome de arquivo inválido.' };
  }

  const baseName = rawName.split(/[\\/]/).pop() || '';
  const lowerName = baseName.toLowerCase();
  const dotIdx = lowerName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : '';
  const mime = String(contentType || '').trim().toLowerCase();

  if (
    ext === '.svg' ||
    ext === '.html' ||
    ext === '.htm' ||
    mime === 'image/svg+xml' ||
    mime === 'text/html'
  ) {
    return { ok: false, status: 400, error: 'Por segurança, arquivos SVG ou HTML não são permitidos.' };
  }

  if (!ext || !ALLOWED_DOCUMENT_EXTS.has(ext)) {
    return {
      ok: false,
      status: 400,
      error: 'Extensão de arquivo não permitida. Utilize .pdf, .png, .jpg, .jpeg ou .webp.',
    };
  }

  if (!mime || !ALLOWED_DOCUMENT_MIMES.has(mime)) {
    return {
      ok: false,
      status: 400,
      error: 'Tipo MIME não permitido. Utilize apenas PDF, PNG, JPG ou WEBP.',
    };
  }

  const numericSize = Number(fileSize);
  if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > MAX_STORAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Tamanho do arquivo inválido ou acima do limite permitido (10 MB).',
    };
  }

  const sanitizedBase = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '');
  const trimmedBase = sanitizedBase.slice(0, 120) || `documento${ext}`;
  const safeFileName = trimmedBase.toLowerCase().endsWith(ext)
    ? trimmedBase
    : `${trimmedBase.slice(0, 110)}${ext}`;

  return {
    ok: true,
    bucket: targetBucket,
    contentType: mime,
    safeFileName,
  };
}

export function buildScopedStoragePath({ user, safeFileName }) {
  const cleanCompany = String(user?.companyId || 'sem_empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUser = String(user?.sub || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nonce = crypto.randomBytes(6).toString('hex');
  return `cmp_${cleanCompany}/${cleanUser}/${Date.now()}_${nonce}_${safeFileName}`;
}

export async function parseAndAuthorizeStoragePath({
  rawPath,
  requestedBucket,
  user,
  supabaseAdmin,
}) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return { ok: false, status: 400, error: 'Caminho do documento não informado.' };
  }

  const trimmed = rawPath.trim();
  if (/[\u0000-\u001F\u007F\\]/.test(trimmed)) {
    return { ok: false, status: 400, error: 'Caminho do documento inválido.' };
  }

  let bucket = String(requestedBucket || 'atestados').trim().toLowerCase();
  let objectPath = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed);
      const configuredSupabase = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      if (configuredSupabase) {
        const expectedHost = new URL(configuredSupabase).hostname;
        if (parsedUrl.hostname !== expectedHost) {
          return { ok: false, status: 403, error: 'URL externa não pertence ao storage autorizado.' };
        }
      }
      const match = parsedUrl.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(atestados|documentos)\/(.+)$/i
      );
      if (!match) {
        return { ok: false, status: 400, error: 'URL de storage não reconhecida ou bucket inválido.' };
      }
      bucket = match[1].toLowerCase();
      objectPath = decodeURIComponent(match[2]);
    } catch {
      return { ok: false, status: 400, error: 'URL de storage malformada.' };
    }
  } else {
    if (trimmed.startsWith('//')) {
      return { ok: false, status: 400, error: 'Caminho do documento inválido.' };
    }
    const cleanRel = trimmed.replace(/^\/+/, '');
    if (cleanRel.toLowerCase().startsWith('atestados/')) {
      bucket = 'atestados';
      objectPath = cleanRel.slice('atestados/'.length);
    } else if (cleanRel.toLowerCase().startsWith('documentos/')) {
      bucket = 'documentos';
      objectPath = cleanRel.slice('documentos/'.length);
    } else {
      objectPath = cleanRel;
    }
  }

  if (!ALLOWED_STORAGE_BUCKETS.has(bucket)) {
    return { ok: false, status: 400, error: 'Bucket de armazenamento não permitido.' };
  }

  const segments = objectPath.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((seg) => seg === '.' || seg === '..' || seg.includes('\\'))) {
    return { ok: false, status: 400, error: 'Caminho de arquivo inválido.' };
  }

  const normalizedPath = segments.join('/');
  const cleanUserId = String(user?.sub || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUserCompany = String(user?.companyId || 'sem_empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
  const perfilLower = String(user?.perfil || '').toLowerCase();
  const isManagerial =
    perfilLower === 'gestor' ||
    perfilLower === 'rh' ||
    perfilLower === 'admin' ||
    user?.isMasterManager === true;

  if (segments[0].startsWith('cmp_')) {
    const pathCompany = segments[0].slice(4);
    const ownerId = segments[1] || '';

    if (pathCompany !== cleanUserCompany) {
      return { ok: false, status: 403, error: 'Acesso negado a documentos de outra empresa.' };
    }
    if (!isManagerial && ownerId !== cleanUserId) {
      return { ok: false, status: 403, error: 'Sem permissão para acessar documento de outro colaborador.' };
    }
  } else if (supabaseAdmin) {
    // Caminhos legados na raiz do bucket: valida vínculo de empresa/titularidade quando registrado em TAB_Justificativa_Ausencia
    const fileNamePart = segments[segments.length - 1];
    const { data: justRows } = await supabaseAdmin
      .from('TAB_Justificativa_Ausencia')
      .select('Idf_Colaborador, Des_Url_Documento')
      .ilike('Des_Url_Documento', `%${fileNamePart}%`)
      .limit(5);

    if (justRows && justRows.length > 0) {
      const ownerIds = [...new Set(justRows.map((r) => r.Idf_Colaborador).filter(Boolean))];
      if (!isManagerial && !ownerIds.includes(user?.sub)) {
        return { ok: false, status: 403, error: 'Sem permissão para visualizar este comprovante.' };
      }

      if (user?.companyId && ownerIds.length > 0) {
        const { data: owners } = await supabaseAdmin
          .from('TAB_Colaborador')
          .select('Idf_Colaborador, Idf_Empresa')
          .in('Idf_Colaborador', ownerIds);

        if (owners && owners.length > 0) {
          const sameTenant = owners.some(
            (o) => !o.Idf_Empresa || o.Idf_Empresa === user.companyId
          );
          if (!sameTenant) {
            return { ok: false, status: 403, error: 'Acesso negado a documento de outra empresa.' };
          }
        }
      }
    } else if (!isManagerial) {
      return { ok: false, status: 403, error: 'Documento legado fora do seu escopo de acesso.' };
    }
  }

  return {
    ok: true,
    bucket,
    objectPath: normalizedPath,
  };
}
