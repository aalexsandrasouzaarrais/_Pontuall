import { supabase } from '@/shared/services/supabase';
import { safeStorage } from '@/shared/utils/safeStorage';
import { isUuid } from '@/modules/auth/services/colaboradorService';

export interface PjNoteItem {
  id: string;
  titulo: string;
  texto: string;
  atualizadoEm: string;
}

export interface PjPrivateScheduleBlock {
  id: string;
  employeeId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  title: string;
  notes?: string;
  createdAt: string;
}

const NOTES_STORAGE_PREFIX = 'bloco-notas-colorido-v1_';
const SCHEDULE_STORAGE_PREFIX = 'pontual_pj_private_schedule_';

function createInitialNotes(): PjNoteItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: `nota-1-${Date.now()}`,
      titulo: 'Minhas ideias',
      texto: 'Anote aqui aquela ideia que você não quer esquecer.',
      atualizadoEm: now,
    },
    {
      id: `nota-2-${Date.now() + 1}`,
      titulo: 'Lista de tarefas',
      texto: 'Organize suas tarefas usando o botão Lista.',
      atualizadoEm: now,
    },
    {
      id: `nota-3-${Date.now() + 2}`,
      titulo: 'Lembretes',
      texto: 'Pequenos passos também levam a grandes conquistas ✨',
      atualizadoEm: now,
    },
  ];
}

export function getPjNotesLocal(employeeId: string): PjNoteItem[] {
  const key = `${NOTES_STORAGE_PREFIX}${employeeId || 'default'}`;
  try {
    const raw = safeStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Erro ao ler notas PJ locais:', err);
  }
  const initial = createInitialNotes();
  savePjNotesLocal(employeeId, initial);
  return initial;
}

export function savePjNotesLocal(employeeId: string, notes: PjNoteItem[]): void {
  const key = `${NOTES_STORAGE_PREFIX}${employeeId || 'default'}`;
  try {
    safeStorage.setItem(key, JSON.stringify(notes));
  } catch (err) {
    console.warn('Erro ao salvar notas PJ locais:', err);
  }
}

export async function syncPjNotesFromSupabase(employeeId: string): Promise<PjNoteItem[]> {
  const localNotes = getPjNotesLocal(employeeId);
  if (!isUuid(employeeId)) return localNotes;

  try {
    const { data, error } = await supabase
      .from('TAB_Nota_Pessoal_Pj')
      .select('*')
      .eq('Idf_Colaborador', employeeId)
      .order('Num_Ordem', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped: PjNoteItem[] = data.map((row: any) => ({
        id: row.Idf_Nota,
        titulo: row.Titulo_Nota || '',
        texto: row.Des_Conteudo_Html || '',
        atualizadoEm: row.Dta_Atualizacao || new Date().toISOString(),
      }));
      savePjNotesLocal(employeeId, mapped);
      return mapped;
    }
  } catch {
    // Fallback silencioso para notas locais caso a tabela ainda não exista no banco
  }
  return localNotes;
}

export async function savePjNotesToSupabase(employeeId: string, notes: PjNoteItem[]): Promise<void> {
  savePjNotesLocal(employeeId, notes);
  if (!isUuid(employeeId)) return;

  try {
    await supabase
      .from('TAB_Nota_Pessoal_Pj')
      .delete()
      .eq('Idf_Colaborador', employeeId);

    if (notes.length > 0) {
      const payload = notes.map((n, idx) => ({
        ...(isUuid(n.id) ? { Idf_Nota: n.id } : {}),
        Idf_Colaborador: employeeId,
        Titulo_Nota: (n.titulo || '').slice(0, 120),
        Des_Conteudo_Html: n.texto || '',
        Num_Ordem: idx,
        Dta_Atualizacao: n.atualizadoEm || new Date().toISOString(),
      }));
      await supabase.from('TAB_Nota_Pessoal_Pj').insert(payload);
    }
  } catch {
    // Mantém salvo no safeStorage mesmo offline ou sem tabela migrada
  }
}

// ============================================================================
// ESCALA / AGENDA PESSOAL PRIVADA DO COLABORADOR PJ (INVISÍVEL PARA O GESTOR)
// ============================================================================

export function getPjPrivateScheduleLocal(employeeId: string): PjPrivateScheduleBlock[] {
  const key = `${SCHEDULE_STORAGE_PREFIX}${employeeId || 'default'}`;
  try {
    const raw = safeStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Erro ao ler escala pessoal PJ:', err);
  }
  return [];
}

export function savePjPrivateScheduleLocal(employeeId: string, blocks: PjPrivateScheduleBlock[]): void {
  const key = `${SCHEDULE_STORAGE_PREFIX}${employeeId || 'default'}`;
  try {
    safeStorage.setItem(key, JSON.stringify(blocks));
  } catch (err) {
    console.warn('Erro ao salvar escala pessoal PJ:', err);
  }
}

export async function syncPjPrivateScheduleFromSupabase(employeeId: string): Promise<PjPrivateScheduleBlock[]> {
  const localBlocks = getPjPrivateScheduleLocal(employeeId);
  if (!isUuid(employeeId)) return localBlocks;

  try {
    const { data, error } = await supabase
      .from('TAB_Escala_Pessoal_Pj')
      .select('*')
      .eq('Idf_Colaborador', employeeId)
      .order('Dta_Bloco', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped: PjPrivateScheduleBlock[] = data.map((row: any) => ({
        id: row.Idf_Escala_Pj,
        employeeId: row.Idf_Colaborador,
        date: row.Dta_Bloco,
        startTime: row.Dta_Hora_Inicio,
        endTime: row.Dta_Hora_Fim,
        title: row.Titulo_Bloco || 'Minha Escala PJ',
        notes: row.Des_Observacao || undefined,
        createdAt: row.Dta_Cadastro || new Date().toISOString(),
      }));
      savePjPrivateScheduleLocal(employeeId, mapped);
      return mapped;
    }
  } catch {
    // Fallback silencioso
  }
  return localBlocks;
}

export async function addPjPrivateScheduleBlock(
  employeeId: string,
  block: Omit<PjPrivateScheduleBlock, 'id' | 'employeeId' | 'createdAt'>
): Promise<PjPrivateScheduleBlock[]> {
  const current = getPjPrivateScheduleLocal(employeeId);
  const newBlock: PjPrivateScheduleBlock = {
    id: `pj-sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId,
    date: block.date,
    startTime: block.startTime,
    endTime: block.endTime,
    title: block.title.trim() || 'Minha Escala Pessoal',
    notes: block.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const updated = [...current, newBlock];
  savePjPrivateScheduleLocal(employeeId, updated);

  if (isUuid(employeeId)) {
    try {
      const { data } = await supabase
        .from('TAB_Escala_Pessoal_Pj')
        .insert({
          Idf_Colaborador: employeeId,
          Dta_Bloco: newBlock.date,
          Dta_Hora_Inicio: newBlock.startTime,
          Dta_Hora_Fim: newBlock.endTime,
          Titulo_Bloco: newBlock.title,
          Des_Observacao: newBlock.notes || null,
        })
        .select()
        .single();

      if (data?.Idf_Escala_Pj) {
        const synced = updated.map(item =>
          item.id === newBlock.id ? { ...item, id: data.Idf_Escala_Pj } : item
        );
        savePjPrivateScheduleLocal(employeeId, synced);
        return synced;
      }
    } catch {}
  }

  return updated;
}

export async function deletePjPrivateScheduleBlock(
  employeeId: string,
  blockId: string
): Promise<PjPrivateScheduleBlock[]> {
  const current = getPjPrivateScheduleLocal(employeeId);
  const updated = current.filter(b => b.id !== blockId);
  savePjPrivateScheduleLocal(employeeId, updated);

  if (isUuid(employeeId) && isUuid(blockId)) {
    try {
      await supabase
        .from('TAB_Escala_Pessoal_Pj')
        .delete()
        .eq('Idf_Escala_Pj', blockId)
        .eq('Idf_Colaborador', employeeId);
    } catch {}
  }

  return updated;
}
