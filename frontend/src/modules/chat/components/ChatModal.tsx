import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  AlertCircle, 
  Lock, 
  Users, 
  Hash, 
  Shield, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  UserCheck, 
  AlertTriangle,
  Plus,
  Paperclip,
  Download,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { Employee } from '@/types';
import { supabase } from '@/shared/services/supabase';
import { INITIAL_EMPLOYEES } from '@/data/mockData';
import { 
  ChatAttachment, 
  compressImageFile, 
  parseChatMessage, 
  serializeChatMessage,
  sendChatMessageToSupabase,
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
}

export const DEFAULT_TEAM_CHANNELS: ChatChannelItem[] = [
  { id: 'geral', name: 'geral', desc: 'Comunicação aberta para toda a equipe', badge: '', unread: 0 },
  { id: 'escalas', name: 'escalas', desc: 'Dúvidas sobre horários e plantões de fim de semana', badge: '', unread: 0 },
  { id: 'gestao', name: 'gestao', desc: 'Alinhamento direto entre liderança e supervisão', badge: '', unread: 0 },
];

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  employees,
  isLightTheme = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Anexos do chat
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo: 'direct' (1-on-1 com a Gestora ou Colaborador) ou 'group' (canais da equipe)
  const [chatType, setChatType] = useState<'direct' | 'group'>('group');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('geral');

  // Modais secundários: Ver Integrantes, Confirmar Exclusão e Criar Novo Grupo
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);

  // Estados do formulário de criação de novo grupo
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupBadge, setNewGroupBadge] = useState('Equipe');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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

  const isDemo = !currentEmployee?.companyId;

  // Lista de colaboradores cadastrados na empresa
  const allEmployeesList = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    return isDemo ? INITIAL_EMPLOYEES : [];
  }, [employees, isDemo]);

  // Lista de contatos disponíveis para conversa direta (1 a 1):
  const directContacts = useMemo(() => {
    return allEmployeesList.filter(e => e.id !== currentEmployee?.id);
  }, [allEmployeesList, currentEmployee?.id]);

  // Seleção de colaborador/gestor para conversa direta
  const [selectedDirectEmployeeId, setSelectedDirectEmployeeId] = useState<string>('');

  useEffect(() => {
    if (directContacts.length > 0 && (!selectedDirectEmployeeId || !directContacts.some(e => e.id === selectedDirectEmployeeId))) {
      setSelectedDirectEmployeeId(directContacts[0].id);
    }
  }, [directContacts, selectedDirectEmployeeId]);

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
        return parsed.filter(c => !deletedIds.has(c.id)).map(c => ({
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
        setTeamChannels(parsed.filter(c => !deletedIds.has(c.id)).map(c => ({
          ...c,
          badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
        })));
      } else {
        setTeamChannels(DEFAULT_TEAM_CHANNELS);
      }
    } catch {
      setTeamChannels(DEFAULT_TEAM_CHANNELS);
    }
  }, [companyKey]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Filtra apenas os canais aos quais o colaborador pertence
  const visibleGroupChannels = useMemo(() => {
    return teamChannels.filter((c) => {
      if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return true;
      if (!c.members || c.members.length === 0) return true;
      return c.members.includes(currentEmployee.id) || isManager;
    });
  }, [teamChannels, currentEmployee.id, isManager]);

  // Canal atual ativo no banco (isolado por empresa/participantes)
  const currentChannel = useMemo(() => {
    if (chatType === 'direct') {
      if (!selectedDirectEmployee?.id) return `cmp_${companyKey}__direct_none`;
      return getScopedDirectChannel(currentEmployee?.companyId, currentEmployee?.id, selectedDirectEmployee.id);
    }
    return getScopedChatChannel(currentEmployee?.companyId, selectedGroupId);
  }, [chatType, selectedDirectEmployee?.id, selectedGroupId, currentEmployee?.companyId, currentEmployee?.id, companyKey]);

  const activeGroup = useMemo(() => {
    return visibleGroupChannels.find(c => c.id === selectedGroupId) || visibleGroupChannels[0] || {
      id: 'geral',
      name: 'geral',
      desc: 'Canal de comunicação da equipe',
      badge: 'Equipe'
    };
  }, [visibleGroupChannels, selectedGroupId]);

  // Lista de integrantes do grupo ativo
  const groupMembersList = useMemo(() => {
    if (!activeGroup.members || activeGroup.members.length === 0) {
      return allEmployeesList;
    }
    return allEmployeesList.filter(e => activeGroup.members?.includes(e.id));
  }, [activeGroup, allEmployeesList]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carrega e sincroniza os canais de grupo disponíveis
  useEffect(() => {
    if (!isOpen) return;

    const syncChannels = async () => {
      const deletedIds = new Set<string>();
      try {
        const savedDeleted = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
        if (savedDeleted) {
          JSON.parse(savedDeleted).forEach((id: string) => deletedIds.add(id));
        }
      } catch {}

      // 1. Tenta tabela chat_channels
      try {
        const { data, error } = await supabase.from('chat_channels').select('*');
        if (!error && data && data.length > 0) {
          const loaded: ChatChannelItem[] = data
            .filter((d: any) => !deletedIds.has(d.id))
            .map((d: any) => ({
              id: getDisplayChatChannel(d.id),
              name: d.name,
              desc: d.description || '',
              badge: d.badge || 'Equipe',
              unread: 0,
              members: d.members || undefined,
            }));

          setTeamChannels((prev) => {
            const map = new Map(prev.filter(p => !deletedIds.has(p.id)).map(p => [p.id, p]));
            loaded.forEach(item => map.set(item.id, item));
            const merged = Array.from(map.values());
            try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}

      // 2. Descobre canais criados gravados no histórico da tabela messages para esta empresa
      try {
        const groupPrefix = `cmp_${companyKey}__grupo_%`;
        const { data: groupMsgs } = await supabase
          .from('messages')
          .select('channel, recipient_id, text')
          .like('channel', groupPrefix);

        if (groupMsgs && groupMsgs.length > 0) {
          const foundMap = new Map<string, ChatChannelItem>();

          for (const msg of groupMsgs) {
            if (!msg.channel) continue;
            const rawId = getDisplayChatChannel(msg.channel);
            if (foundMap.has(rawId) || deletedIds.has(rawId)) continue;

            let name = rawId.replace('grupo_', '');
            let desc = 'Grupo de comunicação da equipe';
            let badge = 'Equipe';
            let members: string[] | undefined = undefined;

            if (msg.recipient_id && msg.recipient_id.startsWith('group_meta:')) {
              try {
                const meta = JSON.parse(msg.recipient_id.replace('group_meta:', ''));
                if (meta.name) name = meta.name;
                if (meta.desc) desc = meta.desc;
                if (meta.badge) badge = meta.badge;
                if (meta.members && Array.isArray(meta.members)) members = meta.members;
              } catch {}
            } else if (msg.text && msg.text.includes('#')) {
              const match = msg.text.match(/#([\w-]+)\s*-\s*(.*)/);
              if (match) {
                name = match[1];
                desc = match[2];
              }
            }

            foundMap.set(rawId, {
              id: rawId,
              name: name,
              desc: desc,
              badge: badge,
              unread: 0,
              members: members,
            });
          }

          if (foundMap.size > 0) {
            setTeamChannels((prev) => {
              const map = new Map(prev.filter(p => !deletedIds.has(p.id)).map(p => [p.id, p]));
              foundMap.forEach((val, key) => {
                if (!map.has(key)) map.set(key, val);
              });
              const merged = Array.from(map.values());
              try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        }
      } catch {}
    };

    syncChannels();
  }, [isOpen, companyKey]);

  // Carrega as mensagens do canal ativo e escuta novas em tempo real
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      if (chatType === 'direct' && !selectedDirectEmployee?.id) {
        setMessages([]);
        setLoading(false);
        return;
      }

      let query = supabase.from('messages').select('*');

      if (chatType === 'direct') {
        const pair = [currentEmployee.id, selectedDirectEmployee!.id].sort().join('_');
        query = query.or(`channel.eq.direct_${pair},channel.like.%direct_${pair}`);
      } else {
        query = query.eq('channel', currentChannel);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens do Supabase:', error);
        setErrorMessage(error.message);
      } else if (data) {
        setErrorMessage(null);
        setMessages((prev) => {
          const pendingTemp = prev.filter(
            (p) =>
              p.id.startsWith('temp-') &&
              !data.some((d: any) => d.text === p.text && d.sender_id === p.sender_id)
          );
          return [...(data as ChatMessage[]), ...pendingTemp];
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
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Se a mensagem for um aviso de exclusão de grupo
          if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_deleted:')) {
            const deletedId = newMsg.recipient_id.replace('group_deleted:', '');
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
              setSelectedGroupId('geral');
            }
            return;
          }

          // Se a nova mensagem for de um grupo recém-criado, sincroniza a lista de grupos
          const rawChannelId = newMsg.channel ? getDisplayChatChannel(newMsg.channel) : '';
          if (rawChannelId.startsWith('grupo_')) {
            setTeamChannels((prev) => {
              if (prev.some(p => p.id === rawChannelId)) return prev;
              let name = rawChannelId.replace('grupo_', '');
              let desc = 'Novo grupo criado pela gestão';
              let badge = 'Equipe';
              let members: string[] | undefined = undefined;

              if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_meta:')) {
                try {
                  const meta = JSON.parse(newMsg.recipient_id.replace('group_meta:', ''));
                  if (meta.name) name = meta.name;
                  if (meta.desc) desc = meta.desc;
                  if (meta.badge) badge = meta.badge;
                  if (meta.members && Array.isArray(meta.members)) members = meta.members;
                } catch {}
              }

              // Se o colaborador não for membro do grupo e não for gestor, não adiciona
              if (members && members.length > 0 && !members.includes(currentEmployee.id) && !isManager) {
                return prev;
              }

              const updated = [...prev, { id: rawChannelId, name, desc, badge, members, unread: 0 }];
              try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}
              return updated;
            });
          }

          const directPair = (chatType === 'direct' && selectedDirectEmployee?.id)
            ? [currentEmployee.id, selectedDirectEmployee.id].sort().join('_')
            : null;
          const isDirectMatch = Boolean(directPair && newMsg.channel && newMsg.channel.includes(`direct_${directPair}`));

          if (newMsg.channel === currentChannel || isDirectMatch) {
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
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentChannel, chatType, selectedDirectEmployee?.id, selectedGroupId, currentEmployee.id, isManager]);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() && !pendingAttachment) return;

    const rawText = inputMsg.trim();
    const attachmentToSend = pendingAttachment;

    setInputMsg('');
    setPendingAttachment(null);

    // Feedback imediato na tela (Optimistic UI)
    const directRecipient = chatType === 'direct' ? (selectedDirectEmployee?.id || null) : null;
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentEmployee.id,
      sender_name: currentEmployee.name,
      sender_role: currentEmployee.role,
      sender_avatar: currentEmployee.avatar || '',
      text: rawText,
      attachment: attachmentToSend ? JSON.stringify(attachmentToSend) : null,
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

  // Criação de Grupo / Canal de Equipe (Gestão)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    const channelId = `grupo_${Date.now()}`;
    const membersList = selectedMemberIds.length > 0 ? selectedMemberIds : allEmployeesList.map(e => e.id);
    const newChan: ChatChannelItem = {
      id: channelId,
      name: newGroupName.trim().toLowerCase().replace(/\s+/g, '-'),
      desc: newGroupDesc.trim() || 'Grupo criado pela gestão',
      badge: newGroupBadge.trim() || 'Equipe',
      unread: 0,
      members: membersList,
    };

    const updated = [...teamChannels, newChan];
    setTeamChannels(updated);
    try {
      localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated));
    } catch {}

    const scopedGroupId = getScopedChatChannel(currentEmployee?.companyId, newChan.id);

    try {
      await supabase.from('chat_channels').insert([
        {
          id: scopedGroupId,
          name: newChan.name,
          description: newChan.desc,
          badge: newChan.badge,
          created_by: currentEmployee.name,
          members: newChan.members,
        }
      ]);
    } catch {}

    try {
      const metaPayload = JSON.stringify({
        id: newChan.id,
        name: newChan.name,
        desc: newChan.desc,
        badge: newChan.badge,
        members: newChan.members,
      });

      await supabase.from('messages').insert([
        {
          sender_id: currentEmployee.id,
          sender_name: currentEmployee.name,
          sender_role: currentEmployee.role || 'GESTORA',
          sender_avatar: currentEmployee.avatar || '',
          text: `🎉 Novo grupo criado por ${currentEmployee.name}: #${newChan.name} - ${newChan.desc}`,
          channel: scopedGroupId,
          recipient_id: `group_meta:${metaPayload}`,
        }
      ]);
    } catch {}

    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupBadge('Equipe');
    setSelectedMemberIds([]);
    setIsCreatingGroup(false);
    setIsNewGroupModalOpen(false);

    setSelectedGroupId(newChan.id);
  };

  // Exclusão do canal de grupo
  const handleDeleteActiveGroup = async () => {
    setIsDeleting(true);
    const groupId = activeGroup.id;
    const groupName = activeGroup.name;
    const scopedGroupId = getScopedChatChannel(currentEmployee?.companyId, groupId);

    try {
      await supabase.from('messages').delete().or(`channel.eq.${scopedGroupId},channel.eq.${groupId}`);
    } catch {}

    try {
      await supabase.from('chat_channels').delete().or(`id.eq.${scopedGroupId},id.eq.${groupId}`);
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
    setIsMembersModalOpen(false);
    setSelectedGroupId('geral');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ${
      isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/75 backdrop-blur-md'
    } animate-in fade-in duration-200`}>
      <div className={`rounded-3xl shadow-2xl max-w-2xl w-full border overflow-hidden flex flex-col h-[700px] max-h-[92vh] relative transition-colors ${
        isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#13141B] border-white/10 text-slate-100'
      }`}>
        {/* Top Highlight Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]"></div>

        {/* Header */}
        <div className="px-4 py-3 text-white flex items-center justify-between shadow-xs shrink-0" style={{ background: 'linear-gradient(to right, #96183c, #f89642)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
              {chatType === 'direct' ? (
                <Lock className="w-4 h-4 text-[#faf0ac]" />
              ) : (
                <Users className="w-4 h-4 text-[#faf0ac]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm leading-tight truncate">
                  {chatType === 'direct' 
                    ? (isManager ? `Direto com ${selectedDirectEmployee?.name || 'Colaborador'}` : 'Conversa com Gestão') 
                    : `#${activeGroup.name}`}
                </h3>
                {chatType === 'group' && activeGroup.badge && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/20 text-[#faf0ac] shrink-0 border border-white/25">
                    {activeGroup.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#faf0ac]/90 truncate">
                {chatType === 'direct' 
                  ? (isManager ? `${selectedDirectEmployee?.role || 'Colaborador'} • Canal Privado 1-a-1` : 'Camila Duarte (Gestora) • Canal Privado') 
                  : activeGroup.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Botão Ver Integrantes */}
            {chatType === 'group' && (
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white/15 hover:bg-white/25 text-[#faf0ac] transition-all cursor-pointer border border-white/20"
                title="Ver participantes deste canal"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{groupMembersList.length + 1} membros</span>
              </button>
            )}

            {/* Botão Excluir Grupo */}
            {chatType === 'group' && isManager && (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-1.5 rounded-xl hover:bg-red-500/30 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Excluir este grupo da equipe"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Botão Fechar Modal */}
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Mode Selector: Privado vs Canais/Grupos */}
        <div className={`p-2 border-b flex items-center gap-2 shrink-0 ${
          isLightTheme ? 'bg-slate-100 border-slate-200' : 'bg-[#181922] border-white/10'
        }`}>
          <button
            type="button"
            onClick={() => setChatType('direct')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              chatType === 'direct'
                ? 'bg-gradient-to-r from-[#96183C] to-[#F89847] text-white shadow-xs'
                : (isLightTheme ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/5')
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isManager ? 'Conversa Direta (1 a 1)' : 'Privado com a Gestora'}</span>
          </button>

          <button
            type="button"
            onClick={() => setChatType('group')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              chatType === 'group'
                ? 'bg-gradient-to-r from-[#96183C] to-[#F89847] text-white shadow-xs'
                : (isLightTheme ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/5')
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Grupos da Equipe ({visibleGroupChannels.length})</span>
          </button>
        </div>

        {/* Seletor horizontal de Grupos/Canais com Botão + Novo Grupo */}
        {chatType === 'group' && (
          <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar transition-colors shrink-0 ${
            isLightTheme ? 'bg-white border-slate-200' : 'bg-[#12131A] border-white/5'
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 mr-1 ${
              isLightTheme ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Canais:
            </span>
            {visibleGroupChannels.map((chan) => {
              const isSelected = selectedGroupId === chan.id;
              return (
                <button
                  key={chan.id}
                  type="button"
                  onClick={() => setSelectedGroupId(chan.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                    isSelected
                      ? (isLightTheme
                          ? 'bg-[#96183c] text-white border-[#96183c] shadow-xs'
                          : 'bg-[#F59242] text-black border-[#F59242] font-extrabold shadow-xs')
                      : (isLightTheme
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white')
                  }`}
                >
                  <Hash className="w-3 h-3 opacity-70" />
                  <span>{chan.name}</span>
                  {chan.badge && (
                    <span className={`text-[9px] px-1 py-0.2 rounded font-normal ${
                      isSelected
                        ? (isLightTheme ? 'bg-white/20 text-white' : 'bg-black/20 text-black font-bold')
                        : (isLightTheme ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400')
                    }`}>
                      {chan.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Botão Novo Grupo (Apenas para Gestor) */}
            {isManager && (
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(true)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-dashed ${
                  isLightTheme 
                    ? 'border-[#96183c]/50 text-[#96183c] bg-[#96183c]/5 hover:bg-[#96183c]/15' 
                    : 'border-[#F59242]/50 text-[#F59242] bg-[#F59242]/5 hover:bg-[#F59242]/15'
                }`}
                title="Criar novo grupo ou canal de equipe"
              >
                <Plus className="w-3 h-3" />
                <span>Novo Grupo</span>
              </button>
            )}
          </div>
        )}

        {/* Seletor horizontal de Colaboradores para conversa direta (apenas Gestor) */}
        {chatType === 'direct' && isManager && (
          <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar transition-colors shrink-0 ${
            isLightTheme ? 'bg-white border-slate-200' : 'bg-[#12131A] border-white/5'
          }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider shrink-0 mr-1 ${
              isLightTheme ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {isRhUser ? 'Gestor de Setor:' : 'Contato:'}
            </span>
            {directContacts.map(emp => {
              const isSelected = selectedDirectEmployeeId === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedDirectEmployeeId(emp.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? (isLightTheme
                          ? 'bg-[#96183c] text-white border-[#96183c] shadow-xs'
                          : 'bg-[#F59242] text-black border-[#F59242] font-extrabold shadow-xs')
                      : (isLightTheme
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white')
                  }`}
                >
                  <img src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} alt={emp.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                  <span>{emp.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-2 text-[11px] text-red-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Área de Mensagens */}
        <div className={`flex-1 p-4 overflow-y-auto space-y-3 transition-colors ${
          isLightTheme ? 'bg-slate-50' : 'bg-[#0B0C10]'
        }`}>
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-xs text-slate-400">
              Carregando mensagens em tempo real...
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="w-8 h-8 text-slate-500 mb-2 opacity-40" />
              <p className="text-xs text-slate-400">Nenhuma mensagem ainda.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {chatType === 'direct'
                  ? 'Envie uma mensagem direta para a gestora Camila Duarte.'
                  : `Envie a primeira mensagem no canal #${activeGroup.name}!`}
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.sender_id === currentEmployee.id;
            const isManagerMsg = msg.sender_id === 'gestor-camila' || msg.sender_role?.toUpperCase().includes('GESTOR') || msg.sender_role?.toUpperCase().includes('GERENTE');
            const isGroupAnnouncement = msg.text.startsWith('🎉 Novo grupo criado');
            const isGroupDeletedMsg = msg.text.startsWith('🗑️');
            const timeFormatted = msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '';

            if (isGroupAnnouncement || isGroupDeletedMsg) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <div className={`px-4 py-2 rounded-2xl border text-xs max-w-[85%] text-center shadow-xs flex items-center gap-2 ${
                    isGroupDeletedMsg
                      ? (isLightTheme ? 'bg-red-50 border-red-200 text-red-900' : 'bg-red-500/10 border-red-500/30 text-red-200')
                      : (isLightTheme ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/30 text-amber-200')
                  }`}>
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-medium">{msg.text}</span>
                  </div>
                </div>
              );
            }

            const parsed = parseChatMessage(msg.text, msg.attachment);

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <img
                  src={msg.sender_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={msg.sender_name}
                  className={`w-7 h-7 rounded-full object-cover shrink-0 ring-1 ${
                    isManagerMsg ? 'ring-[#F59242]' : (isLightTheme ? 'ring-slate-300' : 'ring-white/20')
                  }`}
                />
                <div className={`max-w-[82%] rounded-2xl p-2.5 text-xs shadow-2xs ${
                  isMe
                    ? 'text-white rounded-tr-none'
                    : (isLightTheme
                        ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        : 'bg-[#1C1D26] text-slate-200 border border-white/10 rounded-tl-none')
                }`} style={isMe ? { background: 'linear-gradient(135deg, #96183c, #f89642)' } : {}}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-[10px] ${
                        isMe ? 'text-white' : (isLightTheme ? 'text-slate-900' : 'text-white')
                      }`}>
                        {msg.sender_name}
                      </span>
                      {isManagerMsg && (
                        <span className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                          isMe ? 'bg-white/20 text-white' : 'bg-[#96183c]/15 text-[#96183c] dark:bg-[#F59242]/20 dark:text-[#F59242]'
                        }`}>
                          Gestora
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-mono ${
                      isMe ? 'text-[#faf0ac]/80' : 'text-slate-400'
                    }`}>
                      {timeFormatted}
                    </span>
                  </div>

                  {/* Texto da Mensagem */}
                  {parsed.text && (
                    <p className="leading-relaxed break-words mb-1">{parsed.text}</p>
                  )}

                  {/* Anexo de Imagem Salvo no Banco de Dados */}
                  {parsed.attachment && parsed.attachment.type === 'image' && (
                    <div className="mt-1.5">
                      <div 
                        className="relative group/img rounded-xl overflow-hidden border border-black/10 dark:border-white/15 cursor-pointer max-w-[240px] shadow-sm bg-black/20"
                        onClick={() => setPreviewModalImage({ url: parsed.attachment!.url, name: parsed.attachment!.name })}
                        title="Clique para ampliar a imagem"
                      >
                        <img
                          src={parsed.attachment.url}
                          alt={parsed.attachment.name}
                          className="w-full max-h-48 object-cover group-hover/img:scale-102 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                          <span className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80">
                            <Eye className="w-3.5 h-3.5" />
                          </span>
                          <a
                            href={parsed.attachment.url}
                            download={parsed.attachment.name}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80"
                            title="Baixar imagem"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="px-2 py-0.5 bg-black/60 backdrop-blur-xs text-[9px] text-white/90 flex items-center justify-between">
                          <span className="truncate max-w-[140px]">{parsed.attachment.name}</span>
                          {parsed.attachment.size && <span className="opacity-80">{parsed.attachment.size}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Banner de Preview do Anexo Pendente */}
        {pendingAttachment && (
          <div className={`px-3 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
            isLightTheme ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
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

        {/* Input Bar com Botão de Anexo */}
        <form onSubmit={handleSend} className={`p-3 border-t flex items-center gap-2 transition-colors shrink-0 ${
          isLightTheme ? 'bg-white border-slate-200' : 'bg-[#13141B] border-white/10'
        }`}>
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
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              pendingAttachment
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isLightTheme
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Anexar imagem ou foto"
            aria-label="Anexar imagem ou foto"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder={
              pendingAttachment
                ? 'Adicionar legenda para a imagem (opcional)...'
                : chatType === 'direct'
                  ? (isManager ? `Mensagem direta para ${selectedDirectEmployee?.name || 'Colaborador'}...` : 'Mensagem privada para a gestora Camila...')
                  : `Mensagem no canal #${activeGroup.name}...`
            }
            className={`flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-colors border ${
              isLightTheme
                ? 'bg-slate-100 border-slate-300 text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#96183c]'
                : 'bg-[#1F202B] border-white/10 text-white placeholder-slate-400 focus:ring-1 focus:ring-[#f89642]'
            }`}
          />

          <button
            type="submit"
            disabled={!inputMsg.trim() && !pendingAttachment}
            className="p-2.5 text-white hover:brightness-110 rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:hover:brightness-100 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* ─── MODAL: VISUALIZAÇÃO AMPLIADA DA IMAGEM ─── */}
        {previewModalImage && (
          <div 
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewModalImage(null)}
          >
            <div className="relative max-w-full max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-full flex items-center justify-between pb-2 text-white text-xs">
                <span className="font-semibold truncate max-w-[200px] sm:max-w-md">{previewModalImage.name}</span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewModalImage.url}
                    download={previewModalImage.name}
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
        {isMembersModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85%] ${
              isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
            }`}>
              {/* Header Integrantes */}
              <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}>
                <div className="flex items-center gap-2.5 text-white">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
                    <Users className="w-4 h-4 text-[#faf0ac]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs leading-tight">Integrantes do Canal</h4>
                    <p className="text-[10px] text-[#faf0ac]/90">#{activeGroup.name} • {groupMembersList.length + 1} membros</p>
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

              {/* Lista com Gestora e Colaboradores */}
              <div className="p-3 overflow-y-auto space-y-2 flex-1">
                {/* Gestora */}
                <div className={`p-2.5 rounded-2xl border flex items-center justify-between ${
                  isLightTheme ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80"
                      alt="Camila Duarte"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-[#F59242]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black truncate">Camila Duarte</p>
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-[#F59242] text-black">
                          Gestora
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">Criadora do canal • Gestão</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0"></span>
                </div>

                {/* Colaboradores Membros */}
                <div className="pt-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                    Colaboradores ({groupMembersList.length})
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
                              src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
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
                {activeGroup.id.startsWith('grupo_') && isManager ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMembersModalOpen(false);
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

        {/* ─── MODAL: CRIAR NOVO GRUPO (GESTÃO) ─── */}
        {isNewGroupModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90%] ${
              isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
            }`}>
              <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}>
                <div className="flex items-center gap-2 text-white">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
                    <Hash className="w-4 h-4 text-[#faf0ac]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs leading-tight">Novo Grupo de Equipe</h4>
                    <p className="text-[10px] text-[#faf0ac]/90">Crie um canal focado para a operação</p>
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
                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-80">Nome do Grupo (#canal)</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="ex: noturno, plantao-uti, vendas"
                    required
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLightTheme ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-80">Descrição do Canal</label>
                  <input
                    type="text"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="ex: Plantonistas do final de semana"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      isLightTheme ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 opacity-80">Tag / Badge</label>
                  <select
                    value={newGroupBadge}
                    onChange={(e) => setNewGroupBadge(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer ${
                      isLightTheme ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-[#1C1D26] border-white/10 text-white'
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
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border rounded-xl p-2 border-white/5">
                    {allEmployeesList.map((emp) => {
                      const isChecked = selectedMemberIds.includes(emp.id);
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                            isChecked ? (isLightTheme ? 'bg-slate-200' : 'bg-white/10') : (isLightTheme ? 'hover:bg-slate-100' : 'hover:bg-white/5')
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
                      isLightTheme ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 bg-white/10 hover:bg-white/15'
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
        {isConfirmDeleteOpen && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 text-center transition-all ${
              isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
            }`}>
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-3 border border-red-500/30 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black leading-tight">Excluir Grupo #{activeGroup.name}?</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Esta ação removerá permanentemente o canal e todas as mensagens para todos os colaboradores. Esta ação não pode ser desfeita.
              </p>

              <div className="flex items-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  disabled={isDeleting}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isLightTheme ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 bg-white/10 hover:bg-white/15'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteActiveGroup}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
