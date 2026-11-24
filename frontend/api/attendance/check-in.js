import {
  applyCorsHeaders,
  authenticateRequest,
  calculateHaversineDistance,
  evaluateServerEntryTolerance,
  getSaoPauloTimeHHMM,
  getSupabaseAdmin,
  isUuid,
} from '../auth/_security.js';

const ALLOWED_PUNCH_TYPES = new Set([
  'entrada',
  'saida',
  'intervalo_inicio',
  'intervalo_fim',
  'in',
  'out',
  'break_start',
  'break_end',
]);

function parseWorkplaceFromNotes(notes) {
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

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { idf_turno, tpo_registro, num_latitude, num_longitude, des_endereco } = body;

    const serverNow = new Date();
    const serverTimestampIso = serverNow.toISOString();
    const serverTimeHHMM = getSaoPauloTimeHHMM(serverNow);

    const cleanTipo = ALLOWED_PUNCH_TYPES.has(String(tpo_registro || '').trim())
      ? String(tpo_registro).trim()
      : 'entrada';

    if (idf_turno && !isUuid(idf_turno)) {
      return res.status(400).json({ error: 'Identificador de turno inválido.' });
    }

    const hasLat = num_latitude !== undefined && num_latitude !== null && num_latitude !== '';
    const hasLon = num_longitude !== undefined && num_longitude !== null && num_longitude !== '';
    let validLat = null;
    let validLon = null;

    if (hasLat || hasLon) {
      const latNum = Number(num_latitude);
      const lonNum = Number(num_longitude);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
        return res.status(400).json({ error: 'Coordenadas GPS inválidas.' });
      }
      validLat = latNum;
      validLon = lonNum;
    }

    let gpsValidadoNoServidor = validLat !== null && validLon !== null;
    let distanceMeters = undefined;
    let scheduledStart = null;

    if (idf_turno) {
      const { data: turno } = await supabaseAdmin
        .from('TAB_Escala_Turno')
        .select('Idf_Turno, Idf_Colaborador, Dta_Hora_Inicio, Des_Observacao')
        .eq('Idf_Turno', idf_turno)
        .eq('Flg_Ativo', true)
        .maybeSingle();

      if (!turno) {
        return res.status(404).json({ error: 'Turno não encontrado.' });
      }

      if (turno.Idf_Colaborador !== authUser.sub) {
        return res.status(403).json({ error: 'Não é permitido registrar ponto em turno de outro colaborador.' });
      }

      scheduledStart = turno.Dta_Hora_Inicio || null;
      const wp = parseWorkplaceFromNotes(turno.Des_Observacao);
      if (wp?.isRemote) {
        gpsValidadoNoServidor = true;
      } else if (wp && typeof wp.latitude === 'number' && typeof wp.longitude === 'number') {
        if (validLat === null || validLon === null) {
          gpsValidadoNoServidor = false;
        } else {
          const radius = Number(wp.radiusMeters) > 0 ? Number(wp.radiusMeters) : 200;
          distanceMeters = Math.round(calculateHaversineDistance(validLat, validLon, wp.latitude, wp.longitude));
          gpsValidadoNoServidor = distanceMeters <= radius;
        }
      }
    }

    const baseEndereco = des_endereco ? String(des_endereco).trim().slice(0, 200) : 'Localização capturada';
    const finalEndereco = !gpsValidadoNoServidor && distanceMeters !== undefined
      ? `[Fora do Raio: ${distanceMeters}m] ${baseEndereco}`.slice(0, 250)
      : baseEndereco;

    const { data: registro, error: erroPonto } = await supabaseAdmin
      .from('TAB_Registro_Ponto')
      .insert({
        Idf_Colaborador: authUser.sub,
        Idf_Turno: idf_turno || null,
        Dta_Hora_Registro: serverTimestampIso,
        Tpo_Registro: cleanTipo,
        Num_Latitude: validLat,
        Num_Longitude: validLon,
        Des_Endereco: finalEndereco,
        Flg_Gps_Validado: gpsValidadoNoServidor,
      })
      .select()
      .single();

    if (erroPonto) {
      return res.status(500).json({ error: 'Erro ao registrar ponto no banco de dados.' });
    }

    let attendanceStatus = undefined;
    if (idf_turno && (cleanTipo === 'entrada' || cleanTipo === 'in')) {
      attendanceStatus = evaluateServerEntryTolerance(scheduledStart, serverTimeHHMM, 10);
      await supabaseAdmin
        .from('TAB_Escala_Turno')
        .update({ Tpo_Status_Presenca: attendanceStatus })
        .eq('Idf_Turno', idf_turno)
        .eq('Idf_Colaborador', authUser.sub);
    }

    return res.status(201).json({
      success: true,
      message: 'Ponto registrado com sucesso!',
      serverTimestamp: serverTimestampIso,
      serverTimeHHMM,
      gpsValidated: gpsValidadoNoServidor,
      distanceMeters,
      attendanceStatus,
      registro,
    });
  } catch {
    return res.status(500).json({ error: 'Erro interno ao registrar ponto.' });
  }
}
