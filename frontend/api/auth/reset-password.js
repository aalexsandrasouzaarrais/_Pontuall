import bcrypt from 'bcryptjs';
import {
  applyCorsHeaders,
  checkRateLimit,
  getSupabaseAdmin,
  consumePasswordResetToken,
} from './_security.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  if (!checkRateLimit(req, res, 'reset-confirm', 10)) {
    return res.status(429).json({ success: false, message: 'Muitas tentativas de redefinição. Aguarde 15 minutos.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ success: false, message: 'Serviço indisponível no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { token, novaSenha } = body;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token.trim())) {
      return res.status(400).json({ success: false, message: 'Link de redefinição inválido ou expirado. Solicite um novo link.' });
    }

    if (typeof novaSenha !== 'string' || novaSenha.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const cleanPass = novaSenha.trim();
    const weakPasswords = ['123456', '1234567', '12345678', '123456789', '000000', '111111', 'abcdef', 'senha123', 'admin123', 'password'];
    if (weakPasswords.includes(cleanPass.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Por segurança, não utilize senhas sequenciais ou padrão (como 123456). Crie uma senha mais forte.',
      });
    }

    const tokenData = await consumePasswordResetToken(token);
    if (!tokenData) {
      return res.status(400).json({ success: false, message: 'Link de redefinição inválido ou expirado. Solicite um novo link.' });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula')
      .eq('Idf_Colaborador', tokenData.colaboradorId)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (userErr || !user) {
      return res.status(400).json({ success: false, message: 'Conta não encontrada ou inativa.' });
    }

    const mat = String(user.Cod_Matricula || tokenData.matricula || '').trim().toLowerCase();
    const matDigits = mat.replace(/^pnt-|^gst-|^col-|^mat-/i, '');
    if (
      (mat && cleanPass.toLowerCase() === mat) ||
      (matDigits.length >= 3 && cleanPass.toLowerCase() === matDigits)
    ) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha não pode ser igual à sua matrícula. Crie uma senha pessoal exclusiva.',
      });
    }

    const senhaHash = await bcrypt.hash(cleanPass, 12);
    const nowIso = new Date().toISOString();

    let updateResult = await supabaseAdmin
      .from('TAB_Colaborador')
      .update({ Des_Senha_Hash: senhaHash, Dta_Atualizacao: nowIso })
      .eq('Idf_Colaborador', user.Idf_Colaborador);

    if (updateResult.error) {
      updateResult = await supabaseAdmin
        .from('TAB_Colaborador')
        .update({ Des_Senha_Hash: senhaHash })
        .eq('Idf_Colaborador', user.Idf_Colaborador);
    }

    if (updateResult.error) {
      return res.status(500).json({ success: false, message: 'Erro ao atualizar senha no banco de dados.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com sua nova senha.',
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a redefinição de senha.' });
  }
}
