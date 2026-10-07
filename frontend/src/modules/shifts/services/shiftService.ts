import { supabase } from '@/shared/services/supabase';
import { Shift } from '@/types';

export function mapBneToShift(row: any): Shift {
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
    notes: row.Des_Observacao || '',
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
      return data.map(mapBneToShift);
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
      Des_Observacao: shift.notes || '',
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

    return mapBneToShift(data);
  } catch (err: any) {
    console.error('Erro ao criar escala no Supabase:', err.message);
    return null;
  }
}

export async function registerPunchSupabase(
  shiftId: string,
  employeeId: string,
  locationData: { address: string; gpsValidated: boolean; latitude?: number; longitude?: number }
) {
  try {
    const colabUuid = await resolveValidEmployeeUuid(employeeId);
    if (!colabUuid) {
      console.warn('Idf_Colaborador não é um UUID válido no Supabase. Não foi possível registrar o ponto.');
      return;
    }

    // 1. Salva na TAB_Registro_Ponto
    await supabase.from('TAB_Registro_Ponto').insert({
      Idf_Turno: isValidUuid(shiftId) ? shiftId : null,
      Idf_Colaborador: colabUuid,
      Tpo_Registro: 'entrada',
      Num_Latitude: locationData.latitude || -23.5505,
      Num_Longitude: locationData.longitude || -46.6333,
      Des_Endereco: locationData.address,
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
