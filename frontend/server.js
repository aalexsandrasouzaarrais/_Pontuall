import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
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

console.log(`[SMTP Config] Utilizando conta: ${EMAIL_USER}`);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
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

  const origin = req.headers.origin || 'http://localhost:3000';
  const resetLink = link || `${origin}/?reset=true&matricula=${encodeURIComponent(matricula || '')}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d0f15; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { max-width: 550px; margin: 0 auto; background: #12131a; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .bar { height: 6px; background: linear-gradient(90deg, #96183c, #f89847, #faf0ac); }
        .content { padding: 32px; }
        .badge { display: inline-block; padding: 4px 12px; background: rgba(248,152,71,0.15); color: #f89847; font-size: 12px; font-weight: bold; border-radius: 12px; margin-bottom: 16px; }
        h1 { color: #ffffff; font-size: 22px; margin-top: 0; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
        .info-box { background: #181a24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0; }
        .info-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .info-label { color: #64748b; }
        .info-value { color: #f89847; font-weight: bold; font-family: monospace; }
        .btn { display: block; text-align: center; background: linear-gradient(135deg, #96183c, #f89847); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 14px; font-weight: bold; font-size: 14px; margin-top: 24px; box-shadow: 0 10px 20px rgba(150,24,60,0.3); }
        .footer { font-size: 11px; color: #475569; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="bar"></div>
        <div class="content">
          <div class="badge">Primeiro Acesso</div>
          <h1>Bem-vindo(a) ao Pontual, ${nome || 'Colaborador'}!</h1>
          <p>Seu cadastro de colaborador foi realizado no sistema Pontual. Utilize os dados abaixo para o seu primeiro acesso:</p>

          <div class="info-box">
            <div class="info-item">
              <span class="info-label">E-mail Corporativo:</span>
              <span class="info-value" style="color:#ffffff;">${email}</span>
            </div>
            <div class="info-item" style="margin-bottom:0;">
              <span class="info-label">Matrícula / ID:</span>
              <span class="info-value">${matricula || 'PNT-1000'}</span>
            </div>
          </div>

          <p>Clique no botão abaixo para definir sua senha definitiva de acesso:</p>

          <a href="${resetLink}" class="btn">Ativar Minha Conta e Criar Senha</a>

          <div class="footer">
            Pontual Gestão de Escalas & Pontos • E-mail automático de ativação
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Pontual Escalas" <${EMAIL_USER}>`,
      to: email,
      subject: `Bem-vindo ao Pontual - Ativação de Conta (${matricula || 'Pontual'})`,
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
