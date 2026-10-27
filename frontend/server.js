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
  const senderDomain = EMAIL_USER.includes('@') ? EMAIL_USER.split('@')[1] : 'pontual.com.br';
  const messageId = `<pontual.${Date.now()}.${crypto.randomBytes(6).toString('hex')}@${senderDomain}>`;

  const plainText = [
    `Olá, ${cleanNome}!`,
    '',
    'Seu acesso à plataforma Pontual Gestão de Escalas & Pontos foi liberado com sucesso.',
    '',
    '--------------------------------------------------',
    `SUA SENHA TEMPORÁRIA / MATRÍCULA: ${cleanMatricula}`,
    '--------------------------------------------------',
    '',
    'Para realizar seu primeiro acesso e cadastrar sua senha definitiva, acesse o link abaixo:',
    resetLink,
    '',
    'Recomendamos que você acesse a plataforma e altere sua senha no primeiro login.',
    '',
    'Caso não reconheça este cadastro, contate o administrador da sua empresa.',
    '',
    'Atenciosamente,',
    'Equipe Pontual - Gestão de Escalas & Pontos',
    'Este é um e-mail transacional automático do sistema.'
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Bem-vindo(a) à Pontual - Primeiro Acesso</title>
    </head>
    <body style="margin: 0; padding: 28px 12px; background-color: #0b0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e2e8f0;">
      <!-- Preheader invisível para clientes de e-mail (evita spam e melhora preview) -->
      <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #0b0c10; opacity: 0; mso-hide: all;">
        Seu acesso à plataforma Pontual foi liberado. Confira sua senha temporária e instruções para o primeiro acesso.
      </div>
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
                    Olá <strong style="color: #e2e8f0; font-weight: 700;">${cleanNome}</strong>, seu cadastro foi realizado com sucesso pelo seu gestor.
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
                          ${cleanMatricula}
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

                  <!-- Rodapé com contexto transacional que previne classificação como SPAM -->
                  <div style="text-align: center; font-size: 11px; color: #64748b; line-height: 1.6; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;">
                    Pontual Gestão de Escalas & Pontos • Este é um e-mail transacional enviado automaticamente.<br>
                    Você recebeu esta mensagem porque foi cadastrado na plataforma Pontual pela equipe de RH da sua organização.
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
      from: `"Pontual Gestão de Escalas" <${EMAIL_USER}>`,
      replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
      to: email,
      subject: `Bem-vindo(a) à Pontual - Primeiro Acesso (${cleanMatricula})`,
      text: plainText,
      html,
      messageId,
      headers: {
        'X-Mailer': 'Pontual-Mailer-v1.0',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Feedback-ID': 'welcome:pontual:transactional',
      }
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
