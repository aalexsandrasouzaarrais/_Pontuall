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
 * Busca notificações de um colaborador no Supabase (TAB_Notificacao).
 */
export async function getNotificationsSupabase(employeeId?: string): Promise<NotificationItem[]> {
  try {
    let query = supabase.from('TAB_Notificacao').select('*');

    if (employeeId && isValidUuid(employeeId)) {
      query = query.eq('Idf_Colaborador_Destino', employeeId);
    }

    const { data, error } = await query
      .order('Dta_Envio', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Aviso ao consultar TAB_Notificacao no Supabase:', error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map(mapRowToNotification);
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
        if (payload.new) {
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
