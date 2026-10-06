import nodemailer from 'nodemailer';

const EMAIL_USER = process.env.EMAIL_USER || 'pontual.escalas@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'xiqp afqt inqe qizb';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

export default async function handler(req, res) {
  // Configuração de CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, nome, matricula, link } = body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'E-mail do destinatário não informado.' });
    }

    const host = req.headers.host || '';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const currentOrigin = `${protocol}://${host}`;
    const configuredAppUrl = process.env.FRONTEND_URL || process.env.APP_URL || process.env.VITE_APP_URL || '';
    const origin = configuredAppUrl || req.headers.origin || currentOrigin;
    const resetLink = link || `${origin.replace(/\/+$/, '')}/colaborador?matricula=${encodeURIComponent(matricula || '')}&primeiro_acesso=true`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo(a) à Pontual!</title>
      </head>
      <body style="margin: 0; padding: 28px 12px; background-color: #0b0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0c10;">
          <tr>
            <td align="center">
              <!-- Card Principal -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #121319; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); text-align: left;">
                
                <!-- Linha Superior Gradiente (Branding Pontual) -->
                <tr>
                  <td style="height: 5px; background: linear-gradient(90deg, #96183c 0%, #f89847 60%, #faf0ac 100%); background-color: #f89847; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 36px 32px 32px 32px;">
                    
                    <!-- Título com "Pontual" destacado em laranja -->
                    <h1 style="margin: 0 0 22px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.2;">
                      Bem-vindo(a) à <span style="color: #f89847;">Pontual</span>!
                    </h1>

                    <!-- Saudação com nome do colaborador em destaque -->
                    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                      Olá <strong style="color: #e2e8f0; font-weight: 700;">${nome || 'Colaborador'}</strong>, seu cadastro foi realizado com sucesso pelo seu gestor.
                    </p>

                    <!-- Instrução -->
                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                      Para realizar o seu primeiro login e registrar seus turnos e pontos, utilize a sua senha temporária abaixo:
                    </p>

                    <!-- Caixa de Matrícula / Senha Temporária -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #181920; border-radius: 14px; border: 1px solid rgba(248, 152, 71, 0.28);">
                      <tr>
                        <td align="center" style="padding: 24px 20px;">
                          <div style="font-size: 11px; font-weight: 700; color: #f89847; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px;">
                            SUA SENHA TEMPORÁRIA / MATRÍCULA
                          </div>
                          <div style="font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: 2.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            ${matricula || 'PNT-1000'}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Recomendação de definição de senha -->
                    <p style="margin: 0 0 26px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                      Recomendamos que você acesse o sistema pelo botão abaixo e defina sua senha definitiva:
                    </p>

                    <!-- Botão de Ação Redondo Gradiente -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                      <tr>
                        <td align="center">
                          <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #d94826; background: linear-gradient(90deg, #9b1d36 0%, #d94826 45%, #eb7028 100%); color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 700; padding: 14px 34px; border-radius: 9999px; box-shadow: 0 10px 25px rgba(155, 29, 54, 0.35); text-align: center;">
                            Acessar e Definir Minha Senha
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Link alternativo -->
                    <div style="margin: 0 0 34px 0;">
                      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                        Ou copie e cole este link no seu navegador:
                      </p>
                      <a href="${resetLink}" target="_blank" style="font-size: 12px; color: #3b82f6; text-decoration: underline; word-break: break-all; line-height: 1.5;">
                        ${resetLink}
                      </a>
                    </div>

                    <!-- Rodapé discreto -->
                    <div style="text-align: center; font-size: 11px; color: #475569; line-height: 1.5;">
                      Pontual Gestão de Escalas & Pontos • Este é um e-mail automático do sistema.
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
      from: `"Pontual Escalas" <${EMAIL_USER}>`,
      to: email,
      subject: `Bem-vindo(a) à Pontual - Primeiro Acesso (${matricula || 'Pontual'})`,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${email}! ID: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      simulated: false,
      message: `E-mail de ativação enviado com sucesso para ${email}!`,
      id: info.messageId
    });
  } catch (error) {
    console.error('[SMTP Vercel] Erro ao disparar e-mail:', error);
    return res.status(500).json({
      success: false,
      message: `Falha ao enviar e-mail: ${error.message}`
    });
  }
}
