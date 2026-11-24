import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Image as ImageIcon,
  Reply,
  Edit2,
  Check,
  Eye,
  Download,
  Sparkles,
  X,
  Paperclip,
  Smile,
  Send,
  Hash,
} from 'lucide-react';
import { Employee } from '@/types';
import { supabase } from '@/shared/services/supabase';
import { sanitizeSafeUrl, quotePostgrestValue } from '@/shared/utils/security';
import { DEFAULT_TEAM_CHANNELS, ChatChannelItem, ChatMessage } from '@/modules/chat/components/ChatModal';
import {
  ChatAttachment,
  ChatReplyInfo,
  CHAT_COMMON_EMOJIS,
  compressImageFile,
  parseChatMessage,
  sendChatMessageToSupabase,
  updateChatMessageInSupabase,
  deleteChatMessageFromSupabase,
  saveChannelMetaToSupabase,
  extractGroupMetaFromMessage,
  isSystemControlMessage,
  getScopedChatChannel,
  getScopedDirectChannel,
  getDisplayChatChannel,
} from '@/shared/utils/chatUtils';

interface ManagerChatTabProps {
  employees: Employee[];
  activeEmployee?: Employee;
  isDark: boolean;
  isRh?: boolean;
}

const QUICK_SUGGESTIONS = [
  '📅 Alinhamento sobre a escala do fim de semana',
  '⚡ Aviso urgente de cobertura de plantão',
  '✅ Horários confirmados e ponto conferido',
  '❓ Solicitação de ajuste de turno',
];

/**
 * Aba de comunicação e canais corporativos em tempo real do gestor (contexto de chat).
 */
export const ManagerChatTab: React.FC<ManagerChatTabProps> = ({
  employees,
  activeEmployee,
  isDark,
  isRh = false,
}) => {
  const [activeChatMode, setActiveChatMode] = useState<'channel' | 'direct'>('channel');
  const [activeChatChannel, setActiveChatChannel] = useState<string>('');

  // Identifica a chave da empresa para isolamento multi-tenant
  const companyKey = useMemo(() => {
    return (activeEmployee?.companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [activeEmployee?.companyId]);

  // Contatos para conversa direta: exclui o próprio usuário logado
  const directEmployees = useMemo(() => {
    return employees.filter(e => e.id !== activeEmployee?.id);
  }, [employees, activeEmployee?.id]);

  const [selectedDirectEmployeeId, setSelectedDirectEmployeeId] = useState<string>('');

  useEffect(() => {
    if (directEmployees.length > 0 && (!selectedDirectEmployeeId || !directEmployees.some(e => e.id === selectedDirectEmployeeId))) {
      setSelectedDirectEmployeeId(directEmployees[0].id);
    }
  }, [directEmployees, selectedDirectEmployeeId]);

  const selectedDirectEmployee = useMemo(() => {
    return directEmployees.find(e => e.id === selectedDirectEmployeeId) || null;
  }, [directEmployees, selectedDirectEmployeeId]);

  const [newChatInput, setNewChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [teamChannels, setTeamChannels] = useState<ChatChannelItem[]>(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]'));
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        return parsed
          .filter(c => !deletedIds.has(c.id) && c.id !== 'geral' && c.id !== 'escalas' && c.id !== 'gestao')
          .map(c => ({
            ...c,
            badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge,
          }));
      }
      return DEFAULT_TEAM_CHANNELS.filter(c => !deletedIds.has(c.id));
    } catch {}
    return DEFAULT_TEAM_CHANNELS;
  });

  // Atualiza canais caso a empresa mude
  useEffect(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]'));
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        setTeamChannels(
          parsed
            .filter(c => !deletedIds.has(c.id) && c.id !== 'geral' && c.id !== 'escalas' && c.id !== 'gestao')
            .map(c => ({
              ...c,
              badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge,
            }))
        );
      } else {
        setTeamChannels(DEFAULT_TEAM_CHANNELS);
      }
    } catch {
      setTeamChannels(DEFAULT_TEAM_CHANNELS);
    }
  }, [companyKey]);

  // Novo Grupo Modal
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupBadge, setNewGroupBadge] = useState('Equipe');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const managerGroupAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const managerActiveGroupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [channelToEditAvatar, setChannelToEditAvatar] = useState<ChatChannelItem | null>(null);
  const [isManagerEmojiPickerOpen, setIsManagerEmojiPickerOpen] = useState(false);
  const [replyingToManagerMsg, setReplyingToManagerMsg] = useState<ChatReplyInfo | null>(null);
  const [editingManagerMsgId, setEditingManagerMsgId] = useState<string | null>(null);
  const [editingManagerMsgText, setEditingManagerMsgText] = useState<string>('');

  // Confirmação de Exclusão de Grupo
  const [groupToDelete, setGroupToDelete] = useState<ChatChannelItem | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Anexos de imagem no chat do gestor
  const [pendingManagerAttachment, setPendingManagerAttachment] = useState<ChatAttachment | null>(null);
  const [isAttachingManager, setIsAttachingManager] = useState(false);
  const [managerPreviewModalImage, setManagerPreviewModalImage] = useState<{ url: string; name: string } | null>(null);
  const managerFileInputRef = useRef<HTMLInputElement | null>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevChatChannelRef = useRef<string>('');
  const prevChatMsgCountRef = useRef<number>(0);

  // Filtra apenas os canais aos quais o usuário logado pertence (mesmo para RH ou outro Gestor, grupos privados só aparecem para os integrantes selecionados na criação)
  const visibleTeamChannels = useMemo(() => {
    return teamChannels.filter((c) => {
      if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return false;
      if (!c.members || c.members.length === 0) return true;
      return Boolean(activeEmployee?.id && c.members.includes(activeEmployee.id));
    });
  }, [teamChannels, activeEmployee?.id]);

  // Mantém o canal ativo sincronizado com os grupos visíveis
  useEffect(() => {
    if (visibleTeamChannels.length > 0 && !visibleTeamChannels.some(c => c.id === activeChatChannel)) {
      setActiveChatChannel(visibleTeamChannels[0].id);
    } else if (visibleTeamChannels.length === 0 && activeChatChannel !== '') {
      setActiveChatChannel('');
    }
  }, [visibleTeamChannels, activeChatChannel]);

  const activeChannelInfo = useMemo(() => {
    return visibleTeamChannels.find(c => c.id === activeChatChannel) || visibleTeamChannels[0] || null;
  }, [visibleTeamChannels, activeChatChannel]);

  // Canal ativo no banco (isolado por empresa e contato)
  const currentChatChannel = useMemo(() => {
    if (activeChatMode === 'direct') {
      if (!selectedDirectEmployee?.id) return `cmp_${companyKey}__direct_none`;
      return getScopedDirectChannel(activeEmployee?.companyId, activeEmployee?.id, selectedDirectEmployee.id);
    }
    if (!activeChannelInfo?.id) return `cmp_${companyKey}__group_none`;
    return getScopedChatChannel(activeEmployee?.companyId, activeChannelInfo.id);
  }, [activeChatMode, selectedDirectEmployee?.id, activeChannelInfo?.id, activeEmployee?.companyId, activeEmployee?.id, companyKey]);

  const handleSaveManagerEditMessage = async (msgId: string) => {
    const trimmed = editingManagerMsgText.trim();
    if (!trimmed) return;
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: trimmed } : m));
    setEditingManagerMsgId(null);
    setEditingManagerMsgText('');
    await updateChatMessageInSupabase(msgId, trimmed);
  };

  const handleDeleteManagerOwnMessage = async (msgId: string) => {
    setChatMessages(prev => prev.filter(m => m.id !== msgId));
    await deleteChatMessageFromSupabase(msgId);
  };

  const handleManagerGroupAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 260, 0.78);
      setNewGroupAvatar(compressed.url);
    } catch (err) {
      console.error('Erro ao processar imagem do grupo:', err);
    } finally {
      if (managerGroupAvatarInputRef.current) managerGroupAvatarInputRef.current.value = '';
    }
  };

  const handleUpdateExistingChannelAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetChan = channelToEditAvatar || activeChannelInfo;
    if (!file || !targetChan) return;
    try {
      const compressed = await compressImageFile(file, 260, 260, 0.78);
      const avatarUrl = compressed.url;
      const updatedChan: ChatChannelItem = { ...targetChan, avatar: avatarUrl };

      setTeamChannels(prev => {
        const next = prev.map(c => c.id === targetChan.id ? updatedChan : c);
        try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(next)); } catch {}
        return next;
      });

      await saveChannelMetaToSupabase({
        companyId: activeEmployee?.companyId,
        channel: updatedChan,
        sender: {
          id: activeEmployee?.id || 'gestor',
          name: activeEmployee?.name || 'Gestor',
          role: activeEmployee?.role || 'Gestor',
          avatar: activeEmployee?.avatar || '',
        },
        isNew: false,
      });
    } catch (err) {
      console.error('Erro ao atualizar imagem do canal:', err);
    } finally {
      setChannelToEditAvatar(null);
      if (managerActiveGroupAvatarInputRef.current) managerActiveGroupAvatarInputRef.current.value = '';
    }
  };

  const handleManagerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAttachingManager(true);
    try {
      const compressed = await compressImageFile(file);
      setPendingManagerAttachment(compressed);
    } catch (err) {
      console.error('Erro ao processar anexo:', err);
    } finally {
      setIsAttachingManager(false);
      if (managerFileInputRef.current) managerFileInputRef.current.value = '';
    }
  };

  // Carrega e sincroniza canais do Supabase (incluindo fotos de grupos e exclusões feitas por outros gestores/contas)
  useEffect(() => {
    const fetchChannels = async () => {
      const deletedIds = new Set<string>();
      const deletedNames = new Set<string>(['girllssss']);
      try {
        const savedDel = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
        if (savedDel) {
          JSON.parse(savedDel).forEach((id: string) => deletedIds.add(id));
        }
      } catch {}

      // 0. Busca avisos de exclusão de grupos no Supabase para sincronizar entre contas
      try {
        const { data: delMsgs } = await supabase
          .from('messages')
          .select('recipient_id, text')
          .or('recipient_id.like.group_deleted:%,text.like.🗑️ O grupo #%');

        if (delMsgs && delMsgs.length > 0) {
          delMsgs.forEach((m: any) => {
            if (m.recipient_id && m.recipient_id.startsWith('group_deleted:')) {
              const rawDelId = getDisplayChatChannel(m.recipient_id.replace('group_deleted:', ''));
              deletedIds.add(rawDelId);
            }
            if (m.text && m.text.includes('🗑️ O grupo #')) {
              const match = m.text.match(/#([^\s]+)\s+foi excluído/);
              if (match && match[1]) {
                deletedNames.add(match[1].trim().toLowerCase());
              }
            }
          });
          try {
            localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(Array.from(deletedIds)));
          } catch {}
        }
      } catch {}

      let dbChannelIds: Set<string> | null = null;
      const loadedFromDb = new Map<string, ChatChannelItem>();
      try {
        const { data, error } = await supabase.from('chat_channels').select('*');
        if (!error && data) {
          dbChannelIds = new Set(data.map((d: any) => getDisplayChatChannel(d.id)));
          data.forEach((d: any) => {
            const cleanId = getDisplayChatChannel(d.id);
            const cleanName = (d.name || '').trim().toLowerCase();
            if (cleanId === 'geral' || cleanId === 'escalas' || cleanId === 'gestao') return;
            if (deletedIds.has(d.id) || deletedIds.has(cleanId) || deletedNames.has(cleanName)) return;
            loadedFromDb.set(cleanId, {
              id: cleanId,
              name: d.name,
              desc: d.description || '',
              badge: d.badge || 'Equipe',
              unread: 0,
              members: d.members || undefined,
              avatar: d.avatar || undefined,
            });
          });
        }
      } catch {}

      // Descobre metadados e imagens de grupos gravados na tabela messages (group_meta_id: e group_meta:)
      const foundMetaMap = new Map<string, ChatChannelItem>();
      try {
        const groupPrefix = `cmp_${companyKey}__grupo_%`;
        const { data: groupMsgs } = await supabase
          .from('messages')
          .select('channel, recipient_id, attachment, text')
          .or(`channel.like.${quotePostgrestValue(groupPrefix)},recipient_id.like.group_meta%`)
          .order('created_at', { ascending: true });

        if (groupMsgs && groupMsgs.length > 0) {
          for (const msg of groupMsgs) {
            const extracted = extractGroupMetaFromMessage(msg);
            if (extracted && extracted.id) {
              const rawId = extracted.id;
              const cleanName = (extracted.name || rawId).trim().toLowerCase();
              if (deletedIds.has(rawId) || deletedNames.has(cleanName)) continue;
              const prevMeta = foundMetaMap.get(rawId);
              foundMetaMap.set(rawId, {
                id: rawId,
                name: extracted.name || prevMeta?.name || rawId.replace('grupo_', ''),
                desc: extracted.desc || prevMeta?.desc || 'Grupo de comunicação da equipe',
                badge: extracted.badge || prevMeta?.badge || 'Equipe',
                unread: 0,
                members: extracted.members || prevMeta?.members,
                avatar: extracted.avatar || prevMeta?.avatar,
              });
            }
          }
        }
      } catch {}

      setTeamChannels((prev) => {
        const map = new Map<string, ChatChannelItem>();
        DEFAULT_TEAM_CHANNELS.forEach(def => {
          const existing = prev.find(p => p.id === def.id);
          const meta = foundMetaMap.get(def.id) || loadedFromDb.get(def.id);
          map.set(def.id, {
            ...def,
            avatar: meta?.avatar || existing?.avatar,
          });
        });

        loadedFromDb.forEach((val, key) => {
          const meta = foundMetaMap.get(key);
          const existing = prev.find(p => p.id === key);
          map.set(key, {
            ...val,
            members: meta?.members || val.members || existing?.members,
            avatar: meta?.avatar || val.avatar || existing?.avatar,
          });
        });

        foundMetaMap.forEach((val, key) => {
          if (key === 'geral' || key === 'escalas' || key === 'gestao') return;
          if (dbChannelIds && !dbChannelIds.has(key)) return;
          const existing = map.get(key) || prev.find(p => p.id === key);
          map.set(key, {
            ...val,
            ...existing,
            name: val.name || existing?.name || key,
            desc: val.desc || existing?.desc || '',
            members: val.members || existing?.members,
            avatar: val.avatar || existing?.avatar,
          });
        });

        const merged = Array.from(map.values()).filter(
          c => !deletedIds.has(c.id) && !deletedNames.has((c.name || '').toLowerCase())
        );
        try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(merged)); } catch {}
        return merged;
      });
    };
    fetchChannels();
    const syncInterval = setInterval(fetchChannels, 5000);
    return () => clearInterval(syncInterval);
  }, [companyKey, activeEmployee?.companyId]);

  // Carrega mensagens e assina WebSocket em tempo real para o chat do gestor
  useEffect(() => {
    const fetchMessages = async () => {
      if (
        (activeChatMode === 'direct' && !selectedDirectEmployee?.id) ||
        (activeChatMode === 'channel' && !activeChannelInfo?.id)
      ) {
        setChatMessages([]);
        setChatLoading(false);
        return;
      }

      let query = supabase.from('messages').select('*');
      if (activeChatMode === 'direct' && activeEmployee?.id && selectedDirectEmployee?.id) {
        const pair = [activeEmployee.id, selectedDirectEmployee.id].sort().join('_');
        const qDirect = quotePostgrestValue(`direct_${pair}`);
        const qDirectLike = quotePostgrestValue(`%direct_${pair}`);
        const qSelf = quotePostgrestValue(activeEmployee.id);
        const qOther = quotePostgrestValue(selectedDirectEmployee.id);
        query = query.or(`channel.eq.${qDirect},channel.like.${qDirectLike},and(sender_id.eq.${qSelf},recipient_id.eq.${qOther}),and(sender_id.eq.${qOther},recipient_id.eq.${qSelf})`);
      } else {
        query = query.eq('channel', currentChatChannel);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (!error && data) {
        // Filtra mensagens técnicas de controle de grupo para não poluir nem disparar scroll
        const cleanData = (data as ChatMessage[]).filter((d) => !isSystemControlMessage(d));
        setChatMessages(prev => {
          const pendingTemp = prev.filter(
            p => p.id.startsWith('temp-') && !cleanData.some((d: any) => d.text === p.text && d.sender_id === p.sender_id)
          );
          const nextList = [...cleanData, ...pendingTemp];
          if (
            prev.length === nextList.length &&
            prev.every((item, idx) => item.id === nextList[idx]?.id && item.text === nextList[idx]?.text)
          ) {
            return prev;
          }
          return nextList;
        });
      }
      setChatLoading(false);
    };

    setChatLoading(true);
    setChatMessages([]);
    fetchMessages();

    const interval = setInterval(fetchMessages, 3000);

    const realtimeSubId = `mgrid_chat_rt_${activeEmployee?.id || 'mgr'}_${Date.now()}`;
    const realtimeChannel = supabase
      .channel(realtimeSubId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setChatMessages(prev => prev.filter(m => m.id !== oldId));
            }
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setChatMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, text: updatedMsg.text } : m));
            return;
          }

          const newMsg = payload.new as ChatMessage;

          // Se for aviso de exclusão de grupo em tempo real
          if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_deleted:')) {
            const deletedId = getDisplayChatChannel(newMsg.recipient_id.replace('group_deleted:', ''));
            setTeamChannels(prev => {
              const filtered = prev.filter(c => c.id !== deletedId);
              try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(filtered)); } catch {}
              return filtered;
            });
            try {
              const deletedList = JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]');
              if (!deletedList.includes(deletedId)) {
                deletedList.push(deletedId);
                localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(deletedList));
              }
            } catch {}
            return;
          }

          // Se for metadado de criação ou atualização de foto de grupo em tempo real
          const extractedMeta = extractGroupMetaFromMessage(newMsg);
          if (extractedMeta && extractedMeta.id) {
            const rawChannelId = extractedMeta.id;
            const members = extractedMeta.members;
            if (rawChannelId.startsWith('grupo_') && members && members.length > 0 && activeEmployee?.id && !members.includes(activeEmployee.id)) {
              return;
            }
            setTeamChannels(prev => {
              if (prev.some(p => p.id === rawChannelId)) {
                const updatedExisting = prev.map(p =>
                  p.id === rawChannelId
                    ? {
                        ...p,
                        name: extractedMeta.name || p.name,
                        desc: extractedMeta.desc || p.desc,
                        avatar: extractedMeta.avatar || p.avatar,
                        members: members || p.members,
                      }
                    : p
                );
                try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updatedExisting)); } catch {}
                return updatedExisting;
              }
              const updated = [
                ...prev,
                {
                  id: rawChannelId,
                  name: extractedMeta.name || rawChannelId.replace('grupo_', ''),
                  desc: extractedMeta.desc || 'Grupo criado pela gestão',
                  badge: extractedMeta.badge || 'Equipe',
                  members,
                  avatar: extractedMeta.avatar || undefined,
                  unread: 0,
                },
              ];
              try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}
              return updated;
            });
            return;
          }

          if (isSystemControlMessage(newMsg)) return;

          const directPair = (activeChatMode === 'direct' && selectedDirectEmployee?.id && activeEmployee?.id)
            ? [activeEmployee.id, selectedDirectEmployee.id].sort().join('_')
            : null;
          const isDirectMatch = Boolean(directPair && newMsg.channel && newMsg.channel.includes(`direct_${directPair}`));
          const isDirectRecipientMatch = Boolean(
            activeChatMode === 'direct' &&
            selectedDirectEmployee?.id &&
            activeEmployee?.id &&
            ((newMsg.sender_id === selectedDirectEmployee.id && newMsg.recipient_id === activeEmployee.id) ||
             (newMsg.sender_id === activeEmployee.id && newMsg.recipient_id === selectedDirectEmployee.id))
          );

          if (newMsg.channel === currentChatChannel || isDirectMatch || isDirectRecipientMatch) {
            setChatMessages(prev => {
              const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.text === newMsg.text && m.sender_id === newMsg.sender_id));
              if (filtered.some(m => m.id === newMsg.id)) return filtered;
              return [...filtered, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(realtimeChannel);
    };
  }, [currentChatChannel, activeChatMode, selectedDirectEmployee?.id, activeEmployee?.id, companyKey]);

  // Controle inteligente de rolagem na aba de Chat: rola apenas dentro do container do chat, nunca puxando a página inteira para baixo a cada 3s
  useEffect(() => {
    const container = chatMessagesContainerRef.current;
    const isChannelSwitch = prevChatChannelRef.current !== currentChatChannel;
    const isNewMessage = chatMessages.length > prevChatMsgCountRef.current;

    if (isChannelSwitch && chatMessages.length > 0) {
      prevChatChannelRef.current = currentChatChannel;
      prevChatMsgCountRef.current = chatMessages.length;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    if (isNewMessage) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      const isFromMe = Boolean(activeEmployee?.id && lastMsg?.sender_id === activeEmployee.id);
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 140
        : true;

      if (isFromMe || isNearBottom || prevChatMsgCountRef.current === 0) {
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }
    }

    prevChatMsgCountRef.current = chatMessages.length;
  }, [chatMessages, currentChatChannel, activeEmployee?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim() && !pendingManagerAttachment) return;

    const rawText = newChatInput.trim();
    const attachmentToSend = pendingManagerAttachment;
    const replyToSend = replyingToManagerMsg;

    setNewChatInput('');
    setPendingManagerAttachment(null);
    setReplyingToManagerMsg(null);
    setIsManagerEmojiPickerOpen(false);

    const recipientId = activeChatMode === 'direct' ? (selectedDirectEmployee?.id || null) : null;
    const senderId = activeEmployee?.id || 'gestor';
    const senderName = activeEmployee?.name || 'Gestor';
    const senderRole = activeEmployee?.role || (isRh ? 'Gestora Geral' : 'Gestor');
    const senderAvatar = activeEmployee?.avatar || '';

    const optimisticPayload =
      attachmentToSend || replyToSend
        ? JSON.stringify({
            ...(attachmentToSend ? attachmentToSend : {}),
            ...(replyToSend ? { replyTo: replyToSend } : {}),
          })
        : null;

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      sender_avatar: senderAvatar,
      text: rawText,
      attachment: optimisticPayload,
      created_at: new Date().toISOString(),
      channel: currentChatChannel,
      recipient_id: recipientId,
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      await sendChatMessageToSupabase({
        sender_id: senderId,
        sender_name: senderName,
        sender_role: senderRole,
        sender_avatar: senderAvatar,
        text: rawText,
        attachment: attachmentToSend,
        replyTo: replyToSend,
        channel: currentChatChannel,
        recipient_id: recipientId,
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem no gestor:', err);
    }
  };

  const handleCreateNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    const channelId = `grupo_${Date.now()}`;
    const baseMembers = selectedMemberIds.length > 0 ? selectedMemberIds : employees.map(e => e.id);
    const creatorId = activeEmployee?.id;
    const membersList = creatorId ? Array.from(new Set([...baseMembers, creatorId])) : baseMembers;
    const newChan: ChatChannelItem = {
      id: channelId,
      name: newGroupName.trim().toLowerCase().replace(/\s+/g, '-'),
      desc: newGroupDesc.trim() || 'Grupo criado pela gestão',
      badge: newGroupBadge.trim() || 'Equipe',
      unread: 0,
      members: membersList,
      avatar: newGroupAvatar || undefined,
    };

    const updated = [...teamChannels, newChan];
    setTeamChannels(updated);
    try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}

    await saveChannelMetaToSupabase({
      companyId: activeEmployee?.companyId,
      channel: newChan,
      sender: {
        id: activeEmployee?.id || 'gestor',
        name: activeEmployee?.name || 'Gestor',
        role: activeEmployee?.role || 'Gestor',
        avatar: activeEmployee?.avatar || '',
      },
      isNew: true,
    });

    setIsCreatingGroup(false);
    setIsNewGroupModalOpen(false);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupAvatar('');
    setSelectedMemberIds([]);
    setActiveChatMode('channel');
    setActiveChatChannel(newChan.id);
  };

  const handlePromptDeleteGroup = (chan: ChatChannelItem) => {
    setGroupToDelete(chan);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    const groupId = groupToDelete.id;
    const groupName = groupToDelete.name;
    const scopedGroupId = getScopedChatChannel(activeEmployee?.companyId, groupId);

    try {
      await supabase.from('messages').delete().or(`channel.eq.${quotePostgrestValue(scopedGroupId)},channel.eq.${quotePostgrestValue(groupId)},recipient_id.eq.${quotePostgrestValue(`group_meta_id:${groupId}`)},recipient_id.like.${quotePostgrestValue(`%${groupId}%`)}`);
    } catch {}

    try {
      await supabase.from('chat_channels').delete().or(`id.eq.${quotePostgrestValue(scopedGroupId)},id.eq.${quotePostgrestValue(groupId)},name.eq.${quotePostgrestValue(groupName)}`);
    } catch {}

    try {
      await supabase.from('messages').insert([
        {
          channel: getScopedChatChannel(activeEmployee?.companyId, 'geral'),
          text: `🗑️ O grupo #${groupName} foi excluído por ${activeEmployee?.name || 'Gestão'}.`,
          recipient_id: `group_deleted:${groupId}`,
          sender_id: activeEmployee?.id || 'gestor',
          sender_name: activeEmployee?.name || 'Gestor',
          sender_role: activeEmployee?.role || 'Gestor',
          sender_avatar: activeEmployee?.avatar || '',
        },
      ]);
    } catch {}

    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]');
      if (!deletedList.includes(groupId)) {
        deletedList.push(groupId);
        localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(deletedList));
      }
    } catch {}

    const remaining = teamChannels.filter(c => c.id !== groupId);
    setTeamChannels(remaining);
    try {
      localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(remaining));
    } catch {}

    if (activeChatChannel === groupId) {
      const visibleRemaining = remaining.filter(c => {
        if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return false;
        if (!c.members || c.members.length === 0) return true;
        return Boolean(activeEmployee?.id && c.members.includes(activeEmployee.id));
      });
      if (visibleRemaining.length > 0) {
        setActiveChatChannel(visibleRemaining[0].id);
      } else {
        setActiveChatMode('direct');
      }
    }

    setIsDeletingGroup(false);
    setGroupToDelete(null);
  };

  return (
    <div className="approvals-page w-full animate-in fade-in duration-200 relative">
      {/* Main Chat Workspace Container */}
      <div
        className={`rounded-3xl border overflow-hidden shadow-2xl relative z-10 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] min-h-[660px] transition-all ${
          isDark
            ? 'border-[#282a33] bg-[#111216]'
            : 'border-[#E8DCCB] bg-white shadow-xl'
        }`}
      >
        {/* Left Channel & Presence Column */}
        <aside className={`hidden lg:flex flex-col border-r p-4 justify-between transition-all ${
          isDark
            ? 'border-[#282a33] bg-[#15161b]/95'
            : 'border-[#E8DCCB] bg-[#FFFDF8]'
        }`}>
          <div className="space-y-4">
            {/* Channels section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Canais da Equipe
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {visibleTeamChannels.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs transition-all hover:scale-105 cursor-pointer flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg, #96183C, #F89847)' }}
                  title="Criar novo canal de equipe"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {visibleTeamChannels.length === 0 && (
                  <div className={`p-3 text-center text-[10px] italic rounded-xl border border-dashed ${
                    isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
                  }`}>
                    Nenhum grupo criado ainda. Clique em "+ Novo" para criar um grupo.
                  </div>
                )}
                {visibleTeamChannels.map((chan) => {
                  const isCurrent = activeChatMode === 'channel' && activeChatChannel === chan.id;
                  return (
                    <div
                      key={chan.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveChatMode('channel');
                        setActiveChatChannel(chan.id);
                      }}
                      className={`group/chan relative w-full text-left p-3 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 ${
                        isCurrent
                          ? 'border-[#F59242]/40 shadow-lg'
                          : isDark
                            ? 'border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                            : 'border-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                      style={isCurrent ? {
                        background: 'linear-gradient(135deg, rgba(100, 12, 30, 0.45) 0%, rgba(159, 36, 60, 0.35) 60%, rgba(245, 146, 66, 0.20) 100%)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                      } : {}}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${
                          isCurrent
                            ? 'text-white'
                            : isDark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-100'
                        }`}
                        style={isCurrent && !chan.avatar ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                      >
                        {chan.avatar ? (
                          <img src={chan.avatar} alt={chan.name} className="w-full h-full object-cover" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs font-bold truncate ${
                            isCurrent
                              ? isDark ? 'text-white font-black' : 'text-[#640C1E] font-black'
                              : isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            #{chan.name}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromptDeleteGroup(chan);
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/25 text-slate-400 hover:text-rose-400 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                              title={`Excluir canal #${chan.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className={`text-[10px] truncate mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {chan.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipe Conectada (Privado 1 a 1) */}
            <div className={`pt-2 border-t ${
              isDark ? 'border-[#282a33]/60' : 'border-[#E8DCCB]'
            }`}>
              <div className="px-2 mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Equipe Conectada (Privado)
                </span>
              </div>

              {directEmployees.length === 0 ? (
                <div className={`p-3 text-center text-[10px] italic rounded-xl border border-dashed ${
                  isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
                }`}>
                  Nenhum outro integrante cadastrado nesta empresa ainda.
                </div>
              ) : (
                directEmployees.map((emp) => {
                  const isSelected = activeChatMode === 'direct' && selectedDirectEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setActiveChatMode('direct');
                        setSelectedDirectEmployeeId(emp.id);
                      }}
                      className={`w-full text-left flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-[#F59242] shadow-md'
                          : isDark ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-slate-100'
                      }`}
                      style={isSelected ? {
                        background: 'linear-gradient(135deg, rgba(100, 12, 30, 0.40) 0%, rgba(245, 146, 66, 0.16) 100%)',
                      } : {}}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={emp.name}
                          className={`w-7 h-7 rounded-full object-cover ${
                            isSelected ? 'ring-2 ring-[#F59242]' : isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                          }`}
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                          isDark ? 'border-[#15161b]' : 'border-white'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-[11px] font-bold truncate ${
                            isSelected ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}>
                            {emp.name}
                          </p>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-[#F59242] text-black shrink-0">
                              PRIVADO
                            </span>
                          )}
                        </div>
                        <p className={`text-[9px] truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {emp.role} • {emp.department}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Main Chat Conversation Column */}
        <div
          className="flex flex-col min-w-0"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 95% 5%, rgba(245, 146, 66, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 0%, rgba(100, 12, 30, 0.08) 0%, transparent 35%), #0e0f12'
              : '#FCFAF5',
          }}
        >
          {/* Conversation Header */}
          <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 backdrop-blur-xs transition-all ${
            isDark ? 'border-[#282a33] bg-[#111216]/90' : 'border-[#E8DCCB] bg-[#FFFDF8]'
          }`}>
            <div className="flex items-center gap-3">
              {activeChatMode === 'direct' ? (
                <div className="relative shrink-0">
                  <img
                    src={selectedDirectEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={selectedDirectEmployee?.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#F59242]"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111216]" />
                </div>
              ) : activeChannelInfo ? (
                <button
                  type="button"
                  onClick={() => {
                    setChannelToEditAvatar(activeChannelInfo);
                    managerActiveGroupAvatarInputRef.current?.click();
                  }}
                  title="Clique para alterar a imagem do grupo"
                  className="group/av relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 overflow-hidden cursor-pointer"
                  style={!activeChannelInfo.avatar ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                >
                  {activeChannelInfo.avatar ? (
                    <img src={activeChannelInfo.avatar} alt={activeChannelInfo.name} className="w-full h-full object-cover" />
                  ) : (
                    <MessageSquare className="w-5 h-5" />
                  )}
                  <span className="absolute inset-0 bg-black/55 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </span>
                </button>
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                  style={{ background: 'linear-gradient(135deg, #640C1E, #F59242)' }}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#640C1E]'}`}>
                    {activeChatMode === 'direct'
                      ? `Chat Privado: ${selectedDirectEmployee?.name || 'Selecione um contato'}`
                      : activeChannelInfo ? `#${activeChannelInfo.name}` : 'Nenhum grupo ativo'}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={managerActiveGroupAvatarInputRef}
                accept="image/*"
                onChange={handleUpdateExistingChannelAvatar}
                className="hidden"
              />
              {activeChatMode === 'channel' && activeChannelInfo && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelToEditAvatar(activeChannelInfo);
                      managerActiveGroupAvatarInputRef.current?.click();
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isDark
                        ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title={`Alterar imagem do canal #${activeChannelInfo.name}`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#F59242]" />
                    <span className="hidden sm:inline">Foto do Grupo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptDeleteGroup(activeChannelInfo)}
                    className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Excluir canal #${activeChannelInfo.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir Grupo</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div ref={chatMessagesContainerRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[380px] max-h-[520px]">
            <div className="flex items-center gap-3">
              <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Mensagens de Hoje
              </span>
              <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
            </div>

            {chatLoading && chatMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Carregando mensagens em tempo real...
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-8 h-8 text-slate-600 mb-2 opacity-40" />
                <p className="text-xs text-slate-400">Nenhuma mensagem neste canal ainda.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {activeChatMode === 'direct'
                    ? `Envie uma mensagem direta para ${selectedDirectEmployee?.name || 'um colaborador'}.`
                    : activeChannelInfo
                      ? `Envie a primeira mensagem no canal #${activeChannelInfo.name}!`
                      : 'Clique em "+ Novo" na barra lateral para criar seu primeiro grupo com a equipe.'}
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender_id === activeEmployee?.id;
                const isManagerRole = msg.sender_role?.toUpperCase().includes('GESTOR') || msg.sender_role?.toUpperCase().includes('GERENTE') || msg.sender_role?.toUpperCase().includes('RH');
                const timeStr = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : 'Agora';
                const parsed = parseChatMessage(msg.text, msg.attachment);
                const isEditingThis = editingManagerMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`group/mmsg flex items-start gap-3 ${isMe ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={msg.sender_avatar || (isManagerRole ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                        alt={msg.sender_name}
                        className={`w-9 h-9 rounded-2xl object-cover ${
                          isMe ? 'ring-2 ring-[#F59242]' : isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                        }`}
                      />
                      {!isMe && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                          isDark ? 'border-[#0e0f12]' : 'border-white'
                        }`} />
                      )}
                    </div>

                    <div className={`max-w-[75%] space-y-1 ${isMe ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {msg.sender_name}
                        </strong>
                        <span className="text-slate-400">•</span>
                        <span className={isMe ? 'text-[#F59242] font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}>
                          {msg.sender_role}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono text-slate-400">{timeStr}</span>
                        {!isEditingThis && (
                          <span className="inline-flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover/mmsg:opacity-100 transition-opacity ml-1">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingToManagerMsg({
                                  id: msg.id,
                                  sender_name: msg.sender_name,
                                  text: parsed.text || (parsed.attachment ? '📷 Imagem anexada' : 'Mensagem'),
                                });
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                              }`}
                              title="Responder esta mensagem"
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                            {isMe && !msg.id.startsWith('temp-') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingManagerMsgId(msg.id);
                                    setEditingManagerMsgText(parsed.text || '');
                                  }}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                                  }`}
                                  title="Editar mensagem"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteManagerOwnMessage(msg.id)}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isDark ? 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400' : 'hover:bg-rose-100 text-slate-500 hover:text-rose-600'
                                  }`}
                                  title="Excluir mensagem"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <div
                        className="inline-block p-3.5 text-xs leading-relaxed text-left rounded-2xl shadow-lg break-words"
                        style={isMe ? {
                          background: 'linear-gradient(135deg, #640C1E 0%, #9F243C 100%)',
                          color: '#F9DE97',
                          borderRadius: '18px 4px 18px 18px',
                          boxShadow: '0 10px 24px rgba(100, 12, 30, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                        } : {
                          background: isDark ? '#1b1d24' : '#ffffff',
                          color: isDark ? '#e2e8f0' : '#1e293b',
                          border: isDark ? '1px solid #282a33' : '1px solid #E8DCCB',
                          borderRadius: '4px 18px 18px 18px',
                          boxShadow: isDark ? '0 8px 20px rgba(0, 0, 0, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {parsed.replyTo && (
                          <div
                            className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-2 text-[10px] leading-snug ${
                              isMe
                                ? 'bg-black/25 border-[#F59242] text-[#F9DE97]/90'
                                : isDark
                                  ? 'bg-black/30 border-[#F59242] text-slate-300'
                                  : 'bg-slate-100 border-[#96183c] text-slate-600'
                            }`}
                          >
                            <span className="font-extrabold block opacity-95">
                              {parsed.replyTo.sender_name}
                            </span>
                            <span className="line-clamp-2 opacity-80 break-words">
                              {parsed.replyTo.text}
                            </span>
                          </div>
                        )}
                        {isEditingThis ? (
                          <div className="space-y-2 min-w-[220px]">
                            <input
                              type="text"
                              value={editingManagerMsgText}
                              onChange={(e) => setEditingManagerMsgText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveManagerEditMessage(msg.id);
                                } else if (e.key === 'Escape') {
                                  setEditingManagerMsgId(null);
                                  setEditingManagerMsgText('');
                                }
                              }}
                              autoFocus
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-black/30 text-white border border-white/30 outline-none"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingManagerMsgId(null);
                                  setEditingManagerMsgText('');
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/25 hover:bg-black/40 text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveManagerEditMessage(msg.id)}
                                className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#F59242] text-black hover:brightness-110 flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          parsed.text && (
                            <p className="leading-relaxed">{parsed.text}</p>
                          )
                        )}

                        {/* Anexo de Imagem Salvo no Banco */}
                        {parsed.attachment && parsed.attachment.type === 'image' && (
                          <div className="mt-2">
                            <div
                              className="relative group/img rounded-xl overflow-hidden border border-black/15 dark:border-white/15 cursor-pointer max-w-[260px] shadow-sm bg-black/20"
                              onClick={() => setManagerPreviewModalImage({ url: parsed.attachment!.url, name: parsed.attachment!.name })}
                              title="Clique para ampliar a imagem"
                            >
                              <img
                                src={sanitizeSafeUrl(parsed.attachment.url, { allowDataImage: true, allowBlob: true })}
                                alt={parsed.attachment.name}
                                className="w-full max-h-52 object-cover group-hover/img:scale-102 transition-transform duration-200"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                                <span className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80">
                                  <Eye className="w-3.5 h-3.5" />
                                </span>
                                <a
                                  href={sanitizeSafeUrl(parsed.attachment.url, { allowDataImage: true, allowBlob: true })}
                                  download={parsed.attachment.name}
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80"
                                  title="Baixar imagem"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                              <div className="px-2.5 py-1 bg-black/60 backdrop-blur-xs text-[9px] text-white/90 flex items-center justify-between">
                                <span className="truncate max-w-[150px]">{parsed.attachment.name}</span>
                                {parsed.attachment.size && <span className="opacity-80">{parsed.attachment.size}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className={`px-4 py-2 border-t flex items-center gap-2 overflow-x-auto scrollbar-none ${
            isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
          }`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#F59242]" /> Sugestões:
            </span>
            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setNewChatInput(sug)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-[#15161b] hover:bg-[#1f222c] border-[#282a33] text-slate-300 hover:text-white'
                    : 'bg-white hover:bg-slate-100 border-[#E8DCCB] text-slate-700 hover:text-slate-900'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Banner de Mensagem Sendo Respondida */}
          {replyingToManagerMsg && (
            <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
              !isDark ? 'bg-slate-100 border-[#E8DCCB] text-slate-800' : 'bg-[#111216] border-[#282a33] text-slate-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0 border-l-2 border-[#F59242] pl-2.5">
                <Reply className="w-3.5 h-3.5 text-[#F59242] shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-[10px] text-[#F59242] truncate">
                    Respondendo a {replyingToManagerMsg.sender_name}
                  </p>
                  <p className="text-[11px] opacity-80 truncate max-w-[420px]">
                    {replyingToManagerMsg.text}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToManagerMsg(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                title="Cancelar resposta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Banner de Preview do Anexo Pendente do Gestor */}
          {pendingManagerAttachment && (
            <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
              !isDark ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={pendingManagerAttachment.url}
                  alt="Preview do anexo"
                  className="w-9 h-9 rounded-lg object-cover border border-amber-500/30 shrink-0 shadow-xs"
                />
                <div className="min-w-0">
                  <p className="font-bold truncate text-[11px] text-amber-400">{pendingManagerAttachment.name}</p>
                  <p className="text-[9px] opacity-75">{pendingManagerAttachment.size || 'Imagem pronta para envio'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingManagerAttachment(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
                title="Remover anexo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Barra de Emojis Rápidos */}
          {isManagerEmojiPickerOpen && (
            <div className={`px-4 py-2 border-t flex flex-wrap items-center gap-1.5 shrink-0 ${
              isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
            }`}>
              {CHAT_COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewChatInput(prev => prev + emoji)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-115 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            className={`p-3 sm:p-4 border-t flex items-center gap-2 ${
              isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
            }`}
          >
            {/* Input oculto para anexar arquivos */}
            <input
              type="file"
              ref={managerFileInputRef}
              accept="image/*"
              onChange={handleManagerFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => managerFileInputRef.current?.click()}
              disabled={isAttachingManager}
              aria-label="Anexar arquivo ou comprovante"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                pendingManagerAttachment
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Anexar imagem ou documento"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsManagerEmojiPickerOpen(prev => !prev)}
              aria-label="Inserir emoji"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isManagerEmojiPickerOpen
                  ? 'bg-[#F59242]/20 text-[#F59242] border border-[#F59242]/30'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Inserir emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              id="chat-main-input"
              type="text"
              value={newChatInput}
              onChange={(e) => setNewChatInput(e.target.value)}
              disabled={activeChatMode === 'channel' && !activeChannelInfo}
              placeholder={
                pendingManagerAttachment
                  ? 'Adicionar legenda para a imagem (opcional)...'
                  : activeChatMode === 'direct'
                    ? `Mensagem privada para ${selectedDirectEmployee?.name || 'Colaborador'}...`
                    : activeChannelInfo
                      ? `Mensagem no canal #${activeChannelInfo.name}...`
                      : 'Crie ou selecione um grupo para enviar mensagens...'
              }
              className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${
                isDark
                  ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]/60'
                  : 'bg-white border-[#E8DCCB] text-slate-900 placeholder:text-slate-400 focus:border-[#9F243C]'
              }`}
            />

            <button
              type="submit"
              aria-label="Enviar mensagem"
              disabled={(!newChatInput.trim() && !pendingManagerAttachment) || (activeChatMode === 'channel' && !activeChannelInfo)}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                boxShadow: '0 4px 16px rgba(100, 12, 30, 0.35)',
              }}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal Novo Grupo da Equipe */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90%] ${
            isDark ? 'bg-[#161720] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}>
              <div className="flex items-center gap-2 text-white">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
                  <Hash className="w-4 h-4 text-[#faf0ac]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs leading-tight">Novo Grupo de Equipe</h4>
                  <p className="text-[10px] text-[#faf0ac]/90">Crie um canal corporativo no Supabase</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewGroup} className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={managerGroupAvatarInputRef}
                  accept="image/*"
                  onChange={handleManagerGroupAvatarSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => managerGroupAvatarInputRef.current?.click()}
                  className={`w-14 h-14 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center shrink-0 overflow-hidden transition-all cursor-pointer relative group ${
                    isDark ? 'border-white/20 bg-white/5 hover:border-[#f89642]' : 'border-slate-300 bg-slate-100 hover:border-[#96183c]'
                  }`}
                  title="Selecionar imagem do grupo"
                >
                  {newGroupAvatar ? (
                    <img src={newGroupAvatar} alt="Avatar do grupo" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 opacity-60" />
                      <span className="text-[8px] font-bold opacity-60 mt-0.5">Foto</span>
                    </>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-bold mb-1 opacity-80">Nome do Grupo (#canal)</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="ex: noturno, plantao-uti, vendas"
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                    }`}
                  />
                  {newGroupAvatar && (
                    <button
                      type="button"
                      onClick={() => setNewGroupAvatar('')}
                      className="text-[10px] text-rose-400 hover:underline mt-1 font-semibold cursor-pointer"
                    >
                      Remover imagem
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 opacity-80">Descrição do Canal</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="ex: Plantonistas do final de semana"
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1 opacity-80">Tag / Badge</label>
                <select
                  value={newGroupBadge}
                  onChange={(e) => setNewGroupBadge(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer ${
                    isDark ? 'bg-[#1C1D26] border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Equipe">Equipe</option>
                  <option value="Plantão">Plantão</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Setor">Setor</option>
                  <option value="Liderança">Liderança</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold opacity-80">Membros Participantes</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMemberIds.length === employees.length) {
                        setSelectedMemberIds([]);
                      } else {
                        setSelectedMemberIds(employees.map(e => e.id));
                      }
                    }}
                    className="text-[10px] text-[#f89642] hover:underline cursor-pointer font-bold"
                  >
                    {selectedMemberIds.length === employees.length ? 'Desmarcar todos' : 'Todos'}
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border rounded-xl p-2 border-white/10">
                  {employees.map((emp) => {
                    const isChecked = selectedMemberIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                          isChecked ? (isDark ? 'bg-white/10' : 'bg-slate-200') : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100')
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedMemberIds(prev =>
                              prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            );
                          }}
                          className="rounded accent-[#f89642] shrink-0"
                        />
                        <img
                          src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={emp.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                        />
                        <span className="truncate font-semibold">{emp.name}</span>
                        <span className="text-[10px] text-slate-400 ml-auto truncate max-w-[130px]">{emp.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isDark ? 'text-slate-300 bg-white/10 hover:bg-white/15' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}
                >
                  {isCreatingGroup ? 'Criando...' : 'Criar Canal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DO GRUPO */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 text-center transition-all ${
            !isDark ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-3 border border-rose-500/30 shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black leading-tight">Excluir Grupo #{groupToDelete.name}?</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Esta ação removerá permanentemente o canal e todas as mensagens para todos os colaboradores. Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                disabled={isDeletingGroup}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  !isDark ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 bg-white/10 hover:bg-white/15'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                disabled={isDeletingGroup}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingGroup ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAÇÃO AMPLIADA DA IMAGEM NO CHAT DO GESTOR */}
      {managerPreviewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setManagerPreviewModalImage(null)}
        >
          <div className="relative max-w-full max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-2 text-white text-xs">
              <span className="font-semibold truncate max-w-[200px] sm:max-w-md">{managerPreviewModalImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={sanitizeSafeUrl(managerPreviewModalImage.url, { allowDataImage: true, allowBlob: true })}
                  download={managerPreviewModalImage.name}
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Baixar imagem"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setManagerPreviewModalImage(null)}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={managerPreviewModalImage.url}
              alt={managerPreviewModalImage.name}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
