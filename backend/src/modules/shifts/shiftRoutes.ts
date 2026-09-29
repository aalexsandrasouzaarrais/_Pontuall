import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';

export const shiftRoutes = Router();

// Listar escalas com filtros opcionais por colaborador ou data
shiftRoutes.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idf_colaborador, data_inicio, data_fim } = req.query;

    let query = supabaseAdmin
      .from('TAB_Escala_Turno')
      .select('*, TAB_Colaborador(Nme_Colaborador, Tpo_Cargo, Des_Avatar_Url)')
      .eq('Flg_Ativo', true)
      .order('Dta_Turno', { ascending: true })
      .order('Dta_Hora_Inicio', { ascending: true });

    if (idf_colaborador) {
      query = query.eq('Idf_Colaborador', String(idf_colaborador));
    }
    if (data_inicio) {
      query = query.gte('Dta_Turno', String(data_inicio));
    }
    if (data_fim) {
      query = query.lte('Dta_Turno', String(data_fim));
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Criar nova escala
shiftRoutes.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
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
    } = req.body;

    if (!idf_colaborador || !dta_turno || !dta_hora_inicio || !dta_hora_fim) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Escala_Turno')
      .insert({
        Idf_Colaborador: idf_colaborador,
        Dta_Turno: dta_turno,
        Dta_Hora_Inicio: dta_hora_inicio,
        Dta_Hora_Fim: dta_hora_fim,
        Num_Minutos_Intervalo: num_minutos_intervalo || 60,
        Tpo_Status_Escala: tpo_status_escala || 'published',
        Tpo_Turno: tpo_turno || 'regular',
        Titulo_Turno: titulo_turno,
        Des_Observacao: des_observacao
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
