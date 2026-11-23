import bcrypt from 'bcryptjs';
import {
  applyCorsHeaders,
  checkRateLimit,
  getSupabaseAdmin,
  isValidEmail,
  quotePostgrestValue,
  safeTimingEqual,
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

  if (!checkRateLimit(req, res, 'login', 10)) {
    return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 15 minutos.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Serviço de autenticação não configurado no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, senha, perfil } = body;

    if (!email || !senha || typeof senha !== 'string') {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const quotedEmail = quotePostgrestValue(cleanEmail);

    const { data: usuario, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master, Des_Senha_Hash, Flg_Ativo')
      .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
      .eq('Flg_Ativo', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const isBcrypt = usuario.Des_Senha_Hash?.startsWith('$2');
    let senhaValida = false;
    if (isBcrypt) {
      senhaValida = await bcrypt.compare(senha, usuario.Des_Senha_Hash);
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
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    if (perfil && usuario.Tpo_Perfil !== perfil) {
      return res.status(403).json({
        error: 'Esta conta pertence a outro perfil de acesso. Selecione a aba correspondente.',
      });
    }

    let companyCnpj = undefined;
    if (usuario.Idf_Empresa) {
      const { data: emp } = await supabaseAdmin
        .from('TAB_Empresa')
        .select('Num_CNPJ')
        .eq('Idf_Empresa', usuario.Idf_Empresa)
        .maybeSingle();
      companyCnpj = emp?.Num_CNPJ;
    }

    let gestorIds = [];
    if (usuario.Tpo_Perfil === 'colaborador') {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Gestor')
        .eq('Idf_Colaborador', usuario.Idf_Colaborador);
      if (vinculos) {
        gestorIds = vinculos.map((v) => v.Idf_Gestor);
      }
    }

    const token = signHs256Jwt({
      sub: usuario.Idf_Colaborador,
      email: usuario.Eml_Corporativo,
      perfil: usuario.Tpo_Perfil,
      isMasterManager: Boolean(usuario.Flg_Gestor_Master),
      companyId: usuario.Idf_Empresa || null,
    });

    if (!token) {
      return res.status(503).json({ error: 'JWT_SECRET não configurado no servidor.' });
    }

    return res.status(200).json({
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
        companyCnpj,
        isMasterManager: usuario.Flg_Gestor_Master || false,
        managerIds: gestorIds,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
