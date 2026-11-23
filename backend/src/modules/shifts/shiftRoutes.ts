import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import { AuthenticatedRequest, requireAuth, requireManagerOrRhAuth, isUuid } from '../../shared/authSecurity.js';

export const shiftRoutes = Router();

// Listar escalas com filtros obrigatórios de tenant/propriedade
shiftRoutes.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const { idf_colaborador, data_inicio, data_fim } = req.query;
    const isManager = ['gestor', 'rh', 'admin'].includes(String(authUser.perfil || '').toLowerCase()) || Boolean(authUser.isMasterManager);

    if (idf_colaborador && !isUuid(idf_colaborador)) {
      res.status(400).json({ error: 'Identificador de colaborador inválido.' });
      return;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((data_inicio && !datePattern.test(String(data_inicio))) || (data_fim && !datePattern.test(String(data_fim)))) {
      res.status(400).json({ error: 'Formato de data inválido (esperado YYYY-MM-DD).' });
      return;
    }

    if (!isManager && idf_colaborador && String(idf_colaborador) !== authUser.sub) {
      res.status(403).json({ error: 'Não é permitido consultar escalas de outro colaborador.' });
      return;
    }

    if (isManager && idf_colaborador && authUser.companyId) {
      const { data: targetColab } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Empresa')
        .eq('Idf_Colaborador', String(idf_colaborador))
        .maybeSingle();

      if (!targetColab || targetColab.Idf_Empresa !== authUser.companyId) {
        res.status(403).json({ error: 'Colaborador não pertence à sua organização.' });
        return;
      }
    }

    let query = supabaseAdmin
      .from('TAB_Escala_Turno')
      .select('*, TAB_Colaborador!inner(Nme_Colaborador, Tpo_Cargo, Des_Avatar_Url, Idf_Empresa)')
      .eq('Flg_Ativo', true)
      .order('Dta_Turno', { ascending: true })
      .order('Dta_Hora_Inicio', { ascending: true });

    if (!isManager) {
      query = query.eq('Idf_Colaborador', authUser.sub);
    } else if (authUser.companyId) {
      query = query.eq('TAB_Colaborador.Idf_Empresa', authUser.companyId);
      if (idf_colaborador) {
        query = query.eq('Idf_Colaborador', String(idf_colaborador));
      }
    } else {
      query = query.eq('Idf_Colaborador', authUser.sub);
    }

    if (data_inicio) {
      query = query.gte('Dta_Turno', String(data_inicio));
    }
    if (data_fim) {
      query = query.lte('Dta_Turno', String(data_fim));
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Erro ao consultar escalas.' });
      return;
    }

    res.json(data || []);
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar escalas.' });
  }
});

// Criar nova escala (restrito a Gestor/RH da mesma empresa)
shiftRoutes.post('/', requireManagerOrRhAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const {
      idf_colaborador,
      dta_turno,
      dta_hora_inicio,
      dta_hora_fim,
      num_minutos_intervalo,
      tpo_status_escala,
      tpo_turno,
      titulo_turno,
      des_observacao
    } = req.body || {};

    if (!isUuid(idf_colaborador) || !dta_turno || !dta_hora_inicio || !dta_hora_fim) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes ou inválidos.' });
      return;
    }

    // Valida se o colaborador pertence à mesma empresa do gestor autenticado
    const { data: targetColab } = await supabaseAdmin
      .from('TAB_Colaborador')
      .select('Idf_Colaborador, Idf_Empresa, Flg_Ativo')
      .eq('Idf_Colaborador', idf_colaborador)
      .eq('Flg_Ativo', true)
      .maybeSingle();

    if (!targetColab) {
      res.status(404).json({ error: 'Colaborador não encontrado ou inativo.' });
      return;
    }

    if (authUser.companyId && targetColab.Idf_Empresa !== authUser.companyId) {
      res.status(403).json({ error: 'Não é permitido criar escala para colaborador de outra organização.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Escala_Turno')
      .insert({
        Idf_Colaborador: idf_colaborador,
        Dta_Turno: dta_turno,
        Dta_Hora_Inicio: dta_hora_inicio,
        Dta_Hora_Fim: dta_hora_fim,
        Num_Minutos_Intervalo: Number(num_minutos_intervalo) || 60,
        Tpo_Status_Escala: tpo_status_escala || 'published',
        Tpo_Turno: tpo_turno || 'regular',
        Titulo_Turno: titulo_turno ? String(titulo_turno).slice(0, 120) : null,
        Des_Observacao: des_observacao ? String(des_observacao).slice(0, 2000) : null
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao criar escala no banco de dados.' });
      return;
    }

    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Erro interno ao criar escala.' });
  }
});
