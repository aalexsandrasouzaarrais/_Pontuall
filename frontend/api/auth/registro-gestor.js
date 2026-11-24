import bcrypt from 'bcryptjs';
import {
  applyCorsHeaders,
  checkRateLimit,
  generateSecureMatricula,
  getSupabaseAdmin,
  isValidEmail,
  quotePostgrestValue,
  setSessionCookie,
  signHs256Jwt,
} from './_security.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!checkRateLimit(req, res, 'register-gestor', 5)) {
    return res.status(429).json({ error: 'Muitas tentativas de cadastro. Aguarde 15 minutos.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Serviço de cadastro não configurado no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nome, email, senha, cnpj, companyName, cargo, departamento, telefone, isRh } = body;

    if (!nome || !email || !senha || typeof senha !== 'string') {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const cleanNome = String(nome).trim().slice(0, 120);
    if (cleanNome.length < 2) {
      return res.status(400).json({ error: 'Informe um nome válido.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
    }

    const cleanPass = senha.trim();
    const weakPasswords = ['123456', '1234567', '12345678', '123456789', '000000', '111111', 'abcdef', 'senha123', 'admin123', 'password'];
    if (cleanPass.length < 6 || weakPasswords.includes(cleanPass.toLowerCase())) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres e não pode ser uma senha padrão ou sequencial.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const quotedEmail = quotePostgrestValue(cleanEmail);
    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : '';
    const cleanCompanyName = companyName ? String(companyName).trim().slice(0, 140) : '';

    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ error: 'Informe um CNPJ válido com 14 dígitos.' });
    }

    const { data: existente } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .limit(1)
      .maybeSingle();

    if (existente) {
      return res.status(409).json({
        code: 'DUPLICATE_EMAIL',
        error: 'Este e-mail corporativo já está cadastrado no sistema. Não é possível cadastrar novamente.',
      });
    }

    const cnpjFormatado = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    const { data: empresaExistente } = await supabaseAdmin
      .from('TAB_Empresa')
      .select('Idf_Empresa')
      .eq('Num_CNPJ', cnpjFormatado)
      .limit(1)
      .maybeSingle();

    if (empresaExistente) {
      return res.status(409).json({
        code: 'DUPLICATE_CNPJ',
        error: 'Este CNPJ já possui uma organização cadastrada no sistema. Solicite o convite diretamente ao gestor administrador da empresa.',
      });
    }

    const displayCompanyName = cleanCompanyName || `Organização ${cnpjFormatado}`;
    const { data: novaEmpresa, error: empError } = await supabaseAdmin
      .from('TAB_Empresa')
      .insert({
        Num_CNPJ: cnpjFormatado,
        Nme_Razao_Social: cleanCompanyName || `Empresa ${cnpjFormatado}`,
        Nme_Fantasia: displayCompanyName,
        Flg_Ativa: true,
      })
      .select()
      .single();

    if (empError || !novaEmpresa) {
      return res.status(500).json({ error: 'Erro ao registrar organização no banco de dados.' });
    }

    const idfEmpresa = novaEmpresa.Idf_Empresa;
    const isMasterManager = true;
    const perfilInicial = isRh ? 'rh' : 'gestor';
    const matricula = generateSecureMatricula('GST');
    const senhaHash = await bcrypt.hash(cleanPass, 12);

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
        Flg_Ativo: true,
      })
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .single();

    if (insertError || !novoGestor) {
      await supabaseAdmin.from('TAB_Empresa').delete().eq('Idf_Empresa', idfEmpresa);
      return res.status(500).json({ error: 'Erro ao cadastrar gestor no banco de dados.' });
    }

    const token = signHs256Jwt({
      sub: novoGestor.Idf_Colaborador,
      email: novoGestor.Eml_Corporativo,
      perfil: novoGestor.Tpo_Perfil,
      isMasterManager: true,
      companyId: idfEmpresa,
    });

    if (!token) {
      return res.status(503).json({ error: 'JWT_SECRET não configurado no servidor.' });
    }

    setSessionCookie(req, res, token);

    return res.status(201).json({
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
        avatar: novoGestor.Des_Avatar_Url,
        horasSemanais: novoGestor.Num_Horas_Semanais,
        companyId: idfEmpresa,
        companyCnpj: cnpjFormatado,
        isMasterManager,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Erro interno ao processar cadastro de gestor.' });
  }
}
