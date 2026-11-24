import { applyCorsHeaders, authenticateRequest, getSupabaseAdmin, isUuid } from './_security.js';

export default async function handler(req, res) {
  applyCorsHeaders(req, res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const auth = await authenticateRequest(req);
  if (auth.status !== 200) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Serviço indisponível no servidor.' });
  }

  try {
    const authUser = auth.user;
    const { empresaId, gestorId } = req.query || {};
    const isManager = ['gestor', 'rh', 'admin'].includes(String(authUser.perfil || '').toLowerCase()) || Boolean(authUser.isMasterManager);

    if (empresaId && (!isUuid(empresaId) || (authUser.companyId && String(empresaId) !== authUser.companyId))) {
      return res.status(403).json({ error: 'Acesso negado a dados de outra empresa.' });
    }

    if (gestorId && !isUuid(gestorId)) {
      return res.status(400).json({ error: 'Identificador de gestor inválido.' });
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
      return res.status(500).json({ error: 'Erro ao consultar colaboradores.' });
    }

    if (gestorId && isManager && colaboradores) {
      const { data: vinculos } = await supabaseAdmin
        .from('TAB_Gestor_Colaborador')
        .select('Idf_Colaborador')
        .eq('Idf_Gestor', String(gestorId));

      const idsPermitidos = new Set(vinculos?.map((v) => v.Idf_Colaborador) || []);
      const filtrados = colaboradores.filter((c) => idsPermitidos.has(c.Idf_Colaborador) || c.Flg_Gestor_Master);
      return res.status(200).json(filtrados);
    }

    return res.status(200).json(colaboradores || []);
  } catch {
    return res.status(500).json({ error: 'Erro interno ao consultar colaboradores.' });
  }
}
