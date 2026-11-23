import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../shared/supabase.js';
import {
  AuthenticatedRequest,
  requireAuth,
  isUuid,
  calculateHaversineDistance,
} from '../../shared/authSecurity.js';

export const attendanceRoutes = Router();

const ALLOWED_PUNCH_TYPES = new Set(['entrada', 'saida', 'intervalo_inicio', 'intervalo_fim', 'in', 'out', 'break_start', 'break_end']);

function parseWorkplaceFromNotes(notes?: string | null): {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  isRemote?: boolean;
} | null {
  if (typeof notes !== 'string' || !notes.includes('[WP:')) {
    return null;
  }
  const start = notes.indexOf('[WP:');
  const end = notes.indexOf(']', start);
  if (end <= start + 4) return null;
  try {
    const parsed = JSON.parse(notes.slice(start + 4, end));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// Registro de Ponto Digital autenticado com validação de GPS no servidor
attendanceRoutes.post('/check-in', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }

    const {
      idf_turno,
      tpo_registro,
      num_latitude,
      num_longitude,
      des_endereco
    } = req.body || {};

    const cleanTipo = ALLOWED_PUNCH_TYPES.has(String(tpo_registro || '').trim())
      ? String(tpo_registro).trim()
      : 'entrada';

    if (idf_turno && !isUuid(idf_turno)) {
      res.status(400).json({ error: 'Identificador de turno inválido.' });
      return;
    }

    const hasLat = num_latitude !== undefined && num_latitude !== null && num_latitude !== '';
    const hasLon = num_longitude !== undefined && num_longitude !== null && num_longitude !== '';
    let validLat: number | null = null;
    let validLon: number | null = null;

    if (hasLat || hasLon) {
      const latNum = Number(num_latitude);
      const lonNum = Number(num_longitude);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        res.status(400).json({ error: 'Coordenadas GPS inválidas.' });
        return;
      }
      validLat = latNum;
      validLon = lonNum;
    }

    // Validação do turno pertencente ao usuário e cálculo da cerca geográfica no servidor
    let gpsValidadoNoServidor = validLat !== null && validLon !== null;
    if (idf_turno) {
      const { data: turno } = await supabaseAdmin
        .from('TAB_Escala_Turno')
        .select('Idf_Turno, Idf_Colaborador, Des_Observacao')
        .eq('Idf_Turno', idf_turno)
        .eq('Flg_Ativo', true)
        .maybeSingle();

      if (!turno) {
        res.status(404).json({ error: 'Turno não encontrado.' });
        return;
      }

      if (turno.Idf_Colaborador !== authUser.sub) {
        res.status(403).json({ error: 'Não é permitido registrar ponto em turno de outro colaborador.' });
        return;
      }

      const wp = parseWorkplaceFromNotes(turno.Des_Observacao);
      if (wp?.isRemote) {
        gpsValidadoNoServidor = true;
      } else if (wp && typeof wp.latitude === 'number' && typeof wp.longitude === 'number') {
        if (validLat === null || validLon === null) {
          res.status(400).json({ error: 'Geolocalização obrigatória para registro de ponto presencial.' });
          return;
        }
        const radius = Number(wp.radiusMeters) > 0 ? Number(wp.radiusMeters) : 200;
        const distance = calculateHaversineDistance(validLat, validLon, wp.latitude, wp.longitude);
        gpsValidadoNoServidor = distance <= radius;
        if (!gpsValidadoNoServidor) {
          res.status(403).json({ error: 'Localização fora do raio permitido pelo posto de trabalho.' });
          return;
        }
      }
    }

    // Salva o registro na TAB_Registro_Ponto vinculando exclusivamente authUser.sub
    const { data: registro, error: erroPonto } = await supabaseAdmin
      .from('TAB_Registro_Ponto')
      .insert({
        Idf_Colaborador: authUser.sub,
        Idf_Turno: idf_turno || null,
        Tpo_Registro: cleanTipo,
        Num_Latitude: validLat,
        Num_Longitude: validLon,
        Des_Endereco: des_endereco ? String(des_endereco).trim().slice(0, 250) : 'Localização capturada',
        Flg_Gps_Validado: gpsValidadoNoServidor
      })
      .select()
      .single();

    if (erroPonto) {
      res.status(500).json({ error: 'Erro ao registrar ponto no banco de dados.' });
      return;
    }

    // Se houver turno associado válido, atualiza o status de presença para 'present'
    if (idf_turno) {
      await supabaseAdmin
        .from('TAB_Escala_Turno')
        .update({ Tpo_Status_Presenca: 'present' })
        .eq('Idf_Turno', idf_turno)
        .eq('Idf_Colaborador', authUser.sub);
    }

    res.status(201).json({
      success: true,
      message: 'Ponto registrado com sucesso!',
      registro
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao registrar ponto.' });
  }
});
