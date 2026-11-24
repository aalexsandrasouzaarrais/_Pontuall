import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import nodemailer, { Transporter } from 'nodemailer';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  AuthenticatedRequest,
  signAuthToken,
  requireAuth,
  requireRole,
  setSessionCookie,
  clearSessionCookie,
  escapeHtml,
  isValidEmail,
  maskEmail,
  getTrustedAppUrl,
  createPasswordResetToken,
  consumePasswordResetToken,
  isUuid,
  quotePostgrestValue,
  generateSecureMatricula,
  safeTimingEqual,
} from '../../shared/authSecurity.js';

export const authRoutes = Router();

const EMAIL_USER = process.env.EMAIL_USER?.trim() || '';
const EMAIL_PASS = process.env.EMAIL_PASS?.trim() || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;

let cachedTransporter: Transporter | null = null;

function getMailTransporter(): Transporter | null {
  if (!EMAIL_USER || !EMAIL_PASS) {
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });
  }
  return cachedTransporter;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

const welcomeEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Limite de envios de e-mail atingido. Aguarde 15 minutos.' },
});

const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas solicitações de redefinição. Aguarde 15 minutos.' },
});

const resetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de redefinição. Aguarde 15 minutos.' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Aguarde 15 minutos.' },
});

// Login de colaborador ou gestor (suporta e-mail corporativo ou matrícula)
authRoutes.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { identificador, email, senha, perfil } = req.body || {};
    const rawIdent = String(identificador ?? email ?? '').trim();

    if (!rawIdent || !senha || typeof senha !== 'string') {
      res.status(400).json({ error: 'E-mail/matrícula e senha são obrigatórios.' });
      return;
    }

    let usuario: any = null;

    if (rawIdent.includes('@')) {
      if (!isValidEmail(rawIdent)) {
        res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
        return;
      }

      const cleanEmail = rawIdent.toLowerCase();
      const quotedEmail = quotePostgrestValue(cleanEmail);

      const { data, error } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Eml_Secundario, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master, Des_Senha_Hash, Flg_Ativo')
        .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
        .eq('Flg_Ativo', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
        return;
      }
      usuario = data;
    } else {
      if (rawIdent.length > 60) {
        res.status(400).json({ error: 'Matrícula inválida.' });
        return;
      }

      const quotedExact = quotePostgrestValue(rawIdent);
      const quotedLike = quotePostgrestValue(`%${rawIdent}%`);

      const { data: rows, error } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Eml_Secundario, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master, Des_Senha_Hash, Flg_Ativo')
        .or(`Cod_Matricula.ilike.${quotedLike},Cod_Matricula.ilike.${quotedExact}`)
        .eq('Flg_Ativo', true)
        .limit(10);

      if (error) {
        res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
        return;
      }

      if (rows && rows.length > 0) {
        const normIdent = rawIdent.toLowerCase();
        const exactMatches = rows.filter(
          (r: any) => String(r.Cod_Matricula || '').trim().toLowerCase() === normIdent
        );
        const pool = exactMatches.length > 0 ? exactMatches : rows;
        const withCustomPass = pool.find((r: any) => {
          if (!r.Des_Senha_Hash || !r.Cod_Matricula) return false;
          try {
            return !bcrypt.compareSync(String(r.Cod_Matricula).trim(), r.Des_Senha_Hash);
          } catch {
            return false;
          }
        });
        usuario = withCustomPass || pool[0];
      }
    }

    if (!usuario) {
      res.status(401).json({ error: 'E-mail, matrícula ou senha inválidos.' });
      return;
    }

    // Validação de senha segura com bcrypt (e suporte de 1º acesso se senha provisória for matrícula em caixa distinta)
    const isBcrypt = usuario.Des_Senha_Hash?.startsWith('$2');
    let senhaValida = false;
    if (isBcrypt) {
      senhaValida = await bcrypt.compare(senha, usuario.Des_Senha_Hash);
      if (!senhaValida && usuario.Cod_Matricula) {
        const matTrim = String(usuario.Cod_Matricula).trim();
        if (senha.trim().toLowerCase() === matTrim.toLowerCase()) {
          senhaValida = await bcrypt.compare(matTrim, usuario.Des_Senha_Hash) || await bcrypt.compare(matTrim.toUpperCase(), usuario.Des_Senha_Hash);
        }
      }
    } else if (typeof usuario.Des_Senha_Hash === 'string' && usuario.Des_Senha_Hash.length > 0) {
      senhaValida = safeTimingEqual(usuario.Des_Senha_Hash, senha);
      if (senhaValida) {
        const novoHash = await bcrypt.hash(senha, 12);
        await supabaseAdmin
          .from('TAB_Colaborador')
          .update({ Des_Senha_Hash: novoHash })
          .eq('Idf_Colaborador', usuario.Idf_Colaborador);
      }
    }

    if (!senhaValida) {
      res.status(401).json({ error: 'E-mail, matrícula ou senha inválidos.' });
      return;
    }

    // Só valida perfil após confirmação das credenciais para evitar enumeração de contas
    if (perfil && usuario.Tpo_Perfil !== perfil) {
      res.status(403).json({
        error: 'Esta conta pertence a outro perfil de acesso. Selecione a aba correspondente.'
      });
      return;
    }

    // Busca empresa do usuário se vinculada
    let empresaData = null;
    if (usuario.Idf_Empresa) {
      const { data: emp } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('Num_CNPJ')
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

    const token = signAuthToken({
      sub: usuario.Idf_Colaborador,
      email: usuario.Eml_Corporativo,
      perfil: usuario.Tpo_Perfil,
      isMasterManager: Boolean(usuario.Flg_Gestor_Master),
      companyId: usuario.Idf_Empresa || null,
    });

    setSessionCookie(req, res, token);

    // Retorna os dados do usuário autenticado (sem Des_Senha_Hash) e token JWT
    res.json({
      success: true,
      token,
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
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Encerra sessão autenticada limpando cookie HttpOnly
authRoutes.post('/logout', (req: Request, res: Response): void => {
  clearSessionCookie(req, res);
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// Retorna perfil do usuário autenticado via JWT
authRoutes.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const { data: usuario, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .eq('Idf_Colaborador', authUser.sub)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error || !usuario) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    let companyCnpj: string | undefined;
    if (usuario.Idf_Empresa) {
      const { data: emp } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('Num_CNPJ')
        .eq('Idf_Empresa', usuario.Idf_Empresa)
        .maybeSingle();
      companyCnpj = emp?.Num_CNPJ;
    }

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
        companyCnpj,
        isMasterManager: Boolean(usuario.Flg_Gestor_Master),
      },
    });
  } catch {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Listar colaboradores (autenticado e restrito à empresa do usuário)
authRoutes.get('/colaboradores', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Autenticação necessária.' });
      return;
    }

    const { empresaId, gestorId } = req.query;
    const isManager = ['gestor', 'rh', 'admin'].includes(String(authUser.perfil || '').toLowerCase()) || Boolean(authUser.isMasterManager);

    if (empresaId && (!isUuid(empresaId) || (authUser.companyId && String(empresaId) !== authUser.companyId))) {
      res.status(403).json({ error: 'Acesso negado a dados de outra empresa.' });
      return;
    }

    if (gestorId && !isUuid(gestorId)) {
      res.status(400).json({ error: 'Identificador de gestor inválido.' });
      return;
    }

    let query = supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Telefone, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .eq('Flg_Ativo', true);

    if (!isManager) {
      query = query.eq('Idf_Colaborador', authUser.sub);
    } else if (authUser.companyId) {
      query = query.eq('Idf_Empresa', authUser.companyId);
    } else {
      query = query.eq('Idf_Colaborador', authUser.sub);
    }

    const { data: colaboradores, error } = await query.order('Nme_Colaborador');

    if (error) {
      res.status(500).json({ error: 'Erro ao consultar colaboradores.' });
      return;
    }

    if (gestorId && isManager && colaboradores) {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Colaborador')
        .eq('Idf_Gestor', String(gestorId));

      const idsPermitidos = new Set(vinculos?.map((v: any) => v.Idf_Colaborador) || []);
      const filtrados = colaboradores.filter(c => idsPermitidos.has(c.Idf_Colaborador) || c.Flg_Gestor_Master);
      res.json(filtrados);
      return;
    }

    res.json(colaboradores || []);
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar colaboradores.' });
  }
});

// Cadastro de novo gestor com criação exclusiva de empresa por CNPJ
authRoutes.post('/registro-gestor', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { nome, email, senha, cnpj, companyName, cargo, departamento, telefone, isRh } = req.body || {};

    if (!nome || !email || !senha || typeof senha !== 'string') {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      return;
    }

    const cleanNome = String(nome).trim().slice(0, 120);
    if (cleanNome.length < 2) {
      res.status(400).json({ error: 'Informe um nome válido.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
      return;
    }

    const cleanPass = senha.trim();
    const weakPasswords = ['123456', '1234567', '12345678', '123456789', '000000', '111111', 'abcdef', 'senha123', 'admin123', 'password'];
    if (cleanPass.length < 6 || weakPasswords.includes(cleanPass.toLowerCase())) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres e não pode ser uma senha padrão ou sequencial.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const quotedEmail = quotePostgrestValue(cleanEmail);
    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : '';
    const cleanCompanyName = companyName ? String(companyName).trim().slice(0, 140) : '';

    if (cleanCnpj.length !== 14) {
      res.status(400).json({ error: 'Informe um CNPJ válido com 14 dígitos.' });
      return;
    }

    // 1. Verifica se já existe colaborador com o mesmo e-mail (corporativo ou secundário)
    const { data: existente } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .limit(1)
      .maybeSingle();

    if (existente) {
      res.status(409).json({
        code: 'DUPLICATE_EMAIL',
        error: 'Este e-mail corporativo já está cadastrado no sistema. Não é possível cadastrar novamente.'
      });
      return;
    }

    const cnpjFormatado = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    // 2. Bloqueia ingresso automático em empresa existente via auto-cadastro
    const { data: empresaExistente } = await supabaseAdmin
      .from('TAB_Empresa')
      .select('Idf_Empresa')
      .eq('Num_CNPJ', cnpjFormatado)
      .limit(1)
      .maybeSingle();

    if (empresaExistente) {
      res.status(409).json({
        code: 'DUPLICATE_CNPJ',
        error: 'Este CNPJ já possui uma organização cadastrada no sistema. Solicite o convite diretamente ao gestor administrador da empresa.'
      });
      return;
    }

    const displayCompanyName = cleanCompanyName || `Organização ${cnpjFormatado}`;
    const { data: novaEmpresa, error: empError } = await supabaseAdmin
      .from('TAB_Empresa')
      .insert({
        Num_CNPJ: cnpjFormatado,
        Nme_Razao_Social: cleanCompanyName || `Empresa ${cnpjFormatado}`,
        Nme_Fantasia: displayCompanyName,
        Flg_Ativa: true
      })
      .select()
      .single();

    if (empError || !novaEmpresa) {
      res.status(500).json({ error: 'Erro ao registrar organização no banco de dados.' });
      return;
    }

    const idfEmpresa = novaEmpresa.Idf_Empresa;
    const isMasterManager = true;
    const perfilInicial = isRh ? 'rh' : 'gestor';
    const matricula = generateSecureMatricula('GST');
    const senhaHash = await bcrypt.hash(cleanPass, 12);

    // 3. Cadastra o Gestor Master da nova empresa
    const { data: novoGestor, error: insertError } = await supabaseAdmin
      .from('TAB_Colaborador')
      .insert({
        Cod_Matricula: matricula,
        Nme_Colaborador: cleanNome,
        Eml_Corporativo: cleanEmail,
        Des_Senha_Hash: senhaHash,
        Tpo_Perfil: perfilInicial,
        Tpo_Cargo: cargo ? String(cargo).trim().slice(0, 80) : (isRh ? 'Gerente de RH & Administração Geral' : 'Gestor Geral'),
        Des_Departamento: departamento ? String(departamento).trim().slice(0, 80) : (isRh ? 'Recursos Humanos & Gestão Geral' : 'Gestão de Pessoas & Operações'),
        Des_Avatar_Url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        Num_Telefone: telefone ? String(telefone).trim().slice(0, 30) : '(11) 98765-4321',
        Num_Horas_Semanais: 44,
        Idf_Empresa: idfEmpresa,
        Flg_Gestor_Master: isMasterManager,
        Flg_Ativo: true
      })
      .select()
      .single();

    if (insertError || !novoGestor) {
      // Rollback best-effort da empresa recém-criada em caso de falha ao criar gestor
      await supabaseAdmin.from('TAB_Empresa').delete().eq('Idf_Empresa', idfEmpresa);
      res.status(500).json({ error: 'Erro ao cadastrar gestor no banco de dados.' });
      return;
    }

    const token = signAuthToken({
      sub: novoGestor.Idf_Colaborador,
      email: novoGestor.Eml_Corporativo,
      perfil: novoGestor.Tpo_Perfil,
      isMasterManager: true,
      companyId: idfEmpresa,
    });

    setSessionCookie(req, res, token);

    res.status(201).json({
      success: true,
      message: 'Gestor cadastrado com sucesso!',
      token,
      gestor: {
        id: novoGestor.Idf_Colaborador,
        matricula: novoGestor.Cod_Matricula,
        nome: novoGestor.Nme_Colaborador,
        email: novoGestor.Eml_Corporativo,
        perfil: novoGestor.Tpo_Perfil,
        cargo: novoGestor.Tpo_Cargo,
        departamento: novoGestor.Des_Departamento,
        companyId: idfEmpresa,
        companyCnpj: cnpjFormatado,
        isMasterManager
      }
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao processar cadastro de gestor.' });
  }
});

// Vincular Colaborador a um Gestor (restrito a Gestor/RH da mesma empresa)
authRoutes.post('/vincular-colaborador', requireRole('gestor', 'rh', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.companyId) {
      res.status(403).json({ error: 'Gestor sem empresa vinculada.' });
      return;
    }

    const { gestorId, colaboradorId, ePrincipal } = req.body || {};

    if (!isUuid(gestorId) || !isUuid(colaboradorId)) {
      res.status(400).json({ error: 'IDs de gestor e colaborador inválidos.' });
      return;
    }

    const { data: membros } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Idf_Empresa, Tpo_Perfil, Flg_Gestor_Master')
      .in('Idf_Colaborador', [gestorId, colaboradorId])
      .eq('Flg_Ativo', true);

    const gestorReg = membros?.find(m => m.Idf_Colaborador === gestorId);
    const colabReg = membros?.find(m => m.Idf_Colaborador === colaboradorId);

    if (!gestorReg || !colabReg) {
      res.status(404).json({ error: 'Gestor ou colaborador não encontrado.' });
      return;
    }

    if (gestorReg.Idf_Empresa !== authUser.companyId || colabReg.Idf_Empresa !== authUser.companyId) {
      res.status(403).json({ error: 'Não é permitido vincular membros de outra organização.' });
      return;
    }

    const { data: vinculo, error } = await supabaseAdmin
      .from('TAB_Gestor_Colaborador')
      .upsert({
        Idf_Gestor: gestorId,
        Idf_Colaborador: colaboradorId,
        Idf_Empresa: authUser.companyId,
        Flg_Gestor_Principal: Boolean(ePrincipal ?? true)
      }, { onConflict: 'Idf_Gestor,Idf_Colaborador' })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao vincular gestor e colaborador.' });
      return;
    }

    res.json({ success: true, message: 'Vínculo estabelecido com sucesso.', vinculo });
  } catch {
    res.status(500).json({ error: 'Erro interno ao vincular gestor e colaborador.' });
  }
});

// Envio de E-mail de Boas-Vindas com link seguro de ativação (restrito a Gestores e RH)
authRoutes.post('/send-welcome-email', requireRole('gestor', 'rh', 'admin'), welcomeEmailLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, nome, matricula } = req.body || {};

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'E-mail do destinatário inválido ou não informado.' });
      return;
    }

    const transporter = getMailTransporter();
    if (!transporter) {
      res.status(503).json({ success: false, message: 'Serviço de envio de e-mail temporariamente indisponível.' });
      return;
    }

    const appUrl = getTrustedAppUrl();
    if (!appUrl) {
      res.status(500).json({ success: false, message: 'Serviço de envio de e-mail temporariamente indisponível.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = String(nome || 'Colaborador').trim().slice(0, 100);
    const cleanMatricula = String(matricula || 'PNT-1000').trim().slice(0, 40);

    const authUser = (req as AuthenticatedRequest).authUser;

    // Localiza colaborador pelo e-mail corporativo para vincular token de uso único (ignora link/origin do cliente)
    let colab: { Idf_Colaborador: string; Cod_Matricula: string | null; Idf_Empresa: string | null } | null = null;
    const { data: exactColab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Idf_Empresa')
      .eq('Eml_Corporativo', cleanEmail)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (exactColab) {
      colab = exactColab;
    } else {
      const { data: ilikeColab } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Idf_Empresa')
        .ilike('Eml_Corporativo', cleanEmail)
        .eq('Flg_Ativo', true)
        .maybeSingle();
      colab = ilikeColab || null;
    }

    if (colab && authUser?.companyId && colab.Idf_Empresa && colab.Idf_Empresa !== authUser.companyId) {
      res.status(403).json({ success: false, message: 'Não é permitido enviar ativação para colaborador de outra organização.' });
      return;
    }

    const resetLink = colab
      ? `${appUrl}/redefinir-senha?token=${encodeURIComponent(await createPasswordResetToken(colab.Idf_Colaborador, colab.Cod_Matricula || cleanMatricula))}`
      : `${appUrl}/login`;

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
                      Clique no botão abaixo para acessar o Portal do Colaborador e concluir o seu acesso:
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
      from: `"Pontual Gestão de Pessoas" <${EMAIL_USER}>`,
      replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
      to: cleanEmail,
      subject: `Ativação de Acesso - Pontual Gestão de Pessoas`,
      text: plainText,
      html,
    });

    console.log(`[SMTP] E-mail enviado com sucesso para ${maskEmail(cleanEmail)}! ID: ${info.messageId}`);
    res.json({
      success: true,
      simulated: false,
      message: 'E-mail de ativação enviado com sucesso!',
      id: info.messageId
    });
  } catch (error: any) {
    console.error('[SMTP] Erro ao disparar e-mail:', String(error?.code || error?.message || 'Erro interno').slice(0, 160));
    res.status(500).json({
      success: false,
      message: 'Falha ao enviar e-mail de ativação.'
    });
  }
});

// Solicitação de redefinição de senha via link criptográfico enviado por e-mail
authRoutes.post('/request-password-reset', resetRequestLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Informe um e-mail corporativo válido.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const quotedEmail = quotePostgrestValue(cleanEmail);
    const genericMessage = 'Se o e-mail estiver cadastrado, enviaremos um link seguro de redefinição de senha válido por 30 minutos.';

    const { data: user } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Nme_Colaborador, Cod_Matricula, Eml_Corporativo')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .eq('Flg_Ativo', true)
      .limit(1)
      .maybeSingle();

    const transporter = getMailTransporter();
    const appUrl = getTrustedAppUrl();

    if (user && transporter && appUrl) {
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
                    <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#670D20;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:600;padding:13px 28px;border-radius:8px;">
                      Redefinir Minha Senha
                    </a>
                  </p>
                  <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">
                    Caso não tenha solicitado, ignore esta mensagem. Link alternativo: <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a>
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
          from: `"Pontual Gestão de Pessoas" <${EMAIL_USER}>`,
          replyTo: `"Suporte Pontual" <${EMAIL_USER}>`,
          to: targetEmail,
          subject: 'Redefinição de Senha - Pontual',
          text: plainText,
          html,
        });
        console.log(`[SMTP] Link de redefinição enviado para ${maskEmail(targetEmail)}.`);
      } catch (mailErr: any) {
        console.error('[SMTP] Erro ao enviar link de redefinição:', String(mailErr?.code || mailErr?.message || 'Erro interno').slice(0, 160));
      }
    }

    res.status(200).json({ success: true, message: genericMessage });
  } catch {
    res.status(500).json({ success: false, message: 'Não foi possível processar a solicitação no momento.' });
  }
});

// Confirmação da redefinição de senha usando token criptográfico de uso único
authRoutes.post('/reset-password', resetConfirmLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, novaSenha } = req.body || {};

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token.trim())) {
      res.status(400).json({ success: false, message: 'Link de redefinição inválido ou expirado. Solicite um novo link.' });
      return;
    }

    if (typeof novaSenha !== 'string' || novaSenha.trim().length < 6) {
      res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    const cleanPass = novaSenha.trim();
    const weakPasswords = ['123456', '1234567', '12345678', '123456789', '000000', '111111', 'abcdef', 'senha123', 'admin123', 'password'];
    if (weakPasswords.includes(cleanPass.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Por segurança, não utilize senhas sequenciais ou padrão (como 123456). Crie uma senha mais forte.',
      });
      return;
    }

    const tokenData = await consumePasswordResetToken(token);
    if (!tokenData) {
      res.status(400).json({ success: false, message: 'Link de redefinição inválido ou expirado. Solicite um novo link.' });
      return;
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula')
      .eq('Idf_Colaborador', tokenData.colaboradorId)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (userErr || !user) {
      res.status(400).json({ success: false, message: 'Conta não encontrada ou inativa.' });
      return;
    }

    const mat = String(user.Cod_Matricula || tokenData.matricula || '').trim().toLowerCase();
    const matDigits = mat.replace(/^pnt-|^gst-|^col-|^mat-/i, '');
    if (
      (mat && cleanPass.toLowerCase() === mat) ||
      (matDigits.length >= 3 && cleanPass.toLowerCase() === matDigits)
    ) {
      res.status(400).json({
        success: false,
        message: 'A nova senha não pode ser igual à sua matrícula. Crie uma senha pessoal exclusiva.',
      });
      return;
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
      res.status(500).json({ success: false, message: 'Erro ao atualizar senha no banco de dados.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com sua nova senha.',
    });
  } catch {
    res.status(500).json({ success: false, message: 'Erro interno ao processar a redefinição de senha.' });
  }
});
