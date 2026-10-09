import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/shared/services/supabase';
import { Employee } from '@/types';
import {
  getChatLastReadTimestamp,
  setChatLastReadTimestamp,
  isMessageRelevantForUser,
} from '@/shared/utils/chatUtils';

interface UseUnreadChatCountOptions {
  activeEmployee?: Employee | null;
  isChatOpen?: boolean;
}

export function useUnreadChatCount({ activeEmployee, isChatOpen = false }: UseUnreadChatCountOptions) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;

  const resetUnreadCount = useCallback(() => {
    if (!activeEmployee?.id) return;
    const now = new Date().toISOString();
    setChatLastReadTimestamp(activeEmployee.companyId, activeEmployee.id, now);
    setUnreadCount(0);
  }, [activeEmployee?.companyId, activeEmployee?.id]);

  // Se o chat foi aberto, zera imediatamente o contador
  useEffect(() => {
    if (isChatOpen) {
      resetUnreadCount();
    }
  }, [isChatOpen, resetUnreadCount]);

  // Busca e sincronização do contador de mensagens não lidas
  useEffect(() => {
    if (!activeEmployee?.id) {
      setUnreadCount(0);
      return;
    }

    const companyId = activeEmployee.companyId;
    const userId = activeEmployee.id;
    const cleanCompany = (companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = `cmp_${cleanCompany}__`;

    // Se ainda não abriu o chat nesta máquina, busca mensagens recentes das últimas 48h
    const currentLastRead = getChatLastReadTimestamp(companyId, userId) || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const fetchUnread = async () => {
      // Se o chat estiver com o foco ativo neste instante, mantém em 0
      if (isChatOpenRef.current) {
        setUnreadCount(0);
        return;
      }

      const lastReadTs = getChatLastReadTimestamp(companyId, userId) || currentLastRead;

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, channel, sender_id, recipient_id, created_at')
          .neq('sender_id', userId)
          .gt('created_at', lastReadTs)
          .or(`channel.like.${prefix}%,channel.like.%direct_%${userId}%,recipient_id.eq.${userId}`);

        if (!error && data) {
          const relevant = data.filter((msg) =>
            isMessageRelevantForUser(msg, userId, companyId)
          );
          setUnreadCount(relevant.length);
        }
      } catch (err) {
        console.error('Erro ao verificar mensagens não lidas:', err);
      }
    };

    fetchUnread();

    // Sincronização em tempo real via Supabase Realtime
    const channelName = `realtime_unread_${userId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as any;
          if (isMessageRelevantForUser(newMsg, userId, companyId)) {
            if (isChatOpenRef.current) {
              // Usuário já está com o chat aberto lendo
              resetUnreadCount();
            } else {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    // Polling de backup a cada 10s e ao focar a janela
    const interval = setInterval(fetchUnread, 10000);
    const handleFocus = () => fetchUnread();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [activeEmployee?.id, activeEmployee?.companyId, resetUnreadCount]);

  return {
    unreadCount,
    resetUnreadCount,
  };
}
