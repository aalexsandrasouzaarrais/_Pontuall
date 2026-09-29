import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';

export const requestRoutes = Router();

// Listar solicitações
requestRoutes.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idf_colaborador } = req.query;

    let query = supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .select('*, solicitante:TAB_Colaborador!Idf_Colaborador_Solicitante(Nme_Colaborador, Des_Avatar_Url), destino:TAB_Colaborador!Idf_Colaborador_Destino(Nme_Colaborador)')
      .order('Dta_Cadastro', { ascending: false });

    if (idf_colaborador) {
      query = query.or(`Idf_Colaborador_Solicitante.eq.${idf_colaborador},Idf_Colaborador_Destino.eq.${idf_colaborador}`);
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

// Criar nova solicitação de troca ou folga
requestRoutes.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idf_colaborador_solicitante,
      idf_colaborador_destino,
      idf_turno,
      tpo_solicitacao,
      dta_solicitada,
      des_motivo
    } = req.body;

    if (!idf_colaborador_solicitante || !tpo_solicitacao || !dta_solicitada || !des_motivo) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .insert({
        Idf_Colaborador_Solicitante: idf_colaborador_solicitante,
        Idf_Colaborador_Destino: idf_colaborador_destino || null,
        Idf_Turno: idf_turno || null,
        Tpo_Solicitacao: tpo_solicitacao,
        Dta_Solicitada: dta_solicitada,
        Des_Motivo: des_motivo,
        Tpo_Status_Solicitacao: 'pending'
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

// Aprovar ou recusar solicitação pelo gestor
requestRoutes.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, parecer_gestor } = req.body; // status: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Status deve ser "approved" ou "rejected".' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .update({
        Tpo_Status_Solicitacao: status,
        Des_Parecer_Gestor: parecer_gestor || null,
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Solicitacao', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
