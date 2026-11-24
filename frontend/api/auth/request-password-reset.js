import {
  applyCorsHeaders,
  checkRateLimit,
  getSupabaseAdmin,
  getMailTransporter,
  getSmtpUser,
  getTrustedAppUrl,
  escapeHtml,
  isValidEmail,
  maskEmail,
  quotePostgrestValue,
  createPasswordResetToken,
} from './_security.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  if (!checkRateLimit(req, res, 'reset-request', 5)) {
    return res.status(429).json({ success: false, message: 'Muitas solicitações de redefinição. Aguarde 15 minutos.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email } = body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Informe um e-mail corporativo válido.' });
    }

    const genericMessage =
      'Se o e-mail estiver cadastrado, enviaremos um link seguro de redefinição de senha válido por 30 minutos.';

    const supabaseAdmin = getSupabaseAdmin();
    const transporter = getMailTransporter();
    const senderEmail = getSmtpUser();
    const appUrl = getTrustedAppUrl();

    if (supabaseAdmin && transporter && senderEmail && appUrl) {
      const cleanEmail = email.trim().toLowerCase();
      const quotedEmail = quotePostgrestValue(cleanEmail);

      const { data: user } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Nme_Colaborador, Cod_Matricula, Eml_Corporativo')
        .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
        .eq('Flg_Ativo', true)
        .limit(1)
        .maybeSingle();

      if (user) {
        const rawToken = await createPasswordResetToken(user.Idf_Colaborador, user.Cod_Matricula || '');
        const resetLink = `${appUrl}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;
        const nome = String(user.Nme_Colaborador || 'Colaborador').trim().slice(0, 100);
        const safeNome = escapeHtml(nome);
        const safeLink = escapeHtml(resetLink);
        const targetEmail = (user.Eml_Corporativo || cleanEmail).trim().toLowerCase();

        const plainText = [
          `Olá, ${nome}!`,
          '',
          'Recebemos uma solicitação para redefinir a senha da sua conta Pontual.',
          '',
          'Acesse o link abaixo (válido por 30 minutos e de uso único) para definir sua nova senha:',
          resetLink,
          '',
          'Se você não solicitou esta alteração, ignore este e-mail com segurança.',
        ].join('\n');

        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0;padding:24px 12px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr><td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;text-align:left;">
                  <tr><td style="height:4px;background-color:#670D20;">&nbsp;</td></tr>
                  <tr><td style="padding:28px 32px;">
                    <h2 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">Olá, ${safeNome}</h2>
                    <p style="margin:0 0 16px 0;font-size:14.5px;line-height:1.6;">
                      Recebemos uma solicitação para redefinir sua senha na plataforma <strong>Pontual</strong>. Este link expira em 30 minutos e só pode ser utilizado uma vez.
                    </p>
                    <p style="margin:0 0 24px 0;">
                      <a href="${safeLink}" target="_blank" style="display:inline-block;background-color:#670D20;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:600;padding:13px 28px;border-radius:8px;">
                        Redefinir Minha Senha
                      </a>
                    </p>
                    <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">
                      Caso não tenha solicitado, ignore esta mensagem. Link alternativo: <a href="${safeLink}" target="_blank">${safeLink}</a>
                    </p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `;

        try {
          await transporter.sendMail({
            from: `"Pontual Gestão de Pessoas" <${senderEmail}>`,
            replyTo: `"Suporte Pontual" <${senderEmail}>`,
            to: targetEmail,
            subject: 'Redefinição de Senha - Pontual',
            text: plainText,
            html,
          });
          console.log(`[SMTP Vercel] Link de redefinição enviado para ${maskEmail(targetEmail)}.`);
        } catch (mailErr) {
          console.error('[SMTP Vercel] Erro ao enviar link de redefinição:', mailErr?.message || mailErr);
        }
      }
    }

    return res.status(200).json({ success: true, message: genericMessage });
  } catch {
    return res.status(500).json({ success: false, message: 'Não foi possível processar a solicitação no momento.' });
  }
}
