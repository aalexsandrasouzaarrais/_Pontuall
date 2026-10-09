import { supabase } from '@/shared/services/supabase';
import { NotificationItem } from '@/types';

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function mapRowToNotification(row: any): NotificationItem {
  return {
    id: row.Idf_Notificacao,
    title: row.Titulo_Notificacao || 'Notificação',
    message: row.Des_Mensagem || '',
    type: (row.Tpo_Notificacao || 'system') as NotificationItem['type'],
    timestamp: row.Dta_Envio ? new Date(row.Dta_Envio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Agora',
    read: row.Flg_Lida ?? false,
    actionRequired: row.Flg_Acao_Requerida ?? false,
  };
}

/**
 * Executa o expurgo físico definitivo automático no banco de dados
 * apenas para notificações que foram apagadas pelo colaborador há mais de 60 dias.
 */
export async function purgeExpiredNotificationsSupabase(): Promise<number> {
  try {
    // Data de corte: exatamente 60 dias atrás
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
      .from('TAB_Notificacao')
      .delete({ count: 'exact' })
      .not('Dta_Exclusao', 'is', null)
      .lte('Dta_Exclusao', cutoff);

    if (error) {
      // Se a coluna Dta_Exclusao ainda não existir no banco, ignora silenciosamente
      return 0;
    }

    if (count && count > 0) {
      console.info(`[Pontual Purge] ${count} notificações com mais de 60 dias foram expurgadas definitivamente.`);
    }

    return count || 0;
  } catch (err: any) {
    console.warn('[Pontual Purge] Aviso ao executar expurgo de 60 dias:', err?.message);
    return 0;
  }
}

/**
 * Busca notificações ativas de um colaborador no Supabase (TAB_Notificacao).
 * Ignora notificações onde Dta_Exclusao IS NOT NULL (soft delete).
 */
export async function getNotificationsSupabase(employeeId?: string): Promise<NotificationItem[]> {
  try {
    // Dispara a rotina de limpeza de 60 dias em background de forma assíncrona
    purgeExpiredNotificationsSupabase().catch(() => {});

    let query = supabase.from('TAB_Notificacao').select('*');

    if (employeeId && isValidUuid(employeeId)) {
      query = query.eq('Idf_Colaborador_Destino', employeeId);
    }

    // Tenta primeiro filtrar apenas as que NÃO foram apagadas pelo colaborador
    const { data, error } = await query
      .is('Dta_Exclusao', null)
      .order('Dta_Envio', { ascending: false })
      .limit(50);

    if (!error && data) {
      return data.map(mapRowToNotification);
    }

    // Fallback: se a coluna Dta_Exclusao ainda não existir no banco, faz consulta padrão
    let fallbackQuery = supabase.from('TAB_Notificacao').select('*');
    if (employeeId && isValidUuid(employeeId)) {
      fallbackQuery = fallbackQuery.eq('Idf_Colaborador_Destino', employeeId);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
      .order('Dta_Envio', { ascending: false })
      .limit(50);

    if (fallbackError) {
      console.warn('Aviso ao consultar TAB_Notificacao no Supabase:', fallbackError.message);
      return [];
    }

    if (fallbackData && fallbackData.length > 0) {
      return fallbackData
        .filter((row: any) => !row.Dta_Exclusao)
        .map(mapRowToNotification);
    }
    return [];
  } catch (err: any) {
    console.error('Erro ao buscar notificações no Supabase:', err.message);
    return [];
  }
}

/**
 * Cria uma nova notificação no Supabase para um colaborador de destino.
 */
export async function createNotificationSupabase(params: {
  targetEmployeeId: string;
  title: string;
  message: string;
  type?: NotificationItem['type'];
  actionRequired?: boolean;
}): Promise<NotificationItem | null> {
  try {
    if (!isValidUuid(params.targetEmployeeId)) {
      console.warn('UUID do destinatário inválido ao criar notificação:', params.targetEmployeeId);
      return null;
    }

    const payload = {
      Idf_Colaborador_Destino: params.targetEmployeeId,
      Titulo_Notificacao: params.title.slice(0, 150),
      Des_Mensagem: params.message,
      Tpo_Notificacao: params.type || 'system',
      Flg_Lida: false,
      Flg_Acao_Requerida: params.actionRequired ?? false,
      Dta_Envio: new Date().toISOString(),
      Dta_Exclusao: null,
    };

    const { data, error } = await supabase
      .from('TAB_Notificacao')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Erro ao inserir em TAB_Notificacao:', error.message);
      return null;
    }

    return mapRowToNotification(data);
  } catch (err: any) {
    console.error('Erro na criação de notificação:', err.message);
    return null;
  }
}

/**
 * Marca uma notificação como lida no Supabase.
 */
export async function markNotificationAsReadSupabase(id: string): Promise<boolean> {
  try {
    if (!isValidUuid(id)) return false;

    const { error } = await supabase
      .from('TAB_Notificacao')
      .update({ Flg_Lida: true })
      .eq('Idf_Notificacao', id);

    if (error) {
      console.warn('Erro ao marcar notificação como lida:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar status de leitura da notificação:', err.message);
    return false;
  }
}

/**
 * Marca todas as notificações de um colaborador como lidas.
 */
export async function markAllNotificationsAsReadSupabase(employeeId: string): Promise<boolean> {
  try {
    if (!isValidUuid(employeeId)) return false;

    const { error } = await supabase
      .from('TAB_Notificacao')
      .update({ Flg_Lida: true })
      .eq('Idf_Colaborador_Destino', employeeId)
      .eq('Flg_Lida', false);

    if (error) {
      console.warn('Erro ao marcar todas notificações como lidas:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao atualizar todas as notificações:', err.message);
    return false;
  }
}

/**
 * Subscreve a eventos em tempo real (WebSocket Realtime) de novas notificações para o colaborador.
 * Retorna uma função de unsubscribe para limpeza no useEffect.
 */
export function subscribeNotificationsRealtime(
  employeeId: string,
  onNewNotification: (notification: NotificationItem) => void
): () => void {
  if (!isValidUuid(employeeId)) {
    return () => {};
  }

  const channel = supabase
    .channel(`notificacoes_realtime_${employeeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'TAB_Notificacao',
        filter: `Idf_Colaborador_Destino=eq.${employeeId}`,
      },
      (payload) => {
        if (payload.new && !payload.new.Dta_Exclusao) {
          const item = mapRowToNotification(payload.new);
          onNewNotification(item);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Apaga uma notificação específica com Soft Delete (marca Dta_Exclusao com a data atual).
 * Não apaga fisicamente do banco imediatamente; o expurgo definitivo ocorre após 60 dias.
 */
export async function deleteNotificationSupabase(id: string): Promise<boolean> {
  try {
    if (!isValidUuid(id)) return true;

    const nowIso = new Date().toISOString();

    // 1. Tenta atualizar Dta_Exclusao (Soft Delete)
    const { error } = await supabase
      .from('TAB_Notificacao')
      .update({ Dta_Exclusao: nowIso })
      .eq('Idf_Notificacao', id);

    if (error) {
      console.warn('Aviso ao aplicar soft delete na notificação:', error.message);
      // Se a coluna Dta_Exclusao ainda não existir no banco, não quebra
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao aplicar soft delete na notificação:', err.message);
    return false;
  }
}

/**
 * Apaga todas as notificações ativas de um colaborador com Soft Delete.
 * O expurgo físico definitivo do banco de dados ocorrerá após 60 dias.
 */
export async function clearAllNotificationsSupabase(employeeId: string): Promise<boolean> {
  try {
    if (!isValidUuid(employeeId)) return true;

    const nowIso = new Date().toISOString();

    // 1. Tenta atualizar Dta_Exclusao para todas as ativas do colaborador
    const { error } = await supabase
      .from('TAB_Notificacao')
      .update({ Dta_Exclusao: nowIso })
      .eq('Idf_Colaborador_Destino', employeeId)
      .is('Dta_Exclusao', null);

    if (error) {
      console.warn('Aviso ao limpar notificações com soft delete:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('Erro ao limpar todas as notificações no Supabase:', err.message);
    return false;
  }
}
