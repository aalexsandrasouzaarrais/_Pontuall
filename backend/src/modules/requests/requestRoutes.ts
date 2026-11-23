import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import {
  AuthenticatedRequest,
  requireAuth,
  requireManagerOrRhAuth,
  isUuid,
  quotePostgrestValue,
} from '../../shared/authSecurity.js';

export const requestRoutes = Router();

// Listar solicitações com isolamento por usuário/empresa
requestRoutes.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const { idf_colaborador } = req.query;
    const isManager = ['gestor', 'rh', 'admin'].includes(String(authUser.perfil || '').toLowerCase()) || Boolean(authUser.isMasterManager);

    if (idf_colaborador && !isUuid(idf_colaborador)) {
      res.status(400).json({ error: 'Identificador de colaborador inválido.' });
      return;
    }

    if (!isManager && idf_colaborador && String(idf_colaborador) !== authUser.sub) {
      res.status(403).json({ error: 'Não é permitido consultar solicitações de outro colaborador.' });
      return;
    }

    let query = supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .select('*, solicitante:TAB_Colaborador!Idf_Colaborador_Solicitante(Nme_Colaborador, Des_Avatar_Url, Idf_Empresa), destino:TAB_Colaborador!Idf_Colaborador_Destino(Nme_Colaborador)')
      .order('Dta_Cadastro', { ascending: false });

    if (!isManager) {
      const quotedSelf = quotePostgrestValue(authUser.sub);
      query = query.or(`Idf_Colaborador_Solicitante.eq.${quotedSelf},Idf_Colaborador_Destino.eq.${quotedSelf}`);
    } else if (authUser.companyId) {
      const { data: companyColabs } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador')
        .eq('Idf_Empresa', authUser.companyId);

      const companyIds = (companyColabs || []).map((c: any) => c.Idf_Colaborador).filter(Boolean);
      if (companyIds.length === 0) {
        res.json([]);
        return;
      }

      if (idf_colaborador) {
        const targetId = String(idf_colaborador);
        if (!companyIds.includes(targetId)) {
          res.status(403).json({ error: 'Colaborador não pertence à sua organização.' });
          return;
        }
        const quotedTarget = quotePostgrestValue(targetId);
        query = query.or(`Idf_Colaborador_Solicitante.eq.${quotedTarget},Idf_Colaborador_Destino.eq.${quotedTarget}`);
      } else {
        query = query.in('Idf_Colaborador_Solicitante', companyIds);
      }
    } else {
      const quotedSelf = quotePostgrestValue(authUser.sub);
      query = query.or(`Idf_Colaborador_Solicitante.eq.${quotedSelf},Idf_Colaborador_Destino.eq.${quotedSelf}`);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: 'Erro ao consultar solicitações.' });
      return;
    }

    res.json(data || []);
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar solicitações.' });
  }
});

// Criar nova solicitação de troca ou folga autenticada como solicitante real
requestRoutes.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const {
      idf_colaborador_destino,
      idf_turno,
      tpo_solicitacao,
      dta_solicitada,
      des_motivo
    } = req.body || {};

    if (!tpo_solicitacao || !dta_solicitada || !des_motivo) {
      res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      return;
    }

    if (idf_colaborador_destino && !isUuid(idf_colaborador_destino)) {
      res.status(400).json({ error: 'Destinatário inválido.' });
      return;
    }

    if (idf_turno && !isUuid(idf_turno)) {
      res.status(400).json({ error: 'Identificador de turno inválido.' });
      return;
    }

    const solicitanteId = authUser.sub;
    const isSwap = ['troca', 'swap'].includes(String(tpo_solicitacao).toLowerCase());
    if (idf_colaborador_destino) {
      const { data: colabs } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Colaborador, Idf_Empresa, Des_Departamento')
        .in('Idf_Colaborador', [solicitanteId, idf_colaborador_destino]);

      const solicitante = colabs?.find(c => c.Idf_Colaborador === solicitanteId);
      const destino = colabs?.find(c => c.Idf_Colaborador === idf_colaborador_destino);

      if (!solicitante || !destino) {
        res.status(404).json({ error: 'Colaborador de destino não encontrado.' });
        return;
      }

      if (solicitante.Idf_Empresa && destino.Idf_Empresa !== solicitante.Idf_Empresa) {
        res.status(403).json({ error: 'Não é permitido direcionar solicitação para membro de outra empresa.' });
        return;
      }

      if (isSwap) {
        const deptSolicitante = (solicitante.Des_Departamento || '').trim().toLowerCase();
        const deptDestino = (destino.Des_Departamento || '').trim().toLowerCase();

        if (!deptSolicitante || !deptDestino || deptSolicitante !== deptDestino) {
          res.status(400).json({ error: 'Só é permitido solicitar troca de turno com alguém do mesmo setor.' });
          return;
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .insert({
        Idf_Colaborador_Solicitante: solicitanteId,
        Idf_Colaborador_Destino: idf_colaborador_destino || null,
        Idf_Turno: idf_turno || null,
        Tpo_Solicitacao: String(tpo_solicitacao).trim().slice(0, 40),
        Dta_Solicitada: dta_solicitada,
        Des_Motivo: String(des_motivo).trim().slice(0, 1000),
        Tpo_Status_Solicitacao: 'pending'
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao registrar solicitação.' });
      return;
    }

    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Erro interno ao criar solicitação.' });
  }
});

// Aprovar ou recusar solicitação pelo gestor da mesma empresa
requestRoutes.patch('/:id/status', requireManagerOrRhAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida.' });
      return;
    }

    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(400).json({ error: 'Identificador de solicitação inválido.' });
      return;
    }

    const { status, parecer_gestor } = req.body || {};

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Status deve ser "approved" ou "rejected".' });
      return;
    }

    // Confirma que a solicitação pertence a um colaborador da mesma empresa do gestor
    const { data: existingReq } = await supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .select('Idf_Solicitacao, Idf_Colaborador_Solicitante')
      .eq('Idf_Solicitacao', id)
      .maybeSingle();

    if (!existingReq) {
      res.status(404).json({ error: 'Solicitação não encontrada.' });
      return;
    }

    if (authUser.companyId) {
      const { data: owner } = await supabaseAdmin
        .from('TAB_Colaborador')
        .select('Idf_Empresa')
        .eq('Idf_Colaborador', existingReq.Idf_Colaborador_Solicitante)
        .maybeSingle();

      if (!owner || owner.Idf_Empresa !== authUser.companyId) {
        res.status(403).json({ error: 'Não é permitido alterar solicitações de outra organização.' });
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('TAB_Solicitacao_Colaborador')
      .update({
        Tpo_Status_Solicitacao: status,
        Des_Parecer_Gestor: parecer_gestor ? String(parecer_gestor).trim().slice(0, 500) : null,
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Solicitacao', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao atualizar status da solicitação.' });
      return;
    }

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar solicitação.' });
  }
});
