import { applyCorsHeaders, clearSessionCookie } from './_security.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  clearSessionCookie(req, res);
  return res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso.' });
}
