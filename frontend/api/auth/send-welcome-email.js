import {
  applyCorsHeaders,
  checkRateLimit,
  authorizeManagerOrRh,
  getSupabaseAdmin,
  getMailTransporter,
  getSmtpUser,
  getTrustedAppUrl,
  escapeHtml,
  isValidEmail,
  maskEmail,
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

  if (!checkRateLimit(req, res, 'welcome-email', 10)) {
    return res.status(429).json({ success: false, message: 'Muitas requisições. Tente novamente em alguns minutos.' });
  }

  const auth = await authorizeManagerOrRh(req);
  if (auth.status !== 200) {
    return res.status(auth.status).json({ success: false, message: auth.error });
  }

  const transporter = getMailTransporter();
  const senderEmail = getSmtpUser();
  if (!transporter || !senderEmail) {
    return res.status(503).json({ success: false, message: 'Serviço de envio de e-mail temporariamente indisponível.' });
  }

  const appUrl = getTrustedAppUrl();
  if (!appUrl) {
    return res.status(500).json({ success: false, message: 'Serviço de envio de e-mail temporariamente indisponível.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, nome, matricula } = body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'E-mail do destinatário inválido ou não informado.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = String(nome || 'Colaborador').trim().slice(0, 100);
    const cleanMatricula = String(matricula || 'PNT-1000').trim().slice(0, 40);

    // Localiza colaborador ativo no Supabase Admin para emitir token persistente de primeiro acesso
    let resetLink = `${appUrl}/login`;
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      let { data: colab } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Idf_Empresa')
        .eq('Eml_Corporativo', cleanEmail)
        .eq('Flg_Ativo', true)
        .maybeSingle();

      if (!colab) {
        const ilikeRes = await supabaseAdmin
          .from('TAB_Colaborador')
          .select('Idf_Colaborador, Cod_Matricula, Idf_Empresa')
          .ilike('Eml_Corporativo', cleanEmail)
          .eq('Flg_Ativo', true)
          .maybeSingle();
        colab = ilikeRes.data || null;
      }

      if (colab && auth.user?.companyId && colab.Idf_Empresa && colab.Idf_Empresa !== auth.user.companyId) {
        return res.status(403).json({ success: false, message: 'Não é permitido enviar ativação para colaborador de outra organização.' });
      }

      if (colab) {
        const rawToken = await createPasswordResetToken(colab.Idf_Colaborador, colab.Cod_Matricula || cleanMatricula);
        resetLink = `${appUrl}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;
      }
    }

    const safeNome = escapeHtml(cleanNome);
    const safeMatricula = escapeHtml(cleanMatricula);
    const safeResetLink = escapeHtml(resetLink);

    const plainText = [
      `Olá, ${cleanNome}!`,
      '',
      'Sua conta de colaborador na plataforma Pontual foi ativada com sucesso pelo RH da sua organização.',
      '',
      '--------------------------------------------------',
      `MATRÍCULA DE ACESSO: ${cleanMatricula}`,
      '--------------------------------------------------',
      '',
      'Para acessar o Portal do Colaborador e definir sua senha pessoal, utilize o link seguro abaixo:',
      resetLink,
      '',
      'Recomendamos que você realize o seu primeiro acesso para consultar sua escala de trabalho e verificar seus dados cadastrais.',
      '',
      'Atenciosamente,',
      'Equipe Pontual - Gestão de Escalas e Pessoas',
      'Mensagem automática do sistema Pontual. Caso tenha dúvidas, consulte a equipe de RH.',
    ].join('\n');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ativação de Acesso - Pontual Gestão de Pessoas</title>
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
        <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9; opacity: 0; mso-hide: all;">
          Sua conta de colaborador na Pontual está pronta para uso. Acesse suas escalas e registros de jornada.
        </div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); text-align: left;">
                <tr>
                  <td style="height: 4px; background-color: #670D20; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding: 24px 32px 16px 32px; border-bottom: 1px solid #f1f5f9;">
                    <span style="color: #670D20; font-weight: 800; font-size: 19px; letter-spacing: -0.5px;">PONTUAL</span>
                    <span style="color: #94a3b8; font-size: 13px; font-weight: 500; margin-left: 8px;">| Gestão de Escalas</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 28px 32px 32px 32px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                      Olá, ${safeNome}
                    </h2>
                    <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                      Sua conta de colaborador na plataforma <strong>Pontual</strong> foi ativada com sucesso pelo setor de Recursos Humanos.
                    </p>
                    <p style="margin: 0 0 20px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                      A partir de agora, você já pode acessar o sistema para consultar sua escala de trabalho, solicitar folgas e acompanhar seus turnos.
                    </p>
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid #670D20;">
                      <tr>
                        <td style="padding: 18px 20px;">
                          <div style="font-size: 11px; font-weight: 700; color: #670D20; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
                            SUA MATRÍCULA DE IDENTIFICAÇÃO
                          </div>
                          <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                            ${safeMatricula}
                          </div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                      Clique no botão abaixo para acessar o Portal do Colaborador e definir sua senha pessoal:
                    </p>
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 26px 0;">
                      <tr>
                        <td>
                          <a href="${safeResetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #670D20; color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 600; padding: 13px 28px; border-radius: 8px; text-align: center;">
                            Acessar Portal do Colaborador
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div style="margin: 0 0 28px 0; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                        Se preferir, copie e cole o link direto em seu navegador:
                      </p>
                      <a href="${safeResetLink}" target="_blank" rel="noopener noreferrer" style="font-size: 12px; color: #2563eb; text-decoration: underline; word-break: break-all; line-height: 1.5;">
                        ${safeResetLink}
                      </a>
                    </div>
                    <div style="font-size: 11.5px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                      Pontual Gestão de Escalas • Mensagem automática institucional.<br>
                      Você recebeu este e-mail porque foi cadastrado na plataforma pela sua empresa. Em caso de dúvidas, consulte o seu gestor ou departamento de RH.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Pontual Gestão de Pessoas" <${senderEmail}>`,
      replyTo: `"Suporte Pontual" <${senderEmail}>`,
      to: cleanEmail,
      subject: `Ativação de Acesso - Pontual Gestão de Pessoas`,
      text: plainText,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${maskEmail(cleanEmail)}! ID: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      simulated: false,
      message: 'E-mail de ativação enviado com sucesso!',
      id: info.messageId,
    });
  } catch (error) {
    console.error('[SMTP Vercel] Erro ao disparar e-mail:', String(error?.code || error?.message || 'Erro interno').slice(0, 160));
    return res.status(500).json({
      success: false,
      message: 'Falha ao enviar e-mail.',
    });
  }
}
