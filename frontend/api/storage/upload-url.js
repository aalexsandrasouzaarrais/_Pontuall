import {
  applyCorsHeaders,
  authenticateRequest,
  checkRateLimit,
  getSupabaseAdmin,
} from '../auth/_security.js';
import {
  buildScopedStoragePath,
  validateStorageUploadMetadata,
} from './_storageSecurity.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!checkRateLimit(req, res, 'storage-upload-url', 30)) {
    return res.status(429).json({ error: 'Muitas solicitações de upload. Aguarde alguns minutos.' });
  }

  const auth = await authenticateRequest(req);
  if (auth.status !== 200) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Configuração administrativa do Storage ausente no servidor.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const metaCheck = validateStorageUploadMetadata({
    bucket: body.bucket,
    fileName: body.fileName,
    contentType: body.contentType,
    fileSize: body.fileSize,
  });

  if (!metaCheck.ok) {
    return res.status(metaCheck.status).json({ error: metaCheck.error });
  }

  const scopedPath = buildScopedStoragePath({
    user: auth.user,
    safeFileName: metaCheck.safeFileName,
  });

  try {
    let targetBucket = metaCheck.bucket;
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
      return res.status(500).json({
        error: 'Não foi possível preparar a URL assinada para upload privado.',
      });
    }

    return res.status(200).json({
      success: true,
      bucket: targetBucket,
      path: data.path || scopedPath,
      canonicalPath: `${targetBucket}/${data.path || scopedPath}`,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (err) {
    console.error('[api/storage/upload-url] Erro:', String(err?.code || err?.message || 'Erro interno').slice(0, 160));
    return res.status(500).json({ error: 'Erro interno ao gerar URL de upload.' });
  }
}
