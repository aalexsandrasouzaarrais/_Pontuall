import { supabase } from '@/shared/services/supabase';
import { Shift, WorkplaceLocation } from '@/types';
import { findWorkplaceByName, registerWorkplaceIfNew } from '@/shared/services/workplaceService';
import { calculateHaversineDistance } from '@/shared/utils/geolocation';

function encodeShiftNotesWithWorkplace(notes?: string, workplace?: string, workplaceLocation?: WorkplaceLocation): string {
  const wpObj = workplaceLocation || (workplace ? findWorkplaceByName(workplace) : undefined) || (workplace ? { name: workplace } : undefined);
  if (!wpObj) return notes || '';
  const wpTag = `[WP:${JSON.stringify(wpObj)}]`;
  const cleanNotes = (notes || '').replace(/^\[WP:.*?\]\s*/, '').trim();
  return cleanNotes ? `${wpTag} ${cleanNotes}` : wpTag;
}

export function mapBneToShift(row: any): Shift {
  let notes = row.Des_Observacao || '';
  let workplace: string | undefined = undefined;
  let workplaceLocation: WorkplaceLocation | undefined = undefined;

  // Extrai metadata de local de trabalho codificada em [WP:{...}] se existir
  if (notes.startsWith('[WP:')) {
    const endIdx = notes.indexOf(']');
    if (endIdx > 4) {
      try {
        const jsonStr = notes.substring(4, endIdx);
        const parsed = JSON.parse(jsonStr);
        workplace = parsed.name;
        workplaceLocation = parsed;
        notes = notes.substring(endIdx + 1).trim();

        // Registra o posto automaticamente no cache local para ficar disponível em dropdowns e mapas
        if (workplaceLocation) {
          registerWorkplaceIfNew(workplaceLocation as any);
        }
      } catch {}
    }
  }

  // Fallback se houver coluna direta ou pelo título/observação
  if (!workplace && row.Des_Local_Trabalho) {
    workplace = row.Des_Local_Trabalho;
    workplaceLocation = findWorkplaceByName(workplace);
  }

  return {
    id: row.Idf_Turno,
    employeeId: row.Idf_Colaborador,
    date: row.Dta_Turno,
    startTime: row.Dta_Hora_Inicio,
    endTime: row.Dta_Hora_Fim,
    breakMinutes: row.Num_Minutos_Intervalo || 60,
    status: row.Tpo_Status_Escala || 'published',
    attendanceStatus: row.Tpo_Status_Presenca || 'pending',
    type: row.Tpo_Turno || 'regular',
    title: row.Titulo_Turno || 'Turno Regular',
    notes,
    workplace,
    workplaceLocation,
    meetingLink: row.Des_Link_Reuniao || ''
  };
}

export async function getShiftsSupabase(employeeIds?: string[]): Promise<Shift[]> {
  try {
    if (employeeIds && employeeIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('TAB_Escala_Turno')
      .select('*')
      .eq('Flg_Ativo', true);

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('Idf_Colaborador', employeeIds);
    }

    const { data, error } = await query.order('Dta_Turno', { ascending: true });

    if (error) {
      console.warn('Aviso ao buscar escalas do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      const baseShifts = data.map(mapBneToShift);

      // Busca os registros de ponto para anexar check-in e geolocalização reais
      try {
        const { data: punches } = await supabase
          .from('TAB_Registro_Ponto')
          .select('*')
          .order('Dta_Hora_Registro', { ascending: false });

        if (punches && punches.length > 0) {
          return baseShifts.map(s => {
            const shiftPunches = punches.filter(p => 
              p.Idf_Turno === s.id || 
              (p.Idf_Colaborador === s.employeeId && p.Dta_Hora_Registro?.startsWith(s.date))
            ).sort((a, b) => new Date(a.Dta_Hora_Registro).getTime() - new Date(b.Dta_Hora_Registro).getTime());

            if (shiftPunches.length === 0) return s;

            const buildPunchInfo = (punch: any) => {
              const punchDate = new Date(punch.Dta_Hora_Registro);
              const hh = String(punchDate.getHours()).padStart(2, '0');
              const mm = String(punchDate.getMinutes()).padStart(2, '0');

              const pLat = Number(punch.Num_Latitude) || 0;
              const pLon = Number(punch.Num_Longitude) || 0;
              const wp = s.workplaceLocation;
              let distMeters = 0;
              let isValidGps = punch.Flg_Gps_Validado ?? true;

              if (wp && !wp.isRemote && wp.latitude && pLat && pLon) {
                distMeters = calculateHaversineDistance(pLat, pLon, wp.latitude, wp.longitude);
                isValidGps = distMeters <= (wp.radiusMeters || 200);
              }

              let cleanAddr = punch.Des_Endereco || 'Localização Registrada';
              cleanAddr = cleanAddr.replace(/^\[Aviso:\s*Fora do Raio.*?\]\s*/i, '');

              return {
                time: `${hh}:${mm}`,
                location: {
                  latitude: pLat || -23.5505,
                  longitude: pLon || -46.6333,
                  address: cleanAddr,
                  gpsValidated: isValidGps,
                  distanceMeters: distMeters,
                  timestamp: punch.Dta_Hora_Registro,
                }
              };
            };

            const inPunch = shiftPunches.find(p => p.Tpo_Registro?.toLowerCase() === 'entrada') || shiftPunches[0];
            const outPunch = shiftPunches.find(p => p.Tpo_Registro?.toLowerCase() === 'saida');

            const inData = inPunch ? buildPunchInfo(inPunch) : undefined;
            const outData = (outPunch && outPunch !== inPunch) ? buildPunchInfo(outPunch) : undefined;

            return {
              ...s,
              attendanceStatus: 'present',
              checkInTime: inData?.time,
              checkInLocation: inData?.location,
              checkOutTime: outData?.time,
              checkOutLocation: outData?.location,
            };
          });
        }
      } catch (punchErr) {
        console.warn('Aviso ao carregar batidas de ponto:', punchErr);
      }

      return baseShifts;
    }
    return [];
  } catch (err: any) {
    console.error('Erro na chamada de escalas:', err.message);
    return [];
  }
}

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

async function resolveValidEmployeeUuid(employeeId?: string): Promise<string | null> {
  if (isValidUuid(employeeId)) return employeeId!;
  try {
    const { data } = await supabase
      .from('TAB_Colaborador')
      .select('Idf_Colaborador')
      .eq('Flg_Ativo', true)
      .limit(1)
      .maybeSingle();

    if (data?.Idf_Colaborador && isValidUuid(data.Idf_Colaborador)) {
      return data.Idf_Colaborador;
    }
  } catch (err) {
    console.warn('Erro ao resolver UUID de colaborador no Supabase:', err);
  }
  return null;
}

export async function createShiftSupabase(shift: Partial<Shift>): Promise<Shift | null> {
  try {
    const colabUuid = await resolveValidEmployeeUuid(shift.employeeId);
    if (!colabUuid) {
      console.warn('Idf_Colaborador não possui um UUID válido no Supabase. Cancelando inserção remota.');
      return null;
    }

    const finalNotes = encodeShiftNotesWithWorkplace(shift.notes, shift.workplace, shift.workplaceLocation);

    const payload = {
      Idf_Colaborador: colabUuid,
      Dta_Turno: shift.date,
      Dta_Hora_Inicio: shift.startTime || '08:00',
      Dta_Hora_Fim: shift.endTime || '17:00',
      Num_Minutos_Intervalo: shift.breakMinutes || 60,
      Tpo_Status_Escala: shift.status || 'published',
      Tpo_Status_Presenca: shift.attendanceStatus || 'pending',
      Tpo_Turno: shift.type || 'regular',
      Titulo_Turno: shift.title || 'Turno de Trabalho',
      Des_Observacao: finalNotes,
      Des_Link_Reuniao: shift.meetingLink || '',
      Flg_Ativo: true
    };

    const { data, error } = await supabase
      .from('TAB_Escala_Turno')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar escala no Supabase:', error.message);
      return null;
    }

    const mapped = mapBneToShift(data);
    return {
      ...mapped,
      workplace: shift.workplace || mapped.workplace,
      workplaceLocation: shift.workplaceLocation || mapped.workplaceLocation,
    };
  } catch (err: any) {
    console.error('Erro ao criar escala no Supabase:', err.message);
    return null;
  }
}

export async function updateShiftSupabase(shift: Shift): Promise<boolean> {
  try {
    if (!isValidUuid(shift.id)) return true;

    const finalNotes = encodeShiftNotesWithWorkplace(shift.notes, shift.workplace, shift.workplaceLocation);

    const { error } = await supabase
      .from('TAB_Escala_Turno')
      .update({
        Dta_Turno: shift.date,
        Dta_Hora_Inicio: shift.startTime,
        Dta_Hora_Fim: shift.endTime,
        Num_Minutos_Intervalo: shift.breakMinutes,
        Tpo_Status_Escala: shift.status,
        Tpo_Status_Presenca: shift.attendanceStatus,
        Tpo_Turno: shift.type,
        Titulo_Turno: shift.title,
        Des_Observacao: finalNotes,
        Des_Link_Reuniao: shift.meetingLink || '',
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Turno', shift.id);

    if (error) {
      console.warn('Erro ao atualizar turno no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro na chamada de atualização de escala:', err.message);
    return false;
  }
}

export async function updateShiftAttendanceStatusSupabase(shiftId: string, status: string): Promise<boolean> {
  try {
    if (!isValidUuid(shiftId)) return false;
    const { error } = await supabase
      .from('TAB_Escala_Turno')
      .update({
        Tpo_Status_Presenca: status,
        Dta_Atualizacao: new Date().toISOString()
      })
      .eq('Idf_Turno', shiftId);

    if (error) {
      console.warn('Erro ao atualizar presença do turno no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar presença da escala:', err?.message);
    return false;
  }
}


export async function registerPunchSupabase(
  shiftId: string,
  employeeId: string,
  locationData: {
    address: string;
    gpsValidated: boolean;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    reportedWorkplace?: string;
  },
  punchType: 'entrada' | 'saida' = 'entrada'
) {
  try {
    const colabUuid = await resolveValidEmployeeUuid(employeeId);
    if (!colabUuid) {
      console.warn('Idf_Colaborador não é um UUID válido no Supabase. Não foi possível registrar o ponto.');
      return;
    }

    let fullAddressDesc = locationData.address;
    if (locationData.reportedWorkplace) {
      fullAddressDesc = `[Posto: ${locationData.reportedWorkplace}] ${locationData.address}`;
    } else if (!locationData.gpsValidated && locationData.distanceMeters) {
      fullAddressDesc = `[Aviso: Fora do Raio (${locationData.distanceMeters}m)] ${locationData.address}`;
    }

    // 1. Salva na TAB_Registro_Ponto com coordenadas reais e flag de validação
    await supabase.from('TAB_Registro_Ponto').insert({
      Idf_Turno: isValidUuid(shiftId) ? shiftId : null,
      Idf_Colaborador: colabUuid,
      Tpo_Registro: punchType,
      Num_Latitude: locationData.latitude ?? -23.5505,
      Num_Longitude: locationData.longitude ?? -46.6333,
      Des_Endereco: fullAddressDesc,
      Flg_Gps_Validado: locationData.gpsValidated
    });

    // 2. Se o turno for um UUID válido no banco, atualiza presença
    if (isValidUuid(shiftId)) {
      await supabase
        .from('TAB_Escala_Turno')
        .update({ Tpo_Status_Presenca: 'present' })
        .eq('Idf_Turno', shiftId);
    }
  } catch (err: any) {
    console.warn('Erro ao salvar registro de ponto no Supabase:', err.message);
  }
}

// Exclui um único turno no Supabase
export async function deleteShiftSupabase(shiftId: string): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shiftId);
    if (!isUuid) return true;

    const { error } = await supabase
      .from('TAB_Escala_Turno')
      .delete()
      .eq('Idf_Turno', shiftId);

    if (error) {
      console.warn('Erro ao excluir turno no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao excluir turno:', err.message);
    return false;
  }
}

// Exclui lote de turnos no Supabase por lista de IDs
export async function deleteBulkShiftsSupabase(shiftIds: string[]): Promise<boolean> {
  try {
    const validUuids = shiftIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (validUuids.length === 0) return true;

    const { error } = await supabase
      .from('TAB_Escala_Turno')
      .delete()
      .in('Idf_Turno', validUuids);

    if (error) {
      console.warn('Erro ao excluir lote de turnos no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao excluir lote de turnos:', err.message);
    return false;
  }
}

// Busca histórico completo de registros de ponto de um colaborador na TAB_Registro_Ponto
export async function getPunchesSupabase(employeeId: string): Promise<any[]> {
  try {
    const colabUuid = await resolveValidEmployeeUuid(employeeId);
    let query = supabase
      .from('TAB_Registro_Ponto')
      .select('*')
      .order('Dta_Hora_Registro', { ascending: false });

    if (colabUuid) {
      query = query.eq('Idf_Colaborador', colabUuid);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Aviso ao consultar TAB_Registro_Ponto:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Erro ao buscar histórico de batidas:', err);
    return [];
  }
}
