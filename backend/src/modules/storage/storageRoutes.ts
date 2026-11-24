import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import { AuthenticatedRequest, requireAuth } from '../../shared/authSecurity.js';

export const storageRoutes = Router();

const ALLOWED_STORAGE_BUCKETS = new Set(['atestados', 'documentos']);
const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const ALLOWED_DOCUMENT_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIGNED_DOWNLOAD_TTL_SECONDS = 300;

const uploadUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações de upload. Aguarde alguns minutos.' },
});

const signedUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações de leitura de documentos. Aguarde alguns minutos.' },
});

storageRoutes.post('/upload-url', requireAuth, uploadUrlLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const targetBucketInitial = String(body.bucket || 'atestados').trim().toLowerCase();
    if (!ALLOWED_STORAGE_BUCKETS.has(targetBucketInitial)) {
      res.status(400).json({ error: 'Bucket de armazenamento não permitido.' });
      return;
    }

    const rawName = String(body.fileName || '').trim();
    if (!rawName || /[\u0000-\u001F\u007F]/.test(rawName)) {
      res.status(400).json({ error: 'Nome de arquivo inválido.' });
      return;
    }

    const baseName = rawName.split(/[\\/]/).pop() || '';
    const lowerName = baseName.toLowerCase();
    const dotIdx = lowerName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : '';
    const mime = String(body.contentType || '').trim().toLowerCase();

    if (
      ext === '.svg' ||
      ext === '.html' ||
      ext === '.htm' ||
      mime === 'image/svg+xml' ||
      mime === 'text/html'
    ) {
      res.status(400).json({ error: 'Por segurança, arquivos SVG ou HTML não são permitidos.' });
      return;
    }

    if (!ext || !ALLOWED_DOCUMENT_EXTS.has(ext)) {
      res.status(400).json({
        error: 'Extensão de arquivo não permitida. Utilize .pdf, .png, .jpg, .jpeg ou .webp.',
      });
      return;
    }

    if (!mime || !ALLOWED_DOCUMENT_MIMES.has(mime)) {
      res.status(400).json({ error: 'Tipo MIME não permitido. Utilize apenas PDF, PNG, JPG ou WEBP.' });
      return;
    }

    const fileSize = Number(body.fileSize);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: 'Tamanho do arquivo inválido ou acima do limite permitido (10 MB).' });
      return;
    }

    const sanitizedBase = baseName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '');
    const trimmedBase = sanitizedBase.slice(0, 120) || `documento${ext}`;
    const safeFileName = trimmedBase.toLowerCase().endsWith(ext)
      ? trimmedBase
      : `${trimmedBase.slice(0, 110)}${ext}`;

    const cleanCompany = String(authUser.companyId || 'sem_empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanUser = String(authUser.sub || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
    const nonce = crypto.randomBytes(6).toString('hex');
    const scopedPath = `cmp_${cleanCompany}/${cleanUser}/${Date.now()}_${nonce}_${safeFileName}`;

    let targetBucket = targetBucketInitial;
    let { data, error } = await supabaseAdmin.storage
      .from(targetBucket)
      .createSignedUploadUrl(scopedPath);

    if (error && targetBucket !== 'documentos') {
      targetBucket = 'documentos';
      const fallbackRes = await supabaseAdmin.storage
        .from(targetBucket)
        .createSignedUploadUrl(scopedPath);
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error || !data?.token || !data?.signedUrl) {
      res.status(500).json({ error: 'Não foi possível preparar a URL assinada para upload privado.' });
      return;
    }

    res.json({
      success: true,
      bucket: targetBucket,
      path: data.path || scopedPath,
      canonicalPath: `${targetBucket}/${data.path || scopedPath}`,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (err: any) {
    console.error('[storage/upload-url] Erro:', String(err?.code || err?.message || 'Erro interno').slice(0, 160));
    res.status(500).json({ error: 'Erro interno ao gerar URL de upload.' });
  }
});

storageRoutes.post('/signed-url', requireAuth, signedUrlLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawPath = body.path;
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      res.status(400).json({ error: 'Caminho do documento não informado.' });
      return;
    }

    const trimmed = rawPath.trim();
    if (/[\u0000-\u001F\u007F\\]/.test(trimmed)) {
      res.status(400).json({ error: 'Caminho do documento inválido.' });
      return;
    }

    let bucket = String(body.bucket || 'atestados').trim().toLowerCase();
    let objectPath = trimmed;

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsedUrl = new URL(trimmed);
        const configuredSupabase = (process.env.SUPABASE_URL || '').trim();
        if (configuredSupabase) {
          const expectedHost = new URL(configuredSupabase).hostname;
          if (parsedUrl.hostname !== expectedHost) {
            res.status(403).json({ error: 'URL externa não pertence ao storage autorizado.' });
            return;
          }
        }
        const match = parsedUrl.pathname.match(
          /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(atestados|documentos)\/(.+)$/i
        );
        if (!match) {
          res.status(400).json({ error: 'URL de storage não reconhecida ou bucket inválido.' });
          return;
        }
        bucket = match[1].toLowerCase();
        objectPath = decodeURIComponent(match[2]);
      } catch {
        res.status(400).json({ error: 'URL de storage malformada.' });
        return;
      }
    } else {
      if (trimmed.startsWith('//')) {
        res.status(400).json({ error: 'Caminho do documento inválido.' });
        return;
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
      res.status(400).json({ error: 'Bucket de armazenamento não permitido.' });
      return;
    }

    const segments = objectPath.split('/').filter(Boolean);
    if (segments.length === 0 || segments.some((seg) => seg === '.' || seg === '..' || seg.includes('\\'))) {
      res.status(400).json({ error: 'Caminho de arquivo inválido.' });
      return;
    }

    const normalizedPath = segments.join('/');
    const cleanUserId = String(authUser.sub || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanUserCompany = String(authUser.companyId || 'sem_empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const perfilLower = String(authUser.perfil || '').toLowerCase();
    const isManagerial =
      perfilLower === 'gestor' ||
      perfilLower === 'rh' ||
      perfilLower === 'admin' ||
      authUser.isMasterManager === true;

    if (segments[0].startsWith('cmp_')) {
      const pathCompany = segments[0].slice(4);
      const ownerId = segments[1] || '';

      if (pathCompany !== cleanUserCompany) {
        res.status(403).json({ error: 'Acesso negado a documentos de outra empresa.' });
        return;
      }
      if (!isManagerial && ownerId !== cleanUserId) {
        res.status(403).json({ error: 'Sem permissão para acessar documento de outro colaborador.' });
        return;
      }
    } else {
      const fileNamePart = segments[segments.length - 1];
      const { data: justRows } = await supabaseAdmin
        .from('TAB_Justificativa_Ausencia')
        .select('Idf_Colaborador, Des_Url_Documento')
        .ilike('Des_Url_Documento', `%${fileNamePart}%`)
        .limit(5);

      if (justRows && justRows.length > 0) {
        const ownerIds = [...new Set(justRows.map((r: any) => r.Idf_Colaborador).filter(Boolean))];
        if (!isManagerial && !ownerIds.includes(authUser.sub)) {
          res.status(403).json({ error: 'Sem permissão para visualizar este comprovante.' });
          return;
        }

        if (authUser.companyId && ownerIds.length > 0) {
          const { data: owners } = await supabaseAdmin
            .from('TAB_Colaborador')
            .select('Idf_Colaborador, Idf_Empresa')
            .in('Idf_Colaborador', ownerIds);

          if (owners && owners.length > 0) {
            const sameTenant = owners.some(
              (o: any) => !o.Idf_Empresa || o.Idf_Empresa === authUser.companyId
            );
            if (!sameTenant) {
              res.status(403).json({ error: 'Acesso negado a documento de outra empresa.' });
              return;
            }
          }
        }
      } else if (!isManagerial) {
        res.status(403).json({ error: 'Documento legado fora do seu escopo de acesso.' });
        return;
      }
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(normalizedPath, SIGNED_DOWNLOAD_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      res.status(404).json({ error: 'Documento não encontrado ou indisponível no bucket privado.' });
      return;
    }

    res.json({
      success: true,
      signedUrl: data.signedUrl,
      expiresIn: SIGNED_DOWNLOAD_TTL_SECONDS,
    });
  } catch (err: any) {
    console.error('[storage/signed-url] Erro:', String(err?.code || err?.message || 'Erro interno').slice(0, 160));
    res.status(500).json({ error: 'Erro interno ao gerar URL temporária do documento.' });
  }
});
