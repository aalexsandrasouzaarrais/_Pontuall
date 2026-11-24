import bcrypt from 'bcryptjs';
import {
  applyCorsHeaders,
  checkRateLimit,
  getSupabaseAdmin,
  isValidEmail,
  quotePostgrestValue,
  safeTimingEqual,
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

  if (!checkRateLimit(req, res, 'login', 10)) {
    return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde 15 minutos.' });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Serviço de autenticação não configurado no servidor.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { identificador, email, senha, perfil } = body;
    const rawIdent = String(identificador ?? email ?? '').trim();

    if (!rawIdent || !senha || typeof senha !== 'string') {
      return res.status(400).json({ error: 'E-mail/matrícula e senha são obrigatórios.' });
    }

    let usuario = null;

    if (rawIdent.includes('@')) {
      if (!isValidEmail(rawIdent)) {
        return res.status(400).json({ error: 'Informe um e-mail corporativo válido.' });
      }

      const cleanEmail = rawIdent.toLowerCase();
      const quotedEmail = quotePostgrestValue(cleanEmail);

      const { data, error } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master, Des_Senha_Hash, Flg_Ativo')
        .or(`Eml_Corporativo.ilike.${quotedEmail},Eml_Secundario.ilike.${quotedEmail}`)
        .eq('Flg_Ativo', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
      }
      usuario = data;
    } else {
      if (rawIdent.length > 60) {
        return res.status(400).json({ error: 'Matrícula inválida.' });
      }

      const quotedExact = quotePostgrestValue(rawIdent);
      const quotedLike = quotePostgrestValue(`%${rawIdent}%`);

      const { data: rows, error } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master, Des_Senha_Hash, Flg_Ativo')
        .or(`Cod_Matricula.ilike.${quotedLike},Cod_Matricula.ilike.${quotedExact}`)
        .eq('Flg_Ativo', true)
        .limit(10);

      if (error) {
        return res.status(500).json({ error: 'Erro interno ao processar autenticação.' });
      }

      if (rows && rows.length > 0) {
        const normIdent = rawIdent.toLowerCase();
        const exactMatches = rows.filter(
          (r) => String(r.Cod_Matricula || '').trim().toLowerCase() === normIdent
        );
        const pool = exactMatches.length > 0 ? exactMatches : rows;
        const withCustomPass = pool.find((r) => {
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
      return res.status(401).json({ error: 'E-mail, matrícula ou senha inválidos.' });
    }

    const isBcrypt = usuario.Des_Senha_Hash?.startsWith('$2');
    let senhaValida = false;
    if (isBcrypt) {
      senhaValida = await bcrypt.compare(senha, usuario.Des_Senha_Hash);
      if (!senhaValida && usuario.Cod_Matricula) {
        const matTrim = String(usuario.Cod_Matricula).trim();
        if (senha.trim().toLowerCase() === matTrim.toLowerCase()) {
          senhaValida =
            (await bcrypt.compare(matTrim, usuario.Des_Senha_Hash)) ||
            (await bcrypt.compare(matTrim.toUpperCase(), usuario.Des_Senha_Hash));
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
      return res.status(401).json({ error: 'E-mail, matrícula ou senha inválidos.' });
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
      return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
    }

    setSessionCookie(req, res, token);

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
