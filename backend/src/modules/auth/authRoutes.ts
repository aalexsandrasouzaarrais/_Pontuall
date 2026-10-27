import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const authRoutes = Router();

const EMAIL_USER = process.env.EMAIL_USER || 'pontual.escalas@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'xiqp afqt inqe qizb';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;

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

// Login de colaborador ou gestor
authRoutes.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha, perfil } = req.body;

    if (!email || !senha) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    // Busca usuário na tabela TAB_Colaborador
    const { data: usuario, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('*')
      .or(`Eml_Corporativo.ilike.${email},Eml_Secundario.ilike.${email}`)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: 'Erro ao consultar o banco de dados.', details: error.message });
      return;
    }

    if (!usuario) {
      res.status(401).json({ error: 'Usuário não cadastrado ou inativo.' });
      return;
    }

    // Valida perfil solicitado
    if (perfil && usuario.Tpo_Perfil !== perfil) {
      res.status(403).json({ 
        error: `Esta conta pertence ao perfil de ${usuario.Tpo_Perfil}. Selecione a aba correspondente.` 
      });
      return;
    }

    // Validação de senha segura com bcrypt (e suporte retrocompatível para senhas em texto puro)
    const isBcrypt = usuario.Des_Senha_Hash?.startsWith('$2');
    let senhaValida = false;
    if (isBcrypt) {
      senhaValida = await bcrypt.compare(senha, usuario.Des_Senha_Hash);
    } else {
      senhaValida = usuario.Des_Senha_Hash === senha;
      // Migração automática no login para usuários com senha em texto plano
      if (senhaValida) {
        const novoHash = await bcrypt.hash(senha, 10);
        await supabaseAdmin
          .from('TAB_Colaborador')
          .update({ Des_Senha_Hash: novoHash })
          .eq('Idf_Colaborador', usuario.Idf_Colaborador);
      }
    }

    if (!senhaValida) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    // Busca empresa do usuário se vinculada
    let empresaData = null;
    if (usuario.Idf_Empresa) {
      const { data: emp } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('*')
        .eq('Idf_Empresa', usuario.Idf_Empresa)
        .maybeSingle();
      empresaData = emp;
    }

    // Busca gestores vinculados ao colaborador (M:N)
    let gestorIds: string[] = [];
    if (usuario.Tpo_Perfil === 'colaborador') {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Gestor')
        .eq('Idf_Colaborador', usuario.Idf_Colaborador);
      
      if (vinculos) {
        gestorIds = vinculos.map((v: any) => v.Idf_Gestor);
      }
    }

    // Retorna os dados do usuário autenticado
    res.json({
      success: true,
      colaborador: {
        id: usuario.Idf_Colaborador,
        matricula: usuario.Cod_Matricula,
        nome: usuario.Nme_Colaborador,
        email: usuario.Eml_Corporativo,
        perfil: usuario.Tpo_Perfil,
        cargo: usuario.Tpo_Cargo,
        departamento: usuario.Des_Departamento,
        avatar: usuario.Des_Avatar_Url,
        horasSemanais: usuario.Num_Horas_Semanais,
        companyId: usuario.Idf_Empresa,
        companyCnpj: empresaData?.Num_CNPJ,
        isMasterManager: usuario.Flg_Gestor_Master || false,
        managerIds: gestorIds
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno no servidor.', details: err.message });
  }
});

// Listar colaboradores (filtrados por empresa e/ou gestor)
authRoutes.get('/colaboradores', async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresaId, gestorId } = req.query;

    let query = supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .eq('Flg_Ativo', true);

    if (empresaId) {
      query = query.eq('Idf_Empresa', empresaId);
    }

    const { data: colaboradores, error } = await query.order('Nme_Colaborador');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Se um gestor específico foi solicitado, filtra pela tabela M:N
    if (gestorId && colaboradores) {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Colaborador')
        .eq('Idf_Gestor', gestorId);

      const idsPermitidos = new Set(vinculos?.map((v: any) => v.Idf_Colaborador) || []);
      const filtrados = colaboradores.filter(c => idsPermitidos.has(c.Idf_Colaborador) || c.Flg_Gestor_Master);
      res.json(filtrados);
      return;
    }

    res.json(colaboradores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastro de novo gestor com gestão de Empresa e CNPJ
authRoutes.post('/registro-gestor', async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha, cnpj, cargo, departamento, telefone } = req.body;

    if (!nome || !email || !senha) {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : null;

    // 1. Verifica se já existe colaborador com o mesmo e-mail
    const { data: existente } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .eq('Eml_Corporativo', cleanEmail)
      .maybeSingle();

    if (existente) {
      res.status(409).json({ error: 'Este e-mail corporativo já está cadastrado.' });
      return;
    }

    let idfEmpresa: string | null = null;
    let isMasterManager = false;

    // 2. Processa o CNPJ para Multi-Empresa
    if (cleanCnpj && cleanCnpj.length === 14) {
      const cnpjFormatado = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      // Busca empresa existente pelo CNPJ
      const { data: empresaExistente } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('Idf_Empresa')
        .eq('Num_CNPJ', cnpjFormatado)
        .maybeSingle();

      if (empresaExistente) {
        idfEmpresa = empresaExistente.Idf_Empresa;
        isMasterManager = false; // Já existe gestor máster para essa empresa
      } else {
        // Cria nova empresa e define o 1º gestor como Master
        const { data: novaEmpresa, error: empError } = await supabaseAdmin
          .from('TAB_Empresa')
          .insert({
            Num_CNPJ: cnpjFormatado,
            Nme_Razao_Social: `Empresa ${cnpjFormatado}`,
            Nme_Fantasia: `Organização ${cnpjFormatado}`,
            Flg_Ativa: true
          })
          .select()
          .single();

        if (!empError && novaEmpresa) {
          idfEmpresa = novaEmpresa.Idf_Empresa;
          isMasterManager = true; // 1º Gestor é o Master/Admin!
        }
      }
    }

    const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;

    // Gera o hash seguro da senha com bcrypt
    const senhaHash = await bcrypt.hash(senha, 10);

    // 3. Cadastra o Gestor no banco
    const { data: novoGestor, error: insertError } = await supabaseAdmin
      .from('TAB_Colaborador')
      .insert({
        Cod_Matricula: matricula,
        Nme_Colaborador: nome.trim(),
        Eml_Corporativo: cleanEmail,
        Des_Senha_Hash: senhaHash,
        Tpo_Perfil: 'gestor',
        Tpo_Cargo: cargo?.trim() || 'Gestor Geral',
        Des_Departamento: departamento?.trim() || 'Gestão de Pessoas & Operações',
        Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        Num_Telefone: telefone || '(11) 98765-4321',
        Num_Horas_Semanais: 44,
        Idf_Empresa: idfEmpresa,
        Flg_Gestor_Master: isMasterManager,
        Flg_Ativo: true
      })
      .select()
      .single();

    if (insertError) {
      res.status(500).json({ error: 'Erro ao cadastrar gestor no banco de dados.', details: insertError.message });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Gestor cadastrado com sucesso!',
      gestor: {
        id: novoGestor.Idf_Colaborador,
        matricula: novoGestor.Cod_Matricula,
        nome: novoGestor.Nme_Colaborador,
        email: novoGestor.Eml_Corporativo,
        perfil: novoGestor.Tpo_Perfil,
        cargo: novoGestor.Tpo_Cargo,
        departamento: novoGestor.Des_Departamento,
        companyId: idfEmpresa,
        isMasterManager: isMasterManager
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno ao processar cadastro de gestor.', details: err.message });
  }
});

// Vincular Colaborador a um Gestor (Relacionamento M:N)
authRoutes.post('/vincular-colaborador', async (req: Request, res: Response): Promise<void> => {
  try {
    const { gestorId, colaboradorId, empresaId, ePrincipal } = req.body;

    if (!gestorId || !colaboradorId) {
      res.status(400).json({ error: 'ID do Gestor e ID do Colaborador são obrigatórios.' });
      return;
    }

    const { data: vinculo, error } = await supabaseAdmin
      .from('TAB_Gestor_Colaborador')
      .upsert({
        Idf_Gestor: gestorId,
        Idf_Colaborador: colaboradorId,
        Idf_Empresa: empresaId || null,
        Flg_Gestor_Principal: ePrincipal ?? true
      }, { onConflict: 'Idf_Gestor,Idf_Colaborador' })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao vincular gestor e colaborador.', details: error.message });
      return;
    }

    res.json({ success: true, message: 'Vínculo estabelecido com sucesso.', vinculo });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno ao vincular gestor e colaborador.', details: err.message });
  }
});

// Envio de E-mail de Boas-Vindas com Senha Temporária / Matrícula
authRoutes.post('/send-welcome-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, nome, matricula, link } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'E-mail do destinatário não informado.' });
      return;
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

    const info = await transporter.sendMail({
      from: `"Pontual Gestão de Pessoas" <${EMAIL_USER}>`,
      replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
      to: email,
      subject: `Ativação de Acesso - Pontual Gestão de Pessoas`,
      text: plainText,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${email}! ID: ${info.messageId}`);
    res.json({
      success: true,
      simulated: false,
      message: `E-mail de ativação enviado com sucesso para ${email}!`,
      id: info.messageId
    });
  } catch (error: any) {
    console.error('[SMTP] Erro ao disparar e-mail:', error);
    res.status(500).json({
      success: false,
      message: `Falha ao enviar e-mail: ${error.message}`
    });
  }
});
