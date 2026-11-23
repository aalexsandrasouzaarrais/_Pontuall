import { applyCorsHeaders, authenticateRequest, getSupabaseAdmin } from './_security.js';

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
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Serviço indisponível no servidor.' });
  }

  try {
    const { data: usuario, error } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Cod_Matricula, Nme_Colaborador, Eml_Corporativo, Tpo_Perfil, Tpo_Cargo, Des_Departamento, Des_Avatar_Url, Num_Horas_Semanais, Idf_Empresa, Flg_Gestor_Master')
      .eq('Idf_Colaborador', auth.user.sub)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (error || !usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
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

    return res.status(200).json({
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
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
