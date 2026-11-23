import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  AlertCircle, 
  Lock, 
  Users, 
  Hash, 
  Sparkles, 
  Trash2, 
  Plus,
  Paperclip,
  Download,
  Eye,
  Image as ImageIcon,
  Smile,
  Edit2,
  Check,
  Reply
} from 'lucide-react';
import { Employee } from '@/types';
import { supabase } from '@/shared/services/supabase';
import { sanitizeSafeUrl, quotePostgrestValue } from '@/shared/utils/security';
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
  getDisplayChatChannel
} from '@/shared/utils/chatUtils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  employees?: Employee[];
  isLightTheme?: boolean;
  embedded?: boolean;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar: string;
  text: string;
  attachment?: string | null;
  created_at: string;
  channel?: string;
  recipient_id?: string | null;
}

export interface ChatChannelItem {
  id: string;
  name: string;
  desc: string;
  badge: string;
  unread?: number;
  members?: string[];
  avatar?: string;
}

export const DEFAULT_TEAM_CHANNELS: ChatChannelItem[] = [];

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  employees,
  isLightTheme = false,
  embedded = false,
}) => {
  const isDark = !isLightTheme;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Emoji Picker, Resposta (Reply) & Edição/Exclusão de Mensagem Própria
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatReplyInfo | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState<string>('');

  // Anexos do chat
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo: 'direct' (1-on-1 com a Gestora ou Colaborador) ou 'group' (canais da equipe)
  const [chatType, setChatType] = useState<'direct' | 'group'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Modais secundários: Ver Integrantes, Confirmar Exclusão e Criar Novo Grupo
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ChatChannelItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);

  // Estados do formulário de criação de novo grupo
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupBadge, setNewGroupBadge] = useState('Equipe');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const activeGroupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Identifica se o usuário é RH
  const isRhUser = useMemo(() => {
    return Boolean(currentEmployee?.isRh || currentEmployee?.roleType === 'rh' || currentEmployee?.isMasterManager);
  }, [currentEmployee]);

  const isManager = useMemo(() => {
    const roleUpper = (currentEmployee?.role || '').toUpperCase();
    return isRhUser || roleUpper.includes('GESTOR') || roleUpper.includes('GERENTE') || currentEmployee?.id === 'mgr-1';
  }, [currentEmployee, isRhUser]);

  const companyKey = useMemo(() => {
    return (currentEmployee?.companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [currentEmployee?.companyId]);

  // Lista de colaboradores cadastrados na empresa
  const allEmployeesList = useMemo(() => {
    return employees || [];
  }, [employees]);

  // Lista de contatos disponíveis para conversa direta (1 a 1), priorizando liderança (Gestor/RH)
  const directContacts = useMemo(() => {
    const list = allEmployeesList.filter(e => e.id !== currentEmployee?.id);
    return list.sort((a, b) => {
      const aIsLeader = (currentEmployee.managerIds && currentEmployee.managerIds.includes(a.id)) ||
        a.roleType === 'gestor' || a.role?.toUpperCase().includes('GESTOR') || a.isRh || a.roleType === 'rh';
      const bIsLeader = (currentEmployee.managerIds && currentEmployee.managerIds.includes(b.id)) ||
        b.roleType === 'gestor' || b.role?.toUpperCase().includes('GESTOR') || b.isRh || b.roleType === 'rh';
      if (aIsLeader && !bIsLeader) return -1;
      if (!aIsLeader && bIsLeader) return 1;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [allEmployeesList, currentEmployee?.id, currentEmployee?.managerIds]);

  // Contagem de mensagens não lidas por contato em conversa direta
  const [unreadDirectByContact, setUnreadDirectByContact] = useState<Record<string, number>>({});
  const totalDirectUnread = useMemo(() => {
    return Object.values(unreadDirectByContact).reduce((acc: number, c: number) => acc + c, 0);
  }, [unreadDirectByContact]);

  const getChatLastReadTimestamp = (companyId?: string, employeeId?: string): string | null => {
    try {
      return localStorage.getItem(`chat_last_read_${companyId || 'default'}_${employeeId || 'anon'}`);
    } catch {
      return null;
    }
  };

  // Seleção de colaborador/gestor para conversa direta
  const [selectedDirectEmployeeId, setSelectedDirectEmployeeId] = useState<string>('');

  useEffect(() => {
    if (directContacts.length > 0 && (!selectedDirectEmployeeId || !directContacts.some(e => e.id === selectedDirectEmployeeId))) {
      const contactWithUnread = directContacts.find(e => (unreadDirectByContact[e.id] || 0) > 0);
      if (contactWithUnread) {
        setSelectedDirectEmployeeId(contactWithUnread.id);
        return;
      }

      const managerContact = directContacts.find(e => 
        (currentEmployee.managerIds && currentEmployee.managerIds.includes(e.id)) ||
        e.roleType === 'gestor' ||
        e.role?.toUpperCase().includes('GESTOR') ||
        e.isRh ||
        e.roleType === 'rh'
      );
      setSelectedDirectEmployeeId(managerContact ? managerContact.id : directContacts[0].id);
    }
  }, [directContacts, selectedDirectEmployeeId, currentEmployee, unreadDirectByContact]);

  // Ao abrir o chat ou alterar empresa, busca mensagens diretas não lidas por contato
  useEffect(() => {
    if (!isOpen || !currentEmployee?.id) return;
    const fetchRecentDirectStats = async () => {
      try {
        const lastReadTs = getChatLastReadTimestamp(currentEmployee.companyId, currentEmployee.id) || new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('messages')
          .select('sender_id, created_at')
          .or(`recipient_id.eq.${quotePostgrestValue(currentEmployee.id)},channel.like.${quotePostgrestValue(`%direct_%${currentEmployee.id}%`)}`)
          .neq('sender_id', currentEmployee.id)
          .gt('created_at', lastReadTs);

        if (data && data.length > 0) {
          const counts: Record<string, number> = {};
          let latestSender = '';
          data.forEach((m: any) => {
            counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
            latestSender = m.sender_id;
          });
          setUnreadDirectByContact(counts);
          if (latestSender && directContacts.some(c => c.id === latestSender)) {
            setSelectedDirectEmployeeId(latestSender);
          }
        }
      } catch {}
    };
    fetchRecentDirectStats();
  }, [isOpen, currentEmployee?.id, currentEmployee?.companyId, directContacts]);

  // Limpa o contador de não lidas do contato que está ativo no momento
  useEffect(() => {
    if (chatType === 'direct' && selectedDirectEmployeeId) {
      setUnreadDirectByContact(prev => {
        if (!prev[selectedDirectEmployeeId]) return prev;
        const next = { ...prev };
        delete next[selectedDirectEmployeeId];
        return next;
      });
    }
  }, [chatType, selectedDirectEmployeeId]);

  const selectedDirectEmployee = useMemo(() => {
    return directContacts.find(e => e.id === selectedDirectEmployeeId) || null;
  }, [directContacts, selectedDirectEmployeeId]);

  // Lista dinâmica de grupos/canais disponíveis isolada por empresa
  const [teamChannels, setTeamChannels] = useState<ChatChannelItem[]>(() => {
    try {
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      const deletedStr = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
      const deletedIds = new Set(deletedStr ? JSON.parse(deletedStr) : []);

      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        return parsed
          .filter(c => !deletedIds.has(c.id) && c.id !== 'geral' && c.id !== 'escalas' && c.id !== 'gestao')
          .map(c => ({
            ...c,
            badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
          }));
      }
    } catch {}
    return DEFAULT_TEAM_CHANNELS;
  });

  // Atualiza canais ao alternar de empresa
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      const deletedStr = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
      const deletedIds = new Set(deletedStr ? JSON.parse(deletedStr) : []);

      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        setTeamChannels(
          parsed
            .filter(c => !deletedIds.has(c.id) && c.id !== 'geral' && c.id !== 'escalas' && c.id !== 'gestao')
            .map(c => ({
              ...c,
              badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
            }))
        );
      } else {
        setTeamChannels(DEFAULT_TEAM_CHANNELS);
      }
    } catch {
      setTeamChannels(DEFAULT_TEAM_CHANNELS);
    }
  }, [companyKey]);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevChannelRef = useRef<string>('');
  const prevMsgCountRef = useRef<number>(0);

  // Filtra apenas os canais aos quais o usuário pertence (inclusive Gestor/RH só vê grupos privados onde está incluído)
  const visibleGroupChannels = useMemo(() => {
    return teamChannels.filter((c) => {
      if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return false;
      if (!c.members || c.members.length === 0) return true;
      return c.members.includes(currentEmployee.id);
    });
  }, [teamChannels, currentEmployee.id]);

  // Mantém o grupo selecionado válido conforme a lista de grupos visíveis
  useEffect(() => {
    if (visibleGroupChannels.length > 0 && !visibleGroupChannels.some(c => c.id === selectedGroupId)) {
      setSelectedGroupId(visibleGroupChannels[0].id);
    } else if (visibleGroupChannels.length === 0 && selectedGroupId !== '') {
      setSelectedGroupId('');
    }
  }, [visibleGroupChannels, selectedGroupId]);

  const activeGroup = useMemo(() => {
    return visibleGroupChannels.find(c => c.id === selectedGroupId) || visibleGroupChannels[0] || null;
  }, [visibleGroupChannels, selectedGroupId]);

  // Canal atual ativo no banco (isolado por empresa/participantes)
  const currentChannel = useMemo(() => {
    if (chatType === 'direct') {
      if (!selectedDirectEmployee?.id) return `cmp_${companyKey}__direct_none`;
      return getScopedDirectChannel(currentEmployee?.companyId, currentEmployee?.id, selectedDirectEmployee.id);
    }
    if (!activeGroup?.id) return `cmp_${companyKey}__group_none`;
    return getScopedChatChannel(currentEmployee?.companyId, activeGroup.id);
  }, [chatType, selectedDirectEmployee?.id, activeGroup?.id, currentEmployee?.companyId, currentEmployee?.id, companyKey]);

  // Lista de integrantes do grupo ativo
  const groupMembersList = useMemo(() => {
    if (!activeGroup) return [];
    if (!activeGroup.members || activeGroup.members.length === 0) {
      return allEmployeesList;
    }
    return allEmployeesList.filter(e => activeGroup.members?.includes(e.id));
  }, [activeGroup, allEmployeesList]);

  // Controle inteligente de rolagem: só rola para o final ao trocar de canal ou quando chega uma nova mensagem
  useEffect(() => {
    const container = messagesContainerRef.current;
    const isChannelSwitch = prevChannelRef.current !== currentChannel;
    const isNewMessage = messages.length > prevMsgCountRef.current;

    if (isChannelSwitch && messages.length > 0) {
      prevChannelRef.current = currentChannel;
      prevMsgCountRef.current = messages.length;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    if (isNewMessage) {
      const lastMsg = messages[messages.length - 1];
      const isFromMe = lastMsg?.sender_id === currentEmployee.id;
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 140
        : true;

      if (isFromMe || isNearBottom || prevMsgCountRef.current === 0) {
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }
    }

    prevMsgCountRef.current = messages.length;
  }, [messages, currentChannel, currentEmployee.id]);

  // Carrega e sincroniza os canais de grupo disponíveis (incluindo fotos salvas e exclusões feitas por outros usuários)
  useEffect(() => {
    if (!isOpen) return;

    const syncChannels = async () => {
      const deletedIds = new Set<string>();
      const deletedNames = new Set<string>(['girllssss']);
      try {
        const savedDeleted = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
        if (savedDeleted) {
          JSON.parse(savedDeleted).forEach((id: string) => deletedIds.add(id));
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

      // 1. Tenta tabela chat_channels
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

      // 2. Busca metadados e imagens de grupos gravados na tabela messages (group_meta_id: e group_meta:)
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
        // Inicializa com canais padrão (#geral, #escalas, #gestao)
        DEFAULT_TEAM_CHANNELS.forEach(def => {
          const existing = prev.find(p => p.id === def.id);
          const meta = foundMetaMap.get(def.id) || loadedFromDb.get(def.id);
          map.set(def.id, {
            ...def,
            avatar: meta?.avatar || existing?.avatar,
          });
        });

        // Adiciona canais vindos de chat_channels
        loadedFromDb.forEach((val, key) => {
          const meta = foundMetaMap.get(key);
          const existing = prev.find(p => p.id === key);
          map.set(key, {
            ...val,
            members: meta?.members || val.members || existing?.members,
            avatar: meta?.avatar || val.avatar || existing?.avatar,
          });
        });

        // Adiciona grupos vindos de metadados (caso não estejam na tabela chat_channels ou tenham foto atualizada)
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

    syncChannels();
    const syncTimer = setInterval(syncChannels, 5000);
    return () => clearInterval(syncTimer);
  }, [isOpen, companyKey, currentEmployee?.companyId]);

  // Carrega as mensagens do canal ativo e escuta novas em tempo real
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      if (
        (chatType === 'direct' && !selectedDirectEmployee?.id) ||
        (chatType === 'group' && !activeGroup?.id)
      ) {
        setMessages([]);
        setLoading(false);
        return;
      }

      let query = supabase.from('messages').select('*');

      if (chatType === 'direct') {
        const pair = [currentEmployee.id, selectedDirectEmployee!.id].sort().join('_');
        const qDirect = quotePostgrestValue(`direct_${pair}`);
        const qDirectLike = quotePostgrestValue(`%direct_${pair}`);
        const qSelf = quotePostgrestValue(currentEmployee.id);
        const qOther = quotePostgrestValue(selectedDirectEmployee!.id);
        query = query.or(`channel.eq.${qDirect},channel.like.${qDirectLike},and(sender_id.eq.${qSelf},recipient_id.eq.${qOther}),and(sender_id.eq.${qOther},recipient_id.eq.${qSelf})`);
      } else {
        query = query.eq('channel', currentChannel);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens do Supabase:', error);
        setErrorMessage(error.message);
      } else if (data) {
        setErrorMessage(null);
        // Filtra mensagens técnicas de controle de grupo para não poluir nem disparar scroll
        const cleanData = (data as ChatMessage[]).filter((d) => !isSystemControlMessage(d));
        setMessages((prev) => {
          const pendingTemp = prev.filter(
            (p) =>
              p.id.startsWith('temp-') &&
              !cleanData.some((d: any) => d.text === p.text && d.sender_id === p.sender_id)
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
      setLoading(false);
    };

    setLoading(true);
    setMessages([]);
    fetchMessages();

    // Sincronização periódica a cada 3 segundos (garantia de entrega)
    const interval = setInterval(fetchMessages, 3000);

    // Canal Realtime do Supabase via WebSocket
    const channelSubId = `chat_rt_${currentEmployee.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelSubId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setMessages(prev => prev.filter(m => m.id !== oldId));
            }
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, text: updatedMsg.text } : m));
            return;
          }

          const newMsg = payload.new as ChatMessage;

          // Se a mensagem for um aviso de exclusão de grupo
          if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_deleted:')) {
            const deletedId = getDisplayChatChannel(newMsg.recipient_id.replace('group_deleted:', ''));
            setTeamChannels((prev) => {
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

            if (selectedGroupId === deletedId) {
              setSelectedGroupId('');
            }
            return;
          }

          // Se a nova mensagem for metadado de grupo (criação ou atualização de foto do grupo)
          const extractedMeta = extractGroupMetaFromMessage(newMsg);
          if (extractedMeta && extractedMeta.id) {
            const rawChannelId = extractedMeta.id;
            const members = extractedMeta.members;
            if (rawChannelId.startsWith('grupo_') && members && members.length > 0 && !members.includes(currentEmployee.id)) {
              return;
            }
            setTeamChannels((prev) => {
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

          const directPair = (chatType === 'direct' && selectedDirectEmployee?.id)
            ? [currentEmployee.id, selectedDirectEmployee.id].sort().join('_')
            : null;
          const isDirectMatch = Boolean(directPair && newMsg.channel && newMsg.channel.includes(`direct_${directPair}`));
          const isDirectRecipientMatch = Boolean(
            chatType === 'direct' &&
            selectedDirectEmployee?.id &&
            ((newMsg.sender_id === selectedDirectEmployee.id && newMsg.recipient_id === currentEmployee.id) ||
             (newMsg.sender_id === currentEmployee.id && newMsg.recipient_id === selectedDirectEmployee.id))
          );

          if (newMsg.channel === currentChannel || isDirectMatch || isDirectRecipientMatch) {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) =>
                  !(
                    m.id.startsWith('temp-') &&
                    m.text === newMsg.text &&
                    m.sender_id === newMsg.sender_id
                  )
              );
              if (filtered.some((m) => m.id === newMsg.id)) return filtered;
              return [...filtered, newMsg];
            });
          } else if (newMsg.sender_id !== currentEmployee.id) {
            const isDirectForMe = Boolean(
              newMsg.recipient_id === currentEmployee.id ||
              (newMsg.channel && newMsg.channel.includes('direct_') && newMsg.channel.includes(currentEmployee.id))
            );
            if (isDirectForMe) {
              setUnreadDirectByContact(prev => ({
                ...prev,
                [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentChannel, chatType, selectedDirectEmployee?.id, selectedGroupId, currentEmployee.id, companyKey]);

  if (!isOpen) return null;

  // Envio de Mensagem e Anexos
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAttaching(true);
    try {
      const compressed = await compressImageFile(file);
      setPendingAttachment(compressed);
    } catch (err) {
      console.error('Erro ao processar anexo:', err);
      setErrorMessage('Não foi possível anexar o arquivo selecionado.');
    } finally {
      setIsAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGroupAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 260, 0.78);
      setNewGroupAvatar(compressed.url);
    } catch (err) {
      console.error('Erro ao processar imagem do grupo:', err);
    } finally {
      if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
    }
  };

  const handleUpdateActiveGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup) return;
    try {
      const compressed = await compressImageFile(file, 260, 260, 0.78);
      const avatarUrl = compressed.url;
      const updatedChan: ChatChannelItem = { ...activeGroup, avatar: avatarUrl };

      setTeamChannels(prev => {
        const next = prev.map(c => c.id === activeGroup.id ? updatedChan : c);
        try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(next)); } catch {}
        return next;
      });

      await saveChannelMetaToSupabase({
        companyId: currentEmployee?.companyId,
        channel: updatedChan,
        sender: {
          id: currentEmployee.id,
          name: currentEmployee.name,
          role: currentEmployee.role,
          avatar: currentEmployee.avatar,
        },
        isNew: false,
      });
    } catch (err) {
      console.error('Erro ao atualizar imagem do grupo:', err);
    } finally {
      if (activeGroupAvatarInputRef.current) activeGroupAvatarInputRef.current.value = '';
    }
  };

  const handleSaveEditMessage = async (msgId: string) => {
    const trimmed = editingMessageText.trim();
    if (!trimmed) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: trimmed } : m));
    setEditingMessageId(null);
    setEditingMessageText('');
    await updateChatMessageInSupabase(msgId, trimmed);
  };

  const handleDeleteOwnMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await deleteChatMessageFromSupabase(msgId);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() && !pendingAttachment) return;

    const rawText = inputMsg.trim();
    const attachmentToSend = pendingAttachment;
    const replyToSend = replyingToMessage;

    setInputMsg('');
    setPendingAttachment(null);
    setReplyingToMessage(null);
    setIsEmojiPickerOpen(false);

    // Feedback imediato na tela (Optimistic UI)
    const directRecipient = chatType === 'direct' ? (selectedDirectEmployee?.id || null) : null;
    const optimisticPayload =
      attachmentToSend || replyToSend
        ? JSON.stringify({
            ...(attachmentToSend ? attachmentToSend : {}),
            ...(replyToSend ? { replyTo: replyToSend } : {}),
          })
        : null;
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentEmployee.id,
      sender_name: currentEmployee.name,
      sender_role: currentEmployee.role,
      sender_avatar: currentEmployee.avatar || '',
      text: rawText,
      attachment: optimisticPayload,
      created_at: new Date().toISOString(),
      channel: currentChannel,
      recipient_id: directRecipient,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { error } = await sendChatMessageToSupabase({
        sender_id: currentEmployee.id,
        sender_name: currentEmployee.name,
        sender_role: currentEmployee.role,
        sender_avatar: currentEmployee.avatar || '',
        text: rawText,
        attachment: attachmentToSend,
        replyTo: replyToSend,
        channel: currentChannel,
        recipient_id: directRecipient,
      });

      if (error) {
        console.error('Erro ao enviar mensagem:', error.message);
        setErrorMessage(error.message);
      } else {
        setErrorMessage(null);
      }
    } catch (err: any) {
      console.error('Erro ao conectar ao Supabase:', err);
      setErrorMessage(err?.message || 'Erro de conexão com o Supabase');
    }
  };

  // Criação de Grupo / Canal de Equipe (Gestão): garante que apenas as pessoas marcadas + quem criou tenham acesso
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    const channelId = `grupo_${Date.now()}`;
    const baseMembers = selectedMemberIds.length > 0 ? selectedMemberIds : allEmployeesList.map(e => e.id);
    const membersList = Array.from(new Set([...baseMembers, currentEmployee.id]));
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
    try {
      localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated));
    } catch {}

    await saveChannelMetaToSupabase({
      companyId: currentEmployee?.companyId,
      channel: newChan,
      sender: {
        id: currentEmployee.id,
        name: currentEmployee.name,
        role: currentEmployee.role || 'GESTORA',
        avatar: currentEmployee.avatar || '',
      },
      isNew: true,
    });

    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupBadge('Equipe');
    setNewGroupAvatar('');
    setSelectedMemberIds([]);
    setIsCreatingGroup(false);
    setIsNewGroupModalOpen(false);

    setSelectedGroupId(newChan.id);
  };

  // Exclusão do canal de grupo
  const handleDeleteActiveGroup = async () => {
    const targetGroup = groupToDelete || activeGroup;
    if (!targetGroup) return;
    setIsDeleting(true);
    const groupId = targetGroup.id;
    const groupName = targetGroup.name;
    const scopedGroupId = getScopedChatChannel(currentEmployee?.companyId, groupId);

    try {
      await supabase.from('messages').delete().or(`channel.eq.${quotePostgrestValue(scopedGroupId)},channel.eq.${quotePostgrestValue(groupId)},recipient_id.eq.${quotePostgrestValue(`group_meta_id:${groupId}`)},recipient_id.like.${quotePostgrestValue(`%${groupId}%`)}`);
    } catch {}

    try {
      await supabase.from('chat_channels').delete().or(`id.eq.${quotePostgrestValue(scopedGroupId)},id.eq.${quotePostgrestValue(groupId)},name.eq.${quotePostgrestValue(groupName)}`);
    } catch {}

    try {
      await supabase.from('messages').insert([
        {
          channel: getScopedChatChannel(currentEmployee?.companyId, 'geral'),
          text: `🗑️ O grupo #${groupName} foi excluído por ${currentEmployee.name}.`,
          recipient_id: `group_deleted:${groupId}`,
          sender_id: currentEmployee.id,
          sender_name: currentEmployee.name,
          sender_role: currentEmployee.role,
          sender_avatar: currentEmployee.avatar || '',
        }
      ]);
    } catch {}

    setTeamChannels(prev => {
      const updated = prev.filter(c => c.id !== groupId);
      try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}
      return updated;
    });

    try {
      const deletedList = JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]');
      if (!deletedList.includes(groupId)) {
        deletedList.push(groupId);
        localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(deletedList));
      }
    } catch {}

    setIsDeleting(false);
    setIsConfirmDeleteOpen(false);
    setGroupToDelete(null);
    setIsMembersModalOpen(false);
    if (selectedGroupId === groupId) {
      setSelectedGroupId('');
    }
  };

  const quickSuggestions = [
    '📅 Alinhamento sobre a escala do fim de semana',
    '⚡ Aviso urgente de cobertura de plantão',
    '✅ Horários confirmados e ponto conferido',
    '❓ Solicitação de ajuste de turno',
  ];

  const chatWorkspaceContent = (
    <div className="approvals-page w-full animate-in fade-in duration-200 relative">
      {/* Main Chat Workspace Container (Versão Grande igual ao do Gestor) */}
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
                    {visibleGroupChannels.length}
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
                {visibleGroupChannels.length === 0 && (
                  <div className={`p-3 text-center text-[10px] italic rounded-xl border border-dashed ${
                    isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
                  }`}>
                    Nenhum grupo criado ainda. Clique em "+ Novo" para criar um grupo.
                  </div>
                )}
                {visibleGroupChannels.map((chan) => {
                  const isCurrent = chatType === 'group' && selectedGroupId === chan.id;
                  return (
                    <div
                      key={chan.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setChatType('group');
                        setSelectedGroupId(chan.id);
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
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
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
                                setGroupToDelete(chan);
                                setIsConfirmDeleteOpen(true);
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
              <div className="px-2 mb-2 flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Equipe Conectada (Privado)
                </span>
                {totalDirectUnread > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-black animate-pulse">
                    {totalDirectUnread}
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
                {directContacts.length === 0 ? (
                  <div className={`p-3 text-center text-[10px] italic rounded-xl border border-dashed ${
                    isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
                  }`}>
                    Nenhum outro integrante cadastrado nesta empresa ainda.
                  </div>
                ) : (
                  directContacts.map((emp) => {
                    const isSelected = chatType === 'direct' && selectedDirectEmployeeId === emp.id;
                    const unreadForEmp = unreadDirectByContact[emp.id] || 0;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setChatType('direct');
                          setSelectedDirectEmployeeId(emp.id);
                          setUnreadDirectByContact(prev => ({ ...prev, [emp.id]: 0 }));
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
                            <div className="flex items-center gap-1 shrink-0">
                              {unreadForEmp > 0 && (
                                <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-extrabold rounded-full">
                                  {unreadForEmp}
                                </span>
                              )}
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-[#F59242] text-black shrink-0">
                                  PRIVADO
                                </span>
                              )}
                            </div>
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
          </div>
        </aside>

        {/* Main Chat Conversation Column */}
        <div 
          className="flex flex-col min-w-0" 
          style={{ 
            background: isDark 
              ? 'radial-gradient(circle at 95% 5%, rgba(245, 146, 66, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 0%, rgba(100, 12, 30, 0.08) 0%, transparent 35%), #0e0f12' 
              : '#FCFAF5'
          }}
        >
          {/* Conversation Header */}
          <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 backdrop-blur-xs transition-all ${
            isDark ? 'border-[#282a33] bg-[#111216]/90' : 'border-[#E8DCCB] bg-[#FFFDF8]'
          }`}>
            <div className="flex items-center gap-3">
              {chatType === 'direct' ? (
                <div className="relative shrink-0">
                  <img 
                    src={selectedDirectEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={selectedDirectEmployee?.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#F59242]"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111216]" />
                </div>
              ) : activeGroup ? (
                <button
                  type="button"
                  onClick={() => activeGroupAvatarInputRef.current?.click()}
                  title="Clique para alterar a imagem do grupo"
                  className="group/av relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 overflow-hidden cursor-pointer"
                  style={!activeGroup.avatar ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                >
                  {activeGroup.avatar ? (
                    <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" />
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
                    {chatType === 'direct' 
                      ? `Chat Privado: ${selectedDirectEmployee?.name || 'Selecione um contato'}` 
                      : activeGroup ? `#${activeGroup.name}` : 'Nenhum grupo ativo'}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={activeGroupAvatarInputRef}
                accept="image/*"
                onChange={handleUpdateActiveGroupAvatar}
                className="hidden"
              />
              {chatType === 'group' && activeGroup && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMembersModalOpen(true)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isDark
                        ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Ver participantes deste canal"
                  >
                    <Users className="w-3.5 h-3.5 text-[#F59242]" />
                    <span className="hidden sm:inline">{groupMembersList.length} membros</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => activeGroupAvatarInputRef.current?.click()}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isDark
                        ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title={`Alterar imagem do canal #${activeGroup.name}`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#F59242]" />
                    <span className="hidden sm:inline">Foto do Grupo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupToDelete(activeGroup);
                      setIsConfirmDeleteOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Excluir canal #${activeGroup.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir Grupo</span>
                  </button>
                </>
              )}
              {!embedded && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    isDark ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Barra Mobile (< lg) para alternar entre Canais e Conversa Direta */}
          <div className={`lg:hidden px-3 py-2 border-b space-y-2 ${
            isDark ? 'border-[#282a33] bg-[#15161b]' : 'border-[#E8DCCB] bg-[#FFFDF8]'
          }`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChatType('group')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  chatType === 'group'
                    ? 'bg-gradient-to-r from-[#96183C] to-[#F89847] text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:bg-slate-200 bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Canais ({visibleGroupChannels.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setChatType('direct')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                  chatType === 'direct'
                    ? 'bg-gradient-to-r from-[#96183C] to-[#F89847] text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-600 hover:bg-slate-200 bg-slate-100'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Privado (1 a 1)</span>
                {totalDirectUnread > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-black animate-pulse">
                    {totalDirectUnread}
                  </span>
                )}
              </button>
            </div>

            {chatType === 'group' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {visibleGroupChannels.map((chan) => {
                  const isSelected = selectedGroupId === chan.id;
                  return (
                    <button
                      key={chan.id}
                      type="button"
                      onClick={() => setSelectedGroupId(chan.id)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#F59242] text-black border-[#F59242] font-extrabold shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {chan.avatar ? (
                        <img src={chan.avatar} alt={chan.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : (
                        <Hash className="w-3 h-3 opacity-70" />
                      )}
                      <span>{chan.name}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-dashed border-[#F59242]/50 text-[#F59242] bg-[#F59242]/5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {directContacts.map((emp) => {
                  const isSelected = selectedDirectEmployeeId === emp.id;
                  const unreadForEmp = unreadDirectByContact[emp.id] || 0;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setSelectedDirectEmployeeId(emp.id);
                        setUnreadDirectByContact(prev => ({ ...prev, [emp.id]: 0 }));
                      }}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-[#F59242] text-black border-[#F59242] font-extrabold shadow-xs'
                          : isDark
                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <img
                        src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                        alt={emp.name}
                        className="w-4 h-4 rounded-full object-cover shrink-0"
                      />
                      <span className="max-w-[110px] truncate">{emp.name}</span>
                      {unreadForEmp > 0 && (
                        <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-extrabold rounded-full">
                          {unreadForEmp}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-2 text-[11px] text-red-300 flex items-center gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Messages Feed */}
          <div
            ref={messagesContainerRef}
            className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[380px] max-h-[520px]"
          >
            <div className="flex items-center gap-3">
              <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Mensagens de Hoje
              </span>
              <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
            </div>

            {loading && messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Carregando mensagens em tempo real...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-8 h-8 text-slate-600 mb-2 opacity-40" />
                <p className="text-xs text-slate-400">Nenhuma mensagem neste canal ainda.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {chatType === 'direct'
                    ? `Envie uma mensagem direta para ${selectedDirectEmployee?.name || 'um contato'}.`
                    : activeGroup
                      ? `Envie a primeira mensagem no canal #${activeGroup.name}!`
                      : 'Clique em "+ Novo" na barra lateral para criar seu primeiro grupo com a equipe.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentEmployee.id;
                const isManagerRole = msg.sender_role?.toUpperCase().includes('GESTOR') || msg.sender_role?.toUpperCase().includes('GERENTE') || msg.sender_role?.toUpperCase().includes('RH');
                const isGroupAnnouncement = msg.text?.startsWith('🎉 Novo grupo criado');
                const isGroupDeletedMsg = msg.text?.startsWith('🗑️');
                const timeStr = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : 'Agora';

                if (isGroupAnnouncement || isGroupDeletedMsg || isSystemControlMessage(msg)) {
                  return null;
                }

                const parsed = parseChatMessage(msg.text, msg.attachment);
                const isEditingThis = editingMessageId === msg.id;

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
                                setReplyingToMessage({
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
                                    setEditingMessageId(msg.id);
                                    setEditingMessageText(parsed.text || '');
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
                                  onClick={() => handleDeleteOwnMessage(msg.id)}
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
                          border: '1px solid rgba(255, 255, 255, 0.12)'
                        } : {
                          background: isDark ? '#1b1d24' : '#ffffff',
                          color: isDark ? '#e2e8f0' : '#1e293b',
                          border: isDark ? '1px solid #282a33' : '1px solid #E8DCCB',
                          borderRadius: '4px 18px 18px 18px',
                          boxShadow: isDark ? '0 8px 20px rgba(0, 0, 0, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.05)'
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
                              value={editingMessageText}
                              onChange={(e) => setEditingMessageText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditMessage(msg.id);
                                } else if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                  setEditingMessageText('');
                                }
                              }}
                              autoFocus
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-black/30 text-white border border-white/30 outline-none"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingMessageText('');
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/25 hover:bg-black/40 text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditMessage(msg.id)}
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

                        {/* Anexo de Imagem Salvo no Banco de Dados */}
                        {parsed.attachment && parsed.attachment.type === 'image' && (
                          <div className="mt-2">
                            <div 
                              className="relative group/img rounded-xl overflow-hidden border border-black/15 dark:border-white/15 cursor-pointer max-w-[260px] shadow-sm bg-black/20"
                              onClick={() => setPreviewModalImage({ url: parsed.attachment!.url, name: parsed.attachment!.name })}
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
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className={`px-4 py-2 border-t flex items-center gap-2 overflow-x-auto scrollbar-none ${
            isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
          }`}>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#F59242]" /> Sugestões:
            </span>
            {quickSuggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputMsg(sug)}
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
          {replyingToMessage && (
            <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
              !isDark ? 'bg-slate-100 border-[#E8DCCB] text-slate-800' : 'bg-[#111216] border-[#282a33] text-slate-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0 border-l-2 border-[#F59242] pl-2.5">
                <Reply className="w-3.5 h-3.5 text-[#F59242] shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-[10px] text-[#F59242] truncate">
                    Respondendo a {replyingToMessage.sender_name}
                  </p>
                  <p className="text-[11px] opacity-80 truncate max-w-[420px]">
                    {replyingToMessage.text}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToMessage(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                title="Cancelar resposta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Banner de Preview do Anexo Pendente */}
          {pendingAttachment && (
            <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
              !isDark ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <img 
                  src={pendingAttachment.url} 
                  alt="Preview do anexo" 
                  className="w-9 h-9 rounded-lg object-cover border border-amber-500/30 shrink-0 shadow-xs" 
                />
                <div className="min-w-0">
                  <p className="font-bold truncate text-[11px] text-amber-400">{pendingAttachment.name}</p>
                  <p className="text-[9px] opacity-75">{pendingAttachment.size || 'Imagem pronta para envio'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
                title="Remover anexo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Popover de Emojis */}
          {isEmojiPickerOpen && (
            <div className={`px-4 py-2 border-t flex flex-wrap items-center gap-1.5 shrink-0 ${
              isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
            }`}>
              {CHAT_COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setInputMsg(prev => prev + emoji)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base hover:bg-black/10 dark:hover:bg-white/10 transition-transform hover:scale-115 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar com Botão de Anexo e Emoji */}
          <form
            onSubmit={handleSend}
            className={`p-3 sm:p-4 border-t flex items-center gap-2 ${
              isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
            }`}
          >
            {/* Input oculto para seleção de imagens */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAttaching}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                pendingAttachment
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Anexar imagem ou foto"
              aria-label="Anexar imagem ou foto"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(prev => !prev)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isEmojiPickerOpen
                  ? 'bg-[#F59242]/20 text-[#F59242] border border-[#F59242]/30'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Inserir emoji"
              aria-label="Inserir emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              disabled={chatType === 'group' && !activeGroup}
              placeholder={
                pendingAttachment
                  ? 'Adicionar legenda para a imagem (opcional)...'
                  : chatType === 'direct'
                    ? `Mensagem privada para ${selectedDirectEmployee?.name || 'Contato'}...`
                    : activeGroup
                      ? `Mensagem no canal #${activeGroup.name}...`
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
              disabled={(!inputMsg.trim() && !pendingAttachment) || (chatType === 'group' && !activeGroup)}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                boxShadow: '0 4px 16px rgba(100, 12, 30, 0.35)'
              }}
              title="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* ─── MODAL: VISUALIZAÇÃO AMPLIADA DA IMAGEM ─── */}
      {previewModalImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="relative max-w-full max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-2 text-white text-xs">
              <span className="font-semibold truncate max-w-[200px] sm:max-w-md">{previewModalImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={sanitizeSafeUrl(previewModalImage.url, { allowDataImage: true, allowBlob: true })}
                  download={previewModalImage.name}
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Baixar imagem"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={previewModalImage.url}
              alt={previewModalImage.name}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* ─── MODAL: VER INTEGRANTES DO GRUPO ─── */}
      {isMembersModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85%] ${
            isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
          }`}>
            {/* Header Integrantes */}
            <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}>
              <div className="flex items-center gap-2.5 text-white">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30 overflow-hidden">
                  {activeGroup.avatar ? (
                    <img src={activeGroup.avatar} alt={activeGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-4 h-4 text-[#faf0ac]" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs leading-tight">Integrantes do Canal</h4>
                  <p className="text-[10px] text-[#faf0ac]/90">#{activeGroup.name} • {groupMembersList.length} membros</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista de Membros do Canal */}
            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              <div className="pt-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                  Participantes ({groupMembersList.length})
                </p>
                <div className="space-y-1.5">
                  {groupMembersList.map((emp) => {
                    const isMe = emp.id === currentEmployee.id;
                    return (
                      <div
                        key={emp.id}
                        className={`p-2 rounded-xl border flex items-center justify-between transition-colors ${
                          isMe
                            ? (isLightTheme ? 'bg-slate-100 border-[#96183c]/30' : 'bg-white/10 border-white/20')
                            : (isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5')
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=96183c&color=fff&size=150`}
                            alt={emp.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate">{emp.name}</p>
                              {isMe && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-[#96183c] text-white">
                                  Você
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">{emp.role} • {emp.department}</p>
                          </div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0"></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer do Modal Integrantes */}
            <div className={`p-3 border-t flex items-center justify-between shrink-0 ${
              isLightTheme ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#12131A]'
            }`}>
              {activeGroup.id.startsWith('grupo_') ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMembersModalOpen(false);
                    setGroupToDelete(activeGroup);
                    setIsConfirmDeleteOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/30 transition-colors cursor-pointer border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Grupo</span>
                </button>
              ) : (
                <div></div>
              )}
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isLightTheme ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CRIAR NOVO GRUPO ─── */}
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

            <form onSubmit={handleCreateGroup} className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Foto / Ícone do Grupo */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={groupAvatarInputRef}
                  accept="image/*"
                  onChange={handleGroupAvatarSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => groupAvatarInputRef.current?.click()}
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
                      if (selectedMemberIds.length === allEmployeesList.length) {
                        setSelectedMemberIds([]);
                      } else {
                        setSelectedMemberIds(allEmployeesList.map(e => e.id));
                      }
                    }}
                    className="text-[10px] text-[#f89642] hover:underline cursor-pointer font-bold"
                  >
                    {selectedMemberIds.length === allEmployeesList.length ? 'Desmarcar todos' : 'Todos'}
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border rounded-xl p-2 border-white/10">
                  {allEmployeesList.map((emp) => {
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

      {/* ─── MODAL: CONFIRMAR EXCLUSÃO DO GRUPO ─── */}
      {isConfirmDeleteOpen && (groupToDelete || activeGroup) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 text-center transition-all ${
            !isDark ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-3 border border-rose-500/30 shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black leading-tight">
              Excluir Grupo #{(groupToDelete || activeGroup)?.name}?
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Esta ação removerá permanentemente o canal e todas as mensagens para todos os colaboradores. Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmDeleteOpen(false);
                  setGroupToDelete(null);
                }}
                disabled={isDeleting}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  !isDark ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 bg-white/10 hover:bg-white/15'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteActiveGroup}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return chatWorkspaceContent;
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 ${
      isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/75 backdrop-blur-md'
    } animate-in fade-in duration-200`}>
      <div className={`w-full max-w-6xl max-h-[92vh] overflow-y-auto manager-scope ${isDark ? 'dark' : 'light'}`}>
        {chatWorkspaceContent}
      </div>
    </div>
  );
};
