import { supabase } from '@/shared/services/supabase';

export interface ReminderItem {
  id: string;
  type: 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
  tag: string;
  title: string;
  description: string;
  date: string;
  time: string;
  link?: string;
  assigneeName?: string;
  assignedEmployeeIds?: string[];
  completed: boolean;
}

export function mapBneToReminder(row: any): ReminderItem {
  let assignedIds: string[] = [];
  if (Array.isArray(row.Arr_Idf_Colaboradores)) {
    assignedIds = row.Arr_Idf_Colaboradores;
  } else if (typeof row.Arr_Idf_Colaboradores === 'string') {
    try {
      assignedIds = JSON.parse(row.Arr_Idf_Colaboradores);
    } catch {
      assignedIds = [];
    }
  } else if (Array.isArray(row.assignedEmployeeIds)) {
    assignedIds = row.assignedEmployeeIds;
  }

  return {
    id: row.Idf_Lembrete || row.id,
    type: row.Tpo_Lembrete || row.type || 'atividade',
    tag: row.Tag_Lembrete || row.tag || 'Geral',
    title: row.Titulo_Lembrete || row.title || '',
    description: row.Des_Lembrete || row.description || '',
    date: row.Dta_Lembrete || row.date || '',
    time: row.Dta_Hora || row.time || '',
    link: row.Des_Link || row.link || undefined,
    assigneeName: row.Des_Nome_Alocados || row.assigneeName || undefined,
    assignedEmployeeIds: assignedIds,
    completed: row.Flg_Concluido ?? row.completed ?? false,
  };
}

export async function getRemindersSupabase(): Promise<ReminderItem[]> {
  try {
    const { data, error } = await supabase
      .from('TAB_Lembrete')
      .select('*')
      .eq('Flg_Ativo', true)
      .order('Dta_Lembrete', { ascending: true });

    if (error) {
      console.warn('Aviso ao buscar lembretes do Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map(mapBneToReminder);
    }
    return [];
  } catch (err: any) {
    console.error('Erro na chamada de busca de lembretes:', err.message);
    return [];
  }
}

export async function createReminderSupabase(reminder: Partial<ReminderItem>): Promise<ReminderItem | null> {
  try {
    const payload = {
      Tpo_Lembrete: reminder.type || 'atividade',
      Tag_Lembrete: reminder.tag || 'Geral',
      Titulo_Lembrete: reminder.title || '',
      Des_Lembrete: reminder.description || '',
      Dta_Lembrete: reminder.date || new Date().toISOString().split('T')[0],
      Dta_Hora: reminder.time || '08:00',
      Des_Link: reminder.link || null,
      Des_Nome_Alocados: reminder.assigneeName || null,
      Arr_Idf_Colaboradores: reminder.assignedEmployeeIds || [],
      Flg_Concluido: reminder.completed ?? false,
      Flg_Ativo: true,
    };

    const { data, error } = await supabase
      .from('TAB_Lembrete')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar lembrete no Supabase:', error.message);
      return null;
    }

    return mapBneToReminder(data);
  } catch (err: any) {
    console.error('Erro ao criar lembrete no Supabase:', err.message);
    return null;
  }
}

export async function updateReminderSupabase(
  id: string,
  reminder: Partial<ReminderItem>
): Promise<ReminderItem | null> {
  try {
    const payload: any = {};
    if (reminder.type !== undefined) payload.Tpo_Lembrete = reminder.type;
    if (reminder.tag !== undefined) payload.Tag_Lembrete = reminder.tag;
    if (reminder.title !== undefined) payload.Titulo_Lembrete = reminder.title;
    if (reminder.description !== undefined) payload.Des_Lembrete = reminder.description;
    if (reminder.date !== undefined) payload.Dta_Lembrete = reminder.date;
    if (reminder.time !== undefined) payload.Dta_Hora = reminder.time;
    if (reminder.link !== undefined) payload.Des_Link = reminder.link;
    if (reminder.assigneeName !== undefined) payload.Des_Nome_Alocados = reminder.assigneeName;
    if (reminder.assignedEmployeeIds !== undefined) payload.Arr_Idf_Colaboradores = reminder.assignedEmployeeIds;
    if (reminder.completed !== undefined) payload.Flg_Concluido = reminder.completed;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      console.warn('ID local não persistido no Supabase, ignorando update no banco:', id);
      return null;
    }

    const { data, error } = await supabase
      .from('TAB_Lembrete')
      .update(payload)
      .eq('Idf_Lembrete', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar lembrete no Supabase:', error.message);
      return null;
    }

    return mapBneToReminder(data);
  } catch (err: any) {
    console.error('Erro ao atualizar lembrete no Supabase:', err.message);
    return null;
  }
}

export async function toggleCompletedSupabase(
  id: string,
  currentCompleted: boolean
): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return true;

    const { error } = await supabase
      .from('TAB_Lembrete')
      .update({ Flg_Concluido: !currentCompleted })
      .eq('Idf_Lembrete', id);

    if (error) {
      console.warn('Erro ao alternar status do lembrete no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao alternar status do lembrete:', err.message);
    return false;
  }
}

export async function deleteReminderSupabase(id: string): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return true;

    const { error } = await supabase
      .from('TAB_Lembrete')
      .delete()
      .eq('Idf_Lembrete', id);

    if (error) {
      console.warn('Erro ao excluir lembrete no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao excluir lembrete:', err.message);
    return false;
  }
}
