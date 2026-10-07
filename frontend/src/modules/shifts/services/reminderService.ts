import { supabase } from '@/shared/services/supabase';

// Estrutura no banco:
//   TAB_Lembrete               -> dados do lembrete (Des_Tag, Dta_Hora_Lembrete, Des_Link_Reuniao, Idf_Criador, Idf_Empresa...)
//   TAB_Lembrete_Colaborador   -> colaboradores alocados (M:N)

export interface ReminderItem {
  id: string;
  type: 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
  tag: string;
  title: string;
  description: string;
  date: string;
  time: string;
  link?: string;
  assigneeName?: string; // calculado na tela a partir dos alocados (não é coluna do banco)
  assignedEmployeeIds?: string[];
  completed: boolean;
  createdBy?: string;
  companyId?: string;
}

export interface ReminderContext {
  creatorId?: string;
  companyId?: string;
}

export interface ReminderFilter {
  companyId?: string;
  // Quando informado (gestor não-RH), mostra apenas lembretes criados por ele
  // ou alocados para alguém da equipe dele (visibleEmployeeIds).
  creatorId?: string;
  visibleEmployeeIds?: string[];
}

function isUuid(id?: string | null): boolean {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function mapBneToReminder(row: any, assignedIds: string[] = []): ReminderItem {
  return {
    id: row.Idf_Lembrete,
    type: row.Tpo_Lembrete || 'atividade',
    tag: row.Des_Tag || 'Geral',
    title: row.Titulo_Lembrete || '',
    description: row.Des_Lembrete || '',
    date: row.Dta_Lembrete || '',
    time: row.Dta_Hora_Lembrete || '',
    link: row.Des_Link_Reuniao || undefined,
    assignedEmployeeIds: assignedIds,
    completed: row.Flg_Concluido ?? false,
    createdBy: row.Idf_Criador || undefined,
    companyId: row.Idf_Empresa || undefined,
  };
}

// Busca os colaboradores alocados de vários lembretes de uma vez
async function getAssignmentsMap(reminderIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (reminderIds.length === 0) return map;

  const { data, error } = await supabase
    .from('TAB_Lembrete_Colaborador')
    .select('Idf_Lembrete, Idf_Colaborador')
    .in('Idf_Lembrete', reminderIds);

  if (error) {
    console.warn('Aviso ao buscar alocados em TAB_Lembrete_Colaborador:', error.message);
    return map;
  }

  (data || []).forEach((row: any) => {
    const list = map.get(row.Idf_Lembrete) || [];
    list.push(row.Idf_Colaborador);
    map.set(row.Idf_Lembrete, list);
  });
  return map;
}

// Substitui os alocados de um lembrete
async function saveAssignments(reminderId: string, employeeIds: string[], replaceExisting: boolean): Promise<string[]> {
  const validIds = Array.from(new Set(employeeIds.filter(isUuid)));

  if (replaceExisting) {
    const { error: delError } = await supabase
      .from('TAB_Lembrete_Colaborador')
      .delete()
      .eq('Idf_Lembrete', reminderId);
    if (delError) console.warn('Aviso ao limpar alocados do lembrete:', delError.message);
  }

  if (validIds.length === 0) return [];

  const { error } = await supabase
    .from('TAB_Lembrete_Colaborador')
    .upsert(
      validIds.map(id => ({ Idf_Lembrete: reminderId, Idf_Colaborador: id })),
      { onConflict: 'Idf_Lembrete,Idf_Colaborador' }
    );

  if (error) {
    console.error('Erro ao salvar colaboradores alocados no lembrete:', error.message);
    return [];
  }
  return validIds;
}

export async function getRemindersSupabase(filter: ReminderFilter = {}): Promise<ReminderItem[]> {
  try {
    let query = supabase
      .from('TAB_Lembrete')
      .select('*')
      .eq('Flg_Ativo', true);

    if (isUuid(filter.companyId)) {
      query = query.eq('Idf_Empresa', filter.companyId);
    } else if (isUuid(filter.creatorId)) {
      query = query.eq('Idf_Criador', filter.creatorId);
    } else {
      // Sem empresa e sem criador identificável: não expõe lembretes de outras empresas
      return [];
    }

    const { data, error } = await query
      .order('Dta_Lembrete', { ascending: true })
      .order('Dta_Hora_Lembrete', { ascending: true });

    if (error) {
      console.warn('Aviso ao buscar lembretes do Supabase:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    const assignments = await getAssignmentsMap(data.map((r: any) => r.Idf_Lembrete));
    let result = data.map((row: any) => mapBneToReminder(row, assignments.get(row.Idf_Lembrete) || []));

    if (filter.creatorId && filter.visibleEmployeeIds) {
      const visible = new Set(filter.visibleEmployeeIds);
      result = result.filter(r =>
        r.createdBy === filter.creatorId ||
        (r.assignedEmployeeIds || []).some(id => visible.has(id))
      );
    }

    return result;
  } catch (err: any) {
    console.error('Erro na chamada de busca de lembretes:', err.message);
    return [];
  }
}

export async function createReminderSupabase(
  reminder: Partial<ReminderItem>,
  context: ReminderContext = {}
): Promise<ReminderItem | null> {
  try {
    const payload = {
      Idf_Criador: isUuid(context.creatorId) ? context.creatorId : null,
      Idf_Empresa: isUuid(context.companyId) ? context.companyId : null,
      Titulo_Lembrete: (reminder.title || '').slice(0, 150),
      Des_Lembrete: reminder.description || null,
      Tpo_Lembrete: (reminder.type || 'atividade').slice(0, 30),
      Des_Tag: (reminder.tag || 'Geral').slice(0, 50),
      Dta_Lembrete: reminder.date || new Date().toISOString().split('T')[0],
      Dta_Hora_Lembrete: (reminder.time || '08:00').slice(0, 10),
      Des_Link_Reuniao: reminder.link || null,
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

    const assigned = await saveAssignments(data.Idf_Lembrete, reminder.assignedEmployeeIds || [], false);
    return { ...mapBneToReminder(data, assigned), assigneeName: reminder.assigneeName };
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
    if (!isUuid(id)) {
      console.warn('ID local não persistido no Supabase, ignorando update no banco:', id);
      return null;
    }

    const payload: any = { Dta_Atualizacao: new Date().toISOString() };
    if (reminder.type !== undefined) payload.Tpo_Lembrete = reminder.type.slice(0, 30);
    if (reminder.tag !== undefined) payload.Des_Tag = (reminder.tag || 'Geral').slice(0, 50);
    if (reminder.title !== undefined) payload.Titulo_Lembrete = reminder.title.slice(0, 150);
    if (reminder.description !== undefined) payload.Des_Lembrete = reminder.description;
    if (reminder.date !== undefined) payload.Dta_Lembrete = reminder.date;
    if (reminder.time !== undefined) payload.Dta_Hora_Lembrete = reminder.time.slice(0, 10);
    if (reminder.link !== undefined) payload.Des_Link_Reuniao = reminder.link || null;
    if (reminder.completed !== undefined) payload.Flg_Concluido = reminder.completed;

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

    let assigned: string[];
    if (reminder.assignedEmployeeIds !== undefined) {
      assigned = await saveAssignments(id, reminder.assignedEmployeeIds, true);
    } else {
      assigned = (await getAssignmentsMap([id])).get(id) || [];
    }

    return { ...mapBneToReminder(data, assigned), assigneeName: reminder.assigneeName };
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
    if (!isUuid(id)) return true;

    const { error } = await supabase
      .from('TAB_Lembrete')
      .update({ Flg_Concluido: !currentCompleted, Dta_Atualizacao: new Date().toISOString() })
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
    if (!isUuid(id)) return true;

    // ON DELETE CASCADE remove também as linhas de TAB_Lembrete_Colaborador
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
