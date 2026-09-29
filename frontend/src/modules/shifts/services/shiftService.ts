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

export async function getShiftsSupabase(): Promise<Shift[]> {
  try {
    const { data, error } = await supabase
      .from('TAB_Escala_Turno')
      .select('*')
      .eq('Flg_Ativo', true)
      .order('Dta_Turno', { ascending: true });

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

export async function createShiftSupabase(shift: Partial<Shift>): Promise<Shift | null> {
  try {
    const payload = {
      Idf_Colaborador: shift.employeeId,
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
    // 1. Salva na TAB_Registro_Ponto
    await supabase.from('TAB_Registro_Ponto').insert({
      Idf_Turno: shiftId.startsWith('shift-') ? null : shiftId,
      Idf_Colaborador: employeeId,
      Tpo_Registro: 'entrada',
      Num_Latitude: locationData.latitude || -23.5505,
      Num_Longitude: locationData.longitude || -46.6333,
      Des_Endereco: locationData.address,
      Flg_Gps_Validado: locationData.gpsValidated
    });

    // 2. Se o turno for um UUID válido no banco, atualiza presença
    if (!shiftId.startsWith('shift-')) {
      await supabase
        .from('TAB_Escala_Turno')
        .update({ Tpo_Status_Presenca: 'present' })
        .eq('Idf_Turno', shiftId);
    }
  } catch (err: any) {
    console.warn('Erro ao salvar registro de ponto no Supabase:', err.message);
  }
}
