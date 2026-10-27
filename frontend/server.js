import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const EMAIL_USER = process.env.EMAIL_USER || 'pontual.escalas@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'xiqp afqt inqe qizb';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;

console.log(`[SMTP Config] Utilizando conta: ${EMAIL_USER}`);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('[SMTP] Erro ao autenticar no servidor do Gmail:', error.message);
  } else {
    console.log('[SMTP] Autenticação com Gmail realizada com sucesso!');
  }
});

const handleSendWelcomeEmail = async (req, res) => {
  const { email, nome, matricula, link } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'E-mail do destinatário não informado.' });
  }

  const configuredAppUrl = process.env.FRONTEND_URL || process.env.APP_URL || process.env.VITE_APP_URL || '';
  const origin = configuredAppUrl || req.headers.origin || 'http://localhost:3000';
  const resetLink = link || `${origin.replace(/\/+$/, '')}/colaborador?matricula=${encodeURIComponent(matricula || '')}&primeiro_acesso=true`;

  const cleanNome = (nome || 'Colaborador').trim();
  const cleanMatricula = (matricula || 'PNT-1000').trim();

  const plainText = [
    `Olá, ${cleanNome}!`,
    '',
    'Sua conta de colaborador na plataforma Pontual foi ativada com sucesso pelo RH da sua organização.',
    '',
    '--------------------------------------------------',
    `MATRÍCULA DE ACESSO: ${cleanMatricula}`,
    '--------------------------------------------------',
    '',
    'Para acessar o Portal do Colaborador, utilize o link seguro abaixo:',
    resetLink,
    '',
    'Recomendamos que você realize o seu primeiro acesso para consultar sua escala de trabalho e verificar seus dados cadastrais.',
    '',
    'Atenciosamente,',
    'Equipe Pontual - Gestão de Escalas e Pessoas',
    'Mensagem automática do sistema Pontual. Caso tenha dúvidas, consulte a equipe de RH.'
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
      <!-- Preheader invisível para clientes de e-mail -->
      <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9; opacity: 0; mso-hide: all;">
        Sua conta de colaborador na Pontual está pronta para uso. Acesse suas escalas e registros de jornada.
      </div>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); text-align: left;">
              
              <!-- Barra Superior Pontual -->
              <tr>
                <td style="height: 4px; background-color: #670D20; font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>
              
              <!-- Cabeçalho Institucional -->
              <tr>
                <td style="padding: 24px 32px 16px 32px; border-bottom: 1px solid #f1f5f9;">
                  <span style="color: #670D20; font-weight: 800; font-size: 19px; letter-spacing: -0.5px;">PONTUAL</span>
                  <span style="color: #94a3b8; font-size: 13px; font-weight: 500; margin-left: 8px;">| Gestão de Escalas</span>
                </td>
              </tr>

              <!-- Conteúdo Principal -->
              <tr>
                <td style="padding: 28px 32px 32px 32px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                    Olá, ${cleanNome}
                  </h2>

                  <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                    Sua conta de colaborador na plataforma <strong>Pontual</strong> foi ativada com sucesso pelo setor de Recursos Humanos.
                  </p>

                  <p style="margin: 0 0 20px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                    A partir de agora, você já pode acessar o sistema para consultar sua escala de trabalho, solicitar folgas e acompanhar seus turnos.
                  </p>

                  <!-- Caixa de Credencial / Matrícula -->
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid #670D20;">
                    <tr>
                      <td style="padding: 18px 20px;">
                        <div style="font-size: 11px; font-weight: 700; color: #670D20; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
                          SUA MATRÍCULA DE IDENTIFICAÇÃO
                        </div>
                        <div style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">
                          ${cleanMatricula}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Clique no botão abaixo para acessar o Portal do Colaborador e concluir o seu acesso:
                  </p>

                  <!-- Botão de Ação -->
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 26px 0;">
                    <tr>
                      <td>
                        <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #670D20; color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 600; padding: 13px 28px; border-radius: 8px; text-align: center;">
                          Acessar Portal do Colaborador
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Link de Acesso Alternativo -->
                  <div style="margin: 0 0 28px 0; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      Se preferir, copie e cole o link direto em seu navegador:
                    </p>
                    <a href="${resetLink}" target="_blank" style="font-size: 12px; color: #2563eb; text-decoration: underline; word-break: break-all; line-height: 1.5;">
                      ${resetLink}
                    </a>
                  </div>

                  <!-- Rodapé Institucional Transacional -->
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

  try {
    const info = await transporter.sendMail({
      from: `"Pontual Gestão de Pessoas" <${EMAIL_USER}>`,
      replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
      to: email,
      subject: `Ativação de Acesso - Pontual Gestão de Pessoas`,
      text: plainText,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${email}! ID: ${info.messageId}`);
    return res.json({
      success: true,
      simulated: false,
      message: `E-mail de ativação enviado com sucesso para ${email}!`,
      id: info.messageId
    });
  } catch (error) {
    console.error('[SMTP] Erro ao disparar e-mail:', error);
    return res.status(500).json({
      success: false,
      message: `Falha ao enviar e-mail: ${error.message}`
    });
  }
};

app.post('/api/auth/send-welcome-email', handleSendWelcomeEmail);
app.post('/api/send-welcome-email', handleSendWelcomeEmail);

app.listen(PORT, () => {
  console.log(`[Servidor Backend Pontual] Rodando na porta ${PORT}`);
});
