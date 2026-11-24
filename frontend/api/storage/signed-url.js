import {
  applyCorsHeaders,
  authenticateRequest,
  checkRateLimit,
  getSupabaseAdmin,
} from '../auth/_security.js';
import { parseAndAuthorizeStoragePath } from './_storageSecurity.js';

const SIGNED_DOWNLOAD_TTL_SECONDS = 300;

export default async function handler(req, res) {
  applyCorsHeaders(req, res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!checkRateLimit(req, res, 'storage-signed-url', 60)) {
    return res.status(429).json({ error: 'Muitas solicitações de leitura. Tente novamente em instantes.' });
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
  const pathCheck = await parseAndAuthorizeStoragePath({
    rawPath: body.path,
    requestedBucket: body.bucket,
    user: auth.user,
    supabaseAdmin,
  });

  if (!pathCheck.ok) {
    return res.status(pathCheck.status).json({ error: pathCheck.error });
  }

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(pathCheck.bucket)
      .createSignedUrl(pathCheck.objectPath, SIGNED_DOWNLOAD_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return res.status(404).json({ error: 'Documento não encontrado ou indisponível no bucket privado.' });
    }

    return res.status(200).json({
      success: true,
      signedUrl: data.signedUrl,
      expiresIn: SIGNED_DOWNLOAD_TTL_SECONDS,
    });
  } catch (err) {
    console.error('[api/storage/signed-url] Erro:', String(err?.code || err?.message || 'Erro interno').slice(0, 160));
    return res.status(500).json({ error: 'Erro interno ao gerar URL temporária do documento.' });
  }
}
