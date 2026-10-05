import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import nodemailer from 'nodemailer';

export const authRoutes = Router();

const EMAIL_USER = process.env.EMAIL_USER || 'pontual.escalas@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'xiqp afqt inqe qizb';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
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

    // Validação de senha
    if (usuario.Des_Senha_Hash !== senha) {
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

    // 3. Cadastra o Gestor no banco
    const { data: novoGestor, error: insertError } = await supabaseAdmin
      .from('TAB_Colaborador')
      .insert({
        Cod_Matricula: matricula,
        Nme_Colaborador: nome.trim(),
        Eml_Corporativo: cleanEmail,
        Des_Senha_Hash: senha,
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
