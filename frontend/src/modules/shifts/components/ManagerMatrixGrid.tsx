import React, { useEffect, useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileText, 
  Zap, 
  Bell, 
  Download, 
  Plus, 
  Video, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckSquare,
  CalendarDays,
  Send,
  UserCheck,
  Building2,
  Clock,
  ArrowRightLeft,
  ExternalLink,
  Trash2,
  Calendar,
  Tag,
  Filter,
  X,
  Paperclip,
  Users,
  User,
  Check,
  Edit2,
  Layers,
  Eye,
  Maximize2,
  Lock,
  Hash
} from 'lucide-react';
import { Employee, Shift, TimeOffRequest } from '../types';
import { supabase } from '@/shared/services/supabase';
import { DEFAULT_TEAM_CHANNELS, ChatChannelItem, ChatMessage } from '@/modules/chat/components/ChatModal';
import { 
  ChatAttachment, 
  compressImageFile, 
  parseChatMessage, 
  serializeChatMessage,
  sendChatMessageToSupabase
} from '@/shared/utils/chatUtils';

interface ManagerMatrixGridProps {
  employees: Employee[];
  shifts: Shift[];
  pendingRequestsCount: number;
  onOpenCreateShift: (dateStr?: string, employeeId?: string) => void;
  onOpenEditShift: (shift: Shift) => void;
  onOpenRequests: () => void;
  onOpenPjModal: () => void;
  onExportCsv: () => void;
  onAddEmployee: () => void;
  onSwitchToEmployee?: () => void;
  onOpenChat?: () => void;
  onOpenNotifications?: () => void;
  onNavigateToOrbit?: () => void;
  activeTab?: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat';
  theme?: 'light' | 'dark';
}

export const ManagerMatrixGrid: React.FC<ManagerMatrixGridProps> = ({
  employees,
  shifts,
  pendingRequestsCount,
  onOpenCreateShift,
  onOpenEditShift,
  onOpenRequests,
  onOpenPjModal,
  onExportCsv,
  onAddEmployee,
  onSwitchToEmployee,
  onOpenChat,
  onOpenNotifications,
  onNavigateToOrbit,
  activeTab: sidebarTab,
  theme = 'dark',
}) => {
  // Active top tab state: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat'
  const [internalActiveTab, setInternalActiveTab] = useState<'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat'>(sidebarTab || 'aprovacoes');
  const activeTab = sidebarTab || internalActiveTab;
  const setActiveTab = setInternalActiveTab;
  const isDark = theme !== 'light';

  useEffect(() => {
    if (sidebarTab) setInternalActiveTab(sidebarTab);
  }, [sidebarTab]);
  
  // Tab 1 (Escala) States
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(27);
  const [isDraftPublished, setIsDraftPublished] = useState<boolean>(false);

  // Tab 2 (Aprovações & Faltas) - Identidade Visual LP & Tabela de Ocorrências
  const [approvalsFilterTab, setApprovalsFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approvalsSearch, setApprovalsSearch] = useState('');
  const [approvalsDept, setApprovalsDept] = useState('all');
  const [isNewOccurrenceModalOpen, setIsNewOccurrenceModalOpen] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [selectedDetailOccurrence, setSelectedDetailOccurrence] = useState<{
    id: string;
    employeeId?: string;
    employeeName: string;
    employeeRole: string;
    employeeDept: string;
    employeeAvatar: string;
    type: string;
    reason: string;
    date: string;
    documentName: string;
    status: 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente';
    actionText?: string;
    feedback: string;
  } | null>(null);

  const toggleExpandReason = (id: string) => {
    setExpandedReasons(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  const [newOccurrenceForm, setNewOccurrenceForm] = useState({
    employeeId: 'emp-1',
    type: 'Atestado Médico',
    date: new Date().toLocaleDateString('pt-BR'),
    reason: '',
    documentName: 'atestado.pdf',
    status: 'Pendente' as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
    feedback: '',
  });

  const [approvalsData, setApprovalsData] = useState<Array<{
    id: string;
    employeeId?: string;
    employeeName: string;
    employeeRole: string;
    employeeDept: string;
    employeeAvatar: string;
    type: string;
    reason: string;
    date: string;
    documentName: string;
    status: 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente';
    actionText?: string;
    feedback: string;
  }>>([
    {
      id: 'ap-1',
      employeeId: 'emp-1',
      employeeName: 'Lucas Silva',
      employeeRole: 'Analista de Atendimento',
      employeeDept: 'Atendimento',
      employeeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: 'Atestado Médico',
      reason: 'Consulta odontológica e repouso (CID K01)',
      date: '16/09/2026',
      documentName: 'atestado.pdf',
      status: 'Aprovado',
      actionText: 'Homologado agora',
      feedback: 'Atestado validado e abonado integralmente.',
    },
    {
      id: 'ap-2',
      employeeId: 'emp-2',
      employeeName: 'Beatriz Santos',
      employeeRole: 'Especialista de Suporte',
      employeeDept: 'Suporte Técnico',
      employeeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      type: 'Troca de Turno',
      reason: 'Solicitou troca com Thiago Oliveira',
      date: '18/09/2026',
      documentName: 'Não se aplica',
      status: 'Recusado / Falta',
      actionText: 'Recusado agora',
      feedback: 'Incompatível com o limite de descanso entre jornadas.',
    },
    {
      id: 'ap-3',
      employeeId: 'emp-3',
      employeeName: 'Rafael Mendes',
      employeeRole: 'Operador de Escala',
      employeeDept: 'Operações',
      employeeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      type: 'Folga Compensatória',
      reason: 'Banco de horas acumulado no plantão',
      date: '14/09/2026',
      documentName: 'Acordo banco',
      status: 'Aprovado',
      actionText: 'Homologado',
      feedback: 'Compensação aprovada conforme saldo positivo em banco de horas.',
    },
    {
      id: 'ap-4',
      employeeId: 'emp-4',
      employeeName: 'Mariana Costa',
      employeeRole: 'Consultora de Vendas',
      employeeDept: 'Comercial',
      employeeAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      type: 'Falta Injustificada',
      reason: 'Ausência não comunicada no turno matutino',
      date: '11/09/2026',
      documentName: 'Sem anexo',
      status: 'Falta Lançada',
      actionText: 'Registrada em folha',
      feedback: 'Ausência sem aviso prévio. Desconto de DSR lançado no espelho.',
    },
    {
      id: 'ap-5',
      employeeId: 'emp-5',
      employeeName: 'Thiago Oliveira',
      employeeRole: 'Desenvolvedor Frontend',
      employeeDept: 'Tecnologia',
      employeeAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      type: 'Atestado Médico',
      reason: 'Declaração de comparecimento vacinação',
      date: '09/09/2026',
      documentName: 'declaracao.pdf',
      status: 'Aprovado',
      actionText: 'Abonado pelo RH',
      feedback: 'Declaração aceita e horas abonadas no fechamento.',
    },
    {
      id: 'ap-6',
      employeeId: 'emp-6',
      employeeName: 'Juliana Lima',
      employeeRole: 'Supervisora de Operações',
      employeeDept: 'Operações',
      employeeAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      type: 'Troca de Turno',
      reason: 'Troca de plantão de domingo com Rafael Mendes por curso',
      date: '20/09/2026',
      documentName: 'Não se aplica',
      status: 'Pendente',
      actionText: 'Aguardando decisão',
      feedback: '',
    },
  ]);

  const handleApproveOccurrence = (id: string) => {
    setApprovalsData(prev => prev.map(item => item.id === id ? { ...item, status: 'Aprovado', actionText: 'Homologado agora' } : item));
  };

  const handleRejectOccurrence = (id: string) => {
    setApprovalsData(prev => prev.map(item => item.id === id ? { ...item, status: 'Recusado / Falta', actionText: 'Recusado agora' } : item));
  };

  const handleUpdateFeedback = (id: string, feedback: string) => {
    setApprovalsData(prev => prev.map(item => item.id === id ? { ...item, feedback } : item));
  };

  const handleSaveNewOccurrence = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newOccurrenceForm.employeeId) || employees[0];
    const newItem = {
      id: `ap-${Date.now()}`,
      employeeId: emp?.id,
      employeeName: emp?.name || 'Colaborador',
      employeeRole: emp?.role || 'Colaborador',
      employeeDept: emp?.department || 'Geral',
      employeeAvatar: emp?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: newOccurrenceForm.type,
      reason: newOccurrenceForm.reason || 'Ocorrência registrada manualmente pelo gestor',
      date: newOccurrenceForm.date,
      documentName: newOccurrenceForm.documentName || 'Não se aplica',
      status: newOccurrenceForm.status,
      actionText: newOccurrenceForm.status === 'Aprovado' ? 'Homologado' : newOccurrenceForm.status === 'Pendente' ? 'Aguardando decisão' : 'Registrado em folha',
      feedback: newOccurrenceForm.feedback,
    };
    setApprovalsData(prev => [newItem, ...prev]);
    setIsNewOccurrenceModalOpen(false);
    setNewOccurrenceForm({
      employeeId: 'emp-1',
      type: 'Atestado Médico',
      date: new Date().toLocaleDateString('pt-BR'),
      reason: '',
      documentName: 'atestado.pdf',
      status: 'Pendente',
      feedback: '',
    });
  };

  // Tab 3 (Relatórios) States
  const [relatorioSearch, setRelatorioSearch] = useState('');
  const [relatorioStatus, setRelatorioStatus] = useState('all');
  const [relatorioDept, setRelatorioDept] = useState('all');

  // Tab 4 (Tarefas) State - Orbit Visual Identity
  const allAssignablePeople = useMemo(() => {
    const list = [...employees];
    const hasManager = list.some(e => e.name.toLowerCase().includes('camila'));
    if (!hasManager) {
      list.unshift({
        id: 'mgr-1',
        name: 'Camila Duarte',
        role: 'Gerente Geral',
        department: 'Gestão & Operações',
        avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        email: 'camila.duarte@employer.com.br',
        phone: '(11) 99999-0000',
        standardHoursPerWeek: 40,
        contractType: 'CLT',
      });
    }
    return list;
  }, [employees]);

  interface ReminderItem {
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

  const [reminders, setReminders] = useState<ReminderItem[]>([
    {
      id: 'rem-1',
      type: 'reuniao',
      tag: 'Metas Corporativas',
      title: 'Alinhamento Semanal de Metas Q3',
      description: 'Revisão dos indicadores de NPS e tempo de resposta da equipe.',
      date: '2026-08-28',
      time: '14:00',
      link: 'https://meet.google.com/abc-defg-hij',
      assigneeName: 'Camila Duarte, Lucas Silva, Beatriz Santos',
      assignedEmployeeIds: ['mgr-1', 'emp-1', 'emp-2'],
      completed: false,
    },
    {
      id: 'rem-2',
      type: 'atividade',
      tag: 'Gestão de Escalas',
      title: 'Publicar Escala de Setembro',
      description: 'Validar solicitações de folga e atestados antes do fechamento do mês.',
      date: '2026-08-29',
      time: '16:30',
      assigneeName: 'Camila Duarte, Rafael Mendes',
      assignedEmployeeIds: ['mgr-1', 'emp-3'],
      completed: false,
    },
    {
      id: 'rem-3',
      type: 'plantao',
      tag: 'Operacional',
      title: 'Supervisão de Plantão de Fim de Semana',
      description: 'Garantir escala de contingência e cobertura de suporte aos chamados críticos.',
      date: '2026-08-30',
      time: '08:00',
      assigneeName: 'Rafael Mendes, Juliana Lima',
      assignedEmployeeIds: ['emp-3', 'emp-6'],
      completed: true,
    },
    {
      id: 'rem-4',
      type: 'treinamento',
      tag: 'Onboarding & Treinamento',
      title: 'Treinamento de Novos Analistas CLT',
      description: 'Apresentação das políticas de pontualidade, intervalos e rotina de registro.',
      date: '2026-09-01',
      time: '10:00',
      link: 'https://meet.google.com/tech-treinamento',
      assigneeName: 'Lucas Silva, Mariana Costa',
      assignedEmployeeIds: ['emp-1', 'emp-4'],
      completed: false,
    }
  ]);

  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderFilterType, setReminderFilterType] = useState<string>('all');
  const [reminderCollaboratorFilter, setReminderCollaboratorFilter] = useState<string>('all');
  const [isNewReminderModalOpen, setIsNewReminderModalOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [collaboratorSearchInModal, setCollaboratorSearchInModal] = useState('');
  const [newReminderData, setNewReminderData] = useState<{
    title: string;
    description: string;
    type: 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
    tag: string;
    date: string;
    time: string;
    link: string;
    assignedEmployeeIds: string[];
  }>({
    title: '',
    description: '',
    type: 'atividade',
    tag: 'Geral',
    date: '2026-09-02',
    time: '09:00',
    link: '',
    assignedEmployeeIds: [],
  });

  const handleOpenNewReminderModal = () => {
    setEditingReminderId(null);
    setNewReminderData({
      title: '',
      description: '',
      type: 'atividade',
      tag: 'Geral',
      date: '2026-09-02',
      time: '09:00',
      link: '',
      assignedEmployeeIds: [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  const handleOpenEditReminderModal = (rem: ReminderItem) => {
    setEditingReminderId(rem.id);
    setNewReminderData({
      title: rem.title,
      description: rem.description,
      type: rem.type,
      tag: rem.tag,
      date: rem.date,
      time: rem.time,
      link: rem.link || '',
      assignedEmployeeIds: rem.assignedEmployeeIds ? [...rem.assignedEmployeeIds] : [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  // Tab 5 (Chat) State - Realtime Supabase
  const [activeChatMode, setActiveChatMode] = useState<'channel' | 'direct'>('direct');
  const [activeChatChannel, setActiveChatChannel] = useState<string>('geral');
  const [selectedDirectEmployeeId, setSelectedDirectEmployeeId] = useState<string>(() => employees[0]?.id || 'emp-1');
  const [newChatInput, setNewChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [teamChannels, setTeamChannels] = useState<ChatChannelItem[]>(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem('pontuall_deleted_channels') || '[]'));
      const saved = localStorage.getItem('pontuall_team_channels');
      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        return parsed.filter(c => !deletedIds.has(c.id)).map(c => ({
          ...c,
          badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
        }));
      }
      return DEFAULT_TEAM_CHANNELS.filter(c => !deletedIds.has(c.id));
    } catch {}
    return DEFAULT_TEAM_CHANNELS;
  });

  // Novo Grupo Modal
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupBadge, setNewGroupBadge] = useState('Equipe');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Confirmação de Exclusão de Grupo
  const [groupToDelete, setGroupToDelete] = useState<ChatChannelItem | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Anexos de imagem no chat do gestor
  const [pendingManagerAttachment, setPendingManagerAttachment] = useState<ChatAttachment | null>(null);
  const [isAttachingManager, setIsAttachingManager] = useState(false);
  const [managerPreviewModalImage, setManagerPreviewModalImage] = useState<{ url: string; name: string } | null>(null);
  const managerFileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const chatMessagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // Canal ativo no banco
  const currentChatChannel = useMemo(() => {
    return activeChatMode === 'direct' ? `direct_${selectedDirectEmployeeId}` : activeChatChannel;
  }, [activeChatMode, selectedDirectEmployeeId, activeChatChannel]);

  const selectedDirectEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedDirectEmployeeId) || employees[0];
  }, [employees, selectedDirectEmployeeId]);

  const activeChannelInfo = useMemo(() => {
    return teamChannels.find(c => c.id === activeChatChannel) || teamChannels[0] || {
      id: 'geral',
      name: 'geral',
      desc: 'Comunicação aberta para toda a equipe',
      badge: ''
    };
  }, [teamChannels, activeChatChannel]);

  // Carrega e sincroniza canais do Supabase
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const fetchChannels = async () => {
      try {
        const deletedIds = new Set<string>();
        try {
          const savedDel = localStorage.getItem('pontuall_deleted_channels');
          if (savedDel) {
            JSON.parse(savedDel).forEach((id: string) => deletedIds.add(id));
          }
        } catch {}

        const { data, error } = await supabase.from('chat_channels').select('*');
        if (!error && data && data.length > 0) {
          const loaded: ChatChannelItem[] = data
            .filter((d: any) => !deletedIds.has(d.id))
            .map((d: any) => ({
              id: d.id,
              name: d.name,
              desc: d.description || '',
              badge: d.badge || 'Equipe',
              unread: 0,
              members: d.members || undefined,
            }));
          setTeamChannels(prev => {
            const map = new Map(prev.filter(p => !deletedIds.has(p.id)).map(p => [p.id, p]));
            loaded.forEach(item => map.set(item.id, item));
            const merged = Array.from(map.values());
            try { localStorage.setItem('pontuall_team_channels', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}
    };
    fetchChannels();
  }, [activeTab]);

  // Carrega mensagens e assina WebSocket em tempo real para o chat do gestor
  useEffect(() => {
    if (activeTab !== 'chat') return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel', currentChatChannel)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setChatMessages(prev => {
          const pendingTemp = prev.filter(
            p => p.id.startsWith('temp-') && !data.some((d: any) => d.text === p.text && d.sender_id === p.sender_id)
          );
          return [...(data as ChatMessage[]), ...pendingTemp];
        });
      }
      setChatLoading(false);
    };

    setChatLoading(true);
    setChatMessages([]);
    fetchMessages();

    const interval = setInterval(fetchMessages, 3000);

    const realtimeChannel = supabase
      .channel(`manager_grid_chat_${currentChatChannel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.channel === currentChatChannel) {
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
  }, [activeTab, currentChatChannel]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  // Período de datas de exemplo para a matriz
  const baseDate = new Date(2026, 7, 31); // 31 de Agosto de 2026
  baseDate.setDate(baseDate.getDate() + currentWeekOffset * 7);

  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayNum}`;

      days.push({
        date: d,
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
      });
    }
    return days;
  }, [baseDate]);

  // Departamentos únicos
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtrar colaboradores por busca e departamento
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (selectedDepartment !== 'all' && emp.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q);
      }
      return true;
    });
  }, [employees, selectedDepartment, searchQuery]);

  // Mapeamento de turnos por colaborador e data
  const shiftsMap = useMemo(() => {
    const map: Record<string, Record<string, Shift[]>> = {};
    shifts.forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = {};
      if (!map[s.employeeId][s.date]) map[s.employeeId][s.date] = [];
      map[s.employeeId][s.date].push(s);
    });
    return map;
  }, [shifts]);

  const handlePublishDrafts = () => {
    setIsDraftPublished(true);
    setDraftCount(0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim() && !pendingManagerAttachment) return;

    const rawText = newChatInput.trim();
    const attachmentToSend = pendingManagerAttachment;

    setNewChatInput('');
    setPendingManagerAttachment(null);

    const recipientId = activeChatMode === 'direct' ? selectedDirectEmployeeId : null;

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: 'gestor-camila',
      sender_name: 'Camila Duarte',
      sender_role: 'GESTORA',
      sender_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      text: rawText,
      attachment: attachmentToSend ? JSON.stringify(attachmentToSend) : null,
      created_at: new Date().toISOString(),
      channel: currentChatChannel,
      recipient_id: recipientId,
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      await sendChatMessageToSupabase({
        sender_id: 'gestor-camila',
        sender_name: 'Camila Duarte',
        sender_role: 'GESTORA',
        sender_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        text: rawText,
        attachment: attachmentToSend,
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
    const membersList = selectedMemberIds.length > 0 ? selectedMemberIds : employees.map(e => e.id);
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
    try { localStorage.setItem('pontuall_team_channels', JSON.stringify(updated)); } catch {}

    try {
      await supabase.from('chat_channels').insert([
        {
          id: newChan.id,
          name: newChan.name,
          description: newChan.desc,
          badge: newChan.badge,
          created_by: 'gestor-camila',
          members: newChan.members,
        }
      ]);
    } catch {}

    try {
      await supabase.from('messages').insert([
        {
          channel: 'geral',
          text: `🎉 Novo grupo criado pela gestão: #${newChan.name} - ${newChan.desc}`,
          recipient_id: `group_meta:${JSON.stringify(newChan)}`,
          sender_id: 'gestor-camila',
          sender_name: 'Camila Duarte',
          sender_role: 'GESTORA',
          sender_avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
        }
      ]);
    } catch {}

    setIsCreatingGroup(false);
    setIsNewGroupModalOpen(false);
    setNewGroupName('');
    setNewGroupDesc('');
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

    try {
      await supabase.from('messages').delete().eq('channel', groupId);
    } catch {}

    try {
      await supabase.from('chat_channels').delete().eq('id', groupId);
    } catch {}

    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem('pontuall_deleted_channels') || '[]');
      if (!deletedList.includes(groupId)) {
        deletedList.push(groupId);
        localStorage.setItem('pontuall_deleted_channels', JSON.stringify(deletedList));
      }
    } catch {}

    const remaining = teamChannels.filter(c => c.id !== groupId);
    setTeamChannels(remaining);
    try {
      localStorage.setItem('pontuall_team_channels', JSON.stringify(remaining));
    } catch {}

    if (activeChatChannel === groupId) {
      if (remaining.length > 0) {
        setActiveChatChannel(remaining[0].id);
      } else {
        setActiveChatMode('direct');
      }
    }

    setIsDeletingGroup(false);
    setGroupToDelete(null);
  };

  const isOrbitStyledTab = activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios' || activeTab === 'chat';

  return (
    <div className={`w-full font-sans space-y-4 select-none manager-scope ${theme} ${
      isOrbitStyledTab
        ? 'bg-transparent text-slate-100 p-0 border-0 shadow-none'
        : 'bg-[#f8fafc] text-slate-900 rounded-3xl p-3 sm:p-5 shadow-2xl border border-slate-200'
    }`}>
      
      {/* 1. STICKY TOP HEADER CARD (Painel de Gestão de Escalas GESTOR + Abas Superiores) - Oculto quando abas Orbit pois já possuem headers nativos Orbit */}
      {!isOrbitStyledTab && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Título & Badge GESTOR */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Painel de Gestão de Escalas
                </h1>
                <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
                  GESTOR
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Organize turnos, aprove folgas e publique escalas corporativas
              </p>
            </div>
          </div>

          {/* ABAS SUPERIORES DO GESTOR (Exatamente como nas imagens enviadas) */}
          <div className="hidden" aria-hidden="true">
            {/* Tab 1: Grade de Escalas */}
            <button
              onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : setActiveTab('escala')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'escala'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📅 Grade de Escalas</span>
            </button>

            {/* Tab 2: Aprovações & Faltas */}
            <button
              onClick={() => setActiveTab('aprovacoes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 relative ${
                activeTab === 'aprovacoes'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Aprovações & Faltas</span>
              <span className="w-4 h-4 bg-purple-600 text-white rounded-full text-[9px] font-mono flex items-center justify-center font-bold">
                {pendingRequestsCount || 4}
              </span>
            </button>

            {/* Tab 3: Relatório de Presenças */}
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'relatorios'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Relatório de Presenças</span>
            </button>

            {/* Tab 4: Lembretes & Tarefas */}
            <button
              onClick={() => setActiveTab('tarefas')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'tarefas'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Lembretes & Tarefas</span>
            </button>

            {/* Tab 5: Chat Equipe */}
            <button
              onClick={() => (onOpenChat ? onOpenChat() : setActiveTab('chat'))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Chat Equipe</span>
            </button>
          </div>

          {/* User Profile & Publicar Button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePublishDrafts}
              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1 font-mono"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
              <span>Publicar ({draftCount} rascunhos)</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
                alt="Camila Duarte"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-600"
              />
              <div className="hidden lg:block text-left text-[11px] leading-tight">
                <span className="block font-black text-slate-900">Camila Duarte</span>
                <span className="text-slate-500 text-[9px] font-mono">Gestora Master</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      )}

      {/* ─── TAB 1: GRADE DE ESCALAS (FOTO 1) ─── */}
      {activeTab === 'escala' && (
        <div className="space-y-4">
          {/* BARRA DE CONTROLE & FILTROS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-extrabold">
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-slate-900 font-mono">Esta Semana</span>
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                31 de ago. – 06 de set. de 2026
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl outline-none cursor-pointer"
              >
                <option value="all">Todos os Setores</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button 
                onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : null}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir Templates de Escala no Calendário Orbit"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Templates</span>
              </button>

              <button
                onClick={handlePublishDrafts}
                className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                <span>Publicar Escala ({draftCount})</span>
              </button>
            </div>
          </div>

          {/* MODO RASCUNHO ALERT BANNER */}
          {!isDraftPublished && draftCount > 0 && (
            <div className="bg-amber-500 text-slate-950 p-3 sm:px-5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm border border-amber-600/30">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="w-5 h-5 rounded-full bg-slate-950/20 text-slate-950 flex items-center justify-center text-xs font-black">!</span>
                <span>
                  <strong>Modo RASCUNHO Ativo:</strong> Há {draftCount} turno(s) modificados ou criados que ainda não estão visíveis para os colaboradores.
                </span>
              </div>
              <button
                onClick={handlePublishDrafts}
                className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
              >
                Publicar Agora
              </button>
            </div>
          )}

          {/* LEGENDA DA ESCALA & DICA */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white px-4 py-2 rounded-xl border border-slate-200 text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-extrabold text-slate-900 uppercase font-mono text-[10px] tracking-wider">LEGENDA:</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold"><span className="w-2.5 h-2.5 rounded bg-purple-600" /> Publicado</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold"><span className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-500" /> Rascunho</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Presença</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><XCircle className="w-3.5 h-3.5" /> Falta</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700"><AlertCircle className="w-3.5 h-3.5" /> Justificado</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Video className="w-3.5 h-3.5" /> Reunião c/ Link</span>
            </div>
            <div className="text-slate-400 text-[11px] font-medium hidden lg:block">
              💡 Dica: Arraste e solte os turnos entre dias ou pessoas para mover
            </div>
          </div>

          {/* TABELA MATRIZ DE COLABORADORES - estilo da imagem de referência */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-white border-b-2 border-slate-100 text-slate-500 font-sans text-[11px] font-bold uppercase tracking-wide">
                  <th className="px-4 py-3 w-[200px] border-r border-slate-100">
                    <div className="flex items-center justify-between">
                      <span>COLABORADORES ({filteredEmployees.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal normal-case">Carga / Sem.</span>
                    </div>
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.dateStr} className="px-2 py-3 text-center border-r border-slate-100 min-w-[135px]">
                      <div className="text-slate-400 font-bold text-[10px] uppercase">{day.dayName}</div>
                      <div className="text-xl font-black text-slate-800 leading-tight mt-0.5">{day.dayNumber}</div>
                      <div className="text-[9px] text-slate-300 font-normal mt-0.5">8 Turnos</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const empShifts = shiftsMap[emp.id] || {};
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Coluna: Info do Colaborador */}
                      <td className="px-4 py-4 border-r border-slate-100 align-top bg-white group-hover:bg-slate-50/60">
                        <div className="flex items-start gap-3">
                          <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block font-extrabold text-slate-900 text-[13px] leading-tight">{emp.name}</span>
                            <span className="block text-[11px] text-slate-400 font-medium mt-0.5">{emp.role}</span>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                                {emp.department ? emp.department.substring(0, 12) : 'GERAL'}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                {emp.standardHoursPerWeek || 40}h / 44h
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Colunas: Um dia da semana por coluna */}
                      {weekDays.map((day) => {
                        const dayShifts = empShifts[day.dateStr] || [];
                        return (
                          <td key={day.dateStr} className="px-2 py-3 border-r border-slate-100 align-top">
                            <div className="flex flex-col gap-2">
                              {dayShifts.map((shift) => {
                                const isDraft = shift.status === 'draft';
                                const isPresent = shift.attendanceStatus === 'present';
                                const isAbsent = shift.attendanceStatus === 'absent';
                                const isJustified = shift.attendanceStatus === 'justified';
                                const isMeeting = shift.type === 'meeting';

                                // Card border-left color
                                const borderColor = isDraft
                                  ? 'border-l-amber-400'
                                  : isPresent
                                  ? 'border-l-emerald-400'
                                  : isAbsent
                                  ? 'border-l-rose-400'
                                  : isMeeting
                                  ? 'border-l-sky-400'
                                  : 'border-l-violet-400';

                                return (
                                  <div
                                    key={shift.id}
                                    onClick={() => onOpenEditShift(shift)}
                                    className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group/card`}
                                  >
                                    {/* Hora + Link badge */}
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-mono font-extrabold text-slate-600">
                                        {shift.startTime} – {shift.endTime}
                                      </span>
                                      {isMeeting && (
                                        <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.3 rounded-md border border-emerald-200">
                                          <Video className="w-2.5 h-2.5" /> Link
                                        </span>
                                      )}
                                    </div>

                                    {/* Título do turno */}
                                    <div className="font-extrabold text-[12px] text-slate-900 leading-tight line-clamp-2 mb-1.5">
                                      {shift.title || 'Turno Padrão'}
                                    </div>

                                    {/* Status pills */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                                        {shift.hoursWorked || '8'}h
                                      </span>

                                      {isDraft && (
                                        <span className="text-[9px] font-mono font-extrabold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-md uppercase">
                                          Rascunho
                                        </span>
                                      )}

                                      {isPresent && (
                                        <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <CheckCircle2 className="w-2.5 h-2.5" /> Presente
                                        </span>
                                      )}

                                      {isAbsent && (
                                        <span className="text-[9px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <XCircle className="w-2.5 h-2.5" /> Falta
                                        </span>
                                      )}

                                      {isJustified && (
                                        <span className="text-[9px] font-mono font-bold bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <AlertCircle className="w-2.5 h-2.5" /> Justificado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Botão + Adicionar */}
                              <button
                                onClick={() => onOpenCreateShift(day.dateStr, emp.id)}
                                className="w-full py-1.5 text-[10px] font-bold text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors border border-dashed border-slate-200 hover:border-violet-300 flex items-center justify-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adicionar</span>
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: APROVAÇÕES & FALTAS (ESTILO DA IMAGEM 1 COM TABELA DA IMAGEM 2) ─── */}
      {activeTab === 'aprovacoes' && (() => {
        // KPI calculations
        const pendingCount = approvalsData.filter(i => i.status === 'Pendente').length;
        const faltasCount = approvalsData.filter(i => i.status === 'Falta Lançada' || i.status === 'Recusado / Falta').length;
        const atestadosCount = approvalsData.filter(i => i.documentName && i.documentName.toLowerCase().includes('.pdf')).length;

        // Filter items
        const filteredApprovals = approvalsData.filter(row => {
          // Search filter
          if (approvalsSearch.trim()) {
            const q = approvalsSearch.toLowerCase();
            const matchName = row.employeeName.toLowerCase().includes(q);
            const matchRole = row.employeeRole.toLowerCase().includes(q);
            const matchDept = (row.employeeDept || '').toLowerCase().includes(q);
            const matchType = row.type.toLowerCase().includes(q);
            const matchReason = row.reason.toLowerCase().includes(q);
            if (!matchName && !matchRole && !matchDept && !matchType && !matchReason) return false;
          }

          // Department filter
          if (approvalsDept !== 'all' && row.employeeDept !== approvalsDept) {
            return false;
          }

          // Tab filter (Todos, Pendentes, Aprovados, Faltas / Recusados)
          if (approvalsFilterTab === 'pending') {
            return row.status === 'Pendente';
          }
          if (approvalsFilterTab === 'approved') {
            return row.status === 'Aprovado';
          }
          if (approvalsFilterTab === 'rejected') {
            return row.status === 'Recusado / Falta' || row.status === 'Falta Lançada';
          }
          return true;
        });

        return (
          <div className="approvals-page approvals-attendance-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
            <div 
              className="approvals-light-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
                filter: 'blur(90px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner Dark com Luz Quente na Lateral Direita (Fiel à Imagem 1) */}
            <div 
              className="approvals-hero approvals-light-hero rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden"
              style={{ 
                backgroundColor: '#111216',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}
            >
              {/* Feixe quente alaranjado/vermelho da Landing Page */}
              <div 
                className="approvals-light-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)',
                  filter: 'blur(60px)',
                }}
              />

              <div className="approvals-light-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="approvals-light-hero-copy max-w-xl space-y-2">
                  <div className="approvals-light-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/10 bg-white/5">
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                    CENTRAL DE GESTÃO & AUDITORIA DE PONTO
                  </div>
                  <h1 className="approvals-light-title text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                    Aprovações e <br className="hidden sm:inline" />
                    <span style={{
                      background: 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Faltas
                    </span>
                  </h1>
                  
                  <p className="approvals-light-description text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Central unificada para análise de atestados médicos, gestão de ocorrências, homologação de justificativas e aprovação de trocas de escala em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={onExportCsv}
                    className="approvals-light-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)'
                    }}
                  >
                    <Download className="w-4 h-4" /> Exportar Relatório CSV
                  </button>
                  <button
                    onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : setActiveTab('escala')}
                    className="approvals-light-secondary px-4 py-2.5 font-bold text-xs rounded-full text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ver Grade de Escalas →</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards Estilo Widget da Imagem 1 com Métricas de Aprovações/Faltas da Imagem 2 */}
            <div className="approvals-light-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {[
                { 
                  label: 'Pendentes de Aprovação', 
                  value: String(pendingCount).padStart(2, '0'), 
                  sub: 'Requer atenção imediata', 
                  dotColor: '#ff601f', 
                  dotGlow: '#ff601f',
                  hasDotInSub: true
                },
                { 
                  label: 'Faltas Registradas no Mês', 
                  value: String(faltasCount).padStart(2, '0'), 
                  sub: '-25% em relação ao mês anterior', 
                  dotColor: '#e90045', 
                  dotGlow: '#e90045',
                  hasDotInSub: false
                },
                { 
                  label: 'Atestados Anexados', 
                  value: String(Math.max(atestadosCount, 8)).padStart(2, '0'), 
                  sub: 'Comprovantes anexados pelo colaborador', 
                  dotColor: '#38bdf8', 
                  dotGlow: '#38bdf8',
                  hasDotInSub: false
                },
                { 
                  label: 'Taxa de Assiduidade', 
                  value: '96%', 
                  sub: '▲ Meta atingida (+2%)', 
                  dotColor: '#49d982', 
                  dotGlow: '#49d982',
                  hasDotInSub: false
                },
              ].map((kpi, i) => (
                <div 
                  key={i} 
                  className="approval-kpi approvals-light-kpi p-5 rounded-2xl border border-[#282a33] space-y-2 transition-transform hover:-translate-y-1 hover:border-[#3b3e4c]" 
                  style={{ background: '#15161b', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="approvals-light-kpi-label text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">{kpi.label}</span>
                    <span 
                      className="approvals-light-kpi-dot w-2.5 h-2.5 rounded-full" 
                      style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                    />
                  </div>
                  <div className="approvals-light-kpi-value text-3xl font-extrabold text-white font-sans">{kpi.value}</div>
                  <span className="approvals-light-kpi-sub text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                    {kpi.hasDotInSub && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59242]" />
                    )}
                    {kpi.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Filter Bar (Igual à da imagem 2 com os filtros e busca) */}
            <div 
              className="approval-filter-bar approvals-light-filter p-4 rounded-2xl border border-[#282a33] flex flex-wrap items-center justify-between gap-3 relative z-10" 
              style={{ background: '#15161b' }}
            >
              {/* Search & Departamentos */}
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="approvals-light-search-icon w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={approvalsSearch}
                    onChange={(e) => setApprovalsSearch(e.target.value)}
                    placeholder="Buscar por colaborador..."
                    className="approvals-light-search w-full pl-9 pr-3 py-2 text-xs rounded-full text-white placeholder:text-slate-500 outline-none transition-colors"
                    style={{ background: '#0e0f12', border: '1px solid #282a33' }}
                  />
                </div>
                <select
                  value={approvalsDept}
                  onChange={(e) => setApprovalsDept(e.target.value)}
                  className="approvals-light-department py-2 px-4 text-xs font-semibold rounded-full text-white outline-none cursor-pointer"
                  style={{ background: '#0e0f12', border: '1px solid #282a33', colorScheme: 'dark' }}
                >
                  <option value="all">Todos os Departamentos</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Status Filter Pills da Imagem 2 */}
              <div className="approvals-light-status-filter flex items-center gap-1.5 bg-[#0e0f12] p-1 rounded-full border border-[#282a33]">
                <button
                  onClick={() => setApprovalsFilterTab('all')}
                  data-active={approvalsFilterTab === 'all' ? 'true' : 'false'}
                  className={`approvals-light-status-button px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    approvalsFilterTab === 'all'
                      ? 'bg-gradient-to-r from-[#640C1E] to-[#9F243C] text-[#F9DE97] shadow-md'
                      : 'text-slate-400 hover:text-[#F9DE97]'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('pending')}
                  data-active={approvalsFilterTab === 'pending' ? 'true' : 'false'}
                  className={`approvals-light-status-button px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    approvalsFilterTab === 'pending'
                      ? 'bg-white/15 text-white font-black border border-white/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Pendentes</span>
                  {pendingCount > 0 && (
                    <span className="w-4 h-4 rounded-full text-[9px] font-mono bg-[#F59242] text-[#640C1E] flex items-center justify-center font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('approved')}
                  data-active={approvalsFilterTab === 'approved' ? 'true' : 'false'}
                  className={`approvals-light-status-button px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    approvalsFilterTab === 'approved'
                      ? 'bg-white/15 text-white font-black border border-white/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Aprovados
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('rejected')}
                  data-active={approvalsFilterTab === 'rejected' ? 'true' : 'false'}
                  className={`approvals-light-status-button px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    approvalsFilterTab === 'rejected'
                      ? 'bg-white/15 text-white font-black border border-white/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Faltas / Recusados
                </button>
              </div>

              <button
                onClick={() => setIsNewOccurrenceModalOpen(true)}
                className="approvals-light-new-request px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                style={{ 
                  background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                  boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)'
                }}
              >
                <Plus className="w-4 h-4" /> Nova Solicitação / Lançar Falta
              </button>
            </div>

            {/* Data Table igual à Imagem 2 + Coluna Adicional de Observação / Feedback para o Colaborador */}
            <div 
              className="approval-table-card approvals-light-table rounded-2xl border border-[#282a33] overflow-hidden overflow-x-auto relative z-10 shadow-xl" 
              style={{ background: '#15161b' }}
            >
              <table className="approvals-light-data w-full border-collapse text-left text-xs font-sans min-w-[1000px]">
                <thead>
                  <tr className="border-b border-[#282a33] font-mono text-[10px] uppercase text-slate-400" style={{ background: '#101115' }}>
                    <th className="p-3.5">COLABORADOR</th>
                    <th className="p-3.5">TIPO & JUSTIFICATIVA</th>
                    <th className="p-3.5">DATA / PERÍODO</th>
                    <th className="p-3.5">COMPROVANTE</th>
                    <th className="p-3.5">STATUS</th>
                    <th className="p-3.5">OBSERVAÇÃO / FEEDBACK</th>
                    <th className="p-3.5 text-right pr-5">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                        Nenhuma solicitação ou ocorrência encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredApprovals.map((row) => (
                      <tr 
                        key={row.id} 
                        className="approvals-light-row border-b border-white/5 transition-colors hover:bg-white/[0.03]" 
                        style={{ color: '#e2e8f0' }}
                      >
                        {/* Colaborador */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img 
                              src={row.employeeAvatar} 
                              alt={row.employeeName} 
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10 shrink-0" 
                            />
                            <div>
                              <span className="font-bold text-white block text-xs leading-tight">{row.employeeName}</span>
                              <span className="block text-[11px] text-slate-400 font-normal leading-tight mt-0.5">{row.employeeRole}</span>
                            </div>
                          </div>
                        </td>

                        {/* Tipo & Justificativa (com expandir inline e abrir modal detalhado) */}
                        <td className="p-3.5 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white block text-xs leading-tight">{row.type}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedDetailOccurrence(row)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs ${
                                  isDark 
                                    ? 'text-[#f89847] hover:text-[#faf0ac] bg-[#f89847]/10 hover:bg-[#f89847]/20 border border-[#f89847]/30' 
                                    : 'text-[#9F243C] hover:text-[#640C1E] bg-[#9F243C]/10 hover:bg-[#9F243C]/20 border border-[#9F243C]/25'
                                }`}
                                title="Abrir justificativa detalhada e histórico completo"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ver completa</span>
                              </button>
                            </div>

                            <div 
                              onClick={() => toggleExpandReason(row.id)}
                              className="cursor-pointer group/reason"
                              title="Clique para expandir/recolher o texto aqui na tabela"
                            >
                              <p className={`text-[11px] font-normal leading-relaxed transition-all ${
                                isDark ? 'text-slate-300' : 'text-slate-600'
                              } ${
                                expandedReasons[row.id] ? 'whitespace-normal max-w-[380px]' : 'max-w-[260px] truncate'
                              }`}>
                                {row.reason}
                              </p>
                              {row.reason.length > 35 && (
                                <span className="text-[10px] text-[#f89847] hover:underline font-semibold block mt-0.5 select-none">
                                  {expandedReasons[row.id] ? '▲ Recolher texto' : '▼ Ler tudo...'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Data / Período */}
                        <td className="p-3.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{row.date}</span>
                          </div>
                        </td>

                        {/* Comprovante */}
                        <td className="p-3.5">
                          {row.documentName && row.documentName.toLowerCase().includes('.pdf') ? (
                            <button
                              onClick={() => alert(`Visualizando comprovante: ${row.documentName}`)}
                              className="approvals-light-proof inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold text-[#f89847] bg-[#f89847]/10 border border-[#f89847]/25 hover:bg-[#f89847]/20 transition-all cursor-pointer"
                            >
                              <Paperclip className="w-3 h-3 text-[#f89847]" />
                              <span>{row.documentName}</span>
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">{row.documentName}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          {row.status === 'Aprovado' && (
                            <span className="approvals-light-status-badge approvals-light-status-approved inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                              Aprovado
                            </span>
                          )}
                          {row.status === 'Recusado / Falta' && (
                            <span className="approvals-light-status-badge approvals-light-status-rejected inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                              Recusado / Falta
                            </span>
                          )}
                          {row.status === 'Falta Lançada' && (
                            <span className="approvals-light-status-badge approvals-light-status-rejected inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                              Falta Lançada
                            </span>
                          )}
                          {row.status === 'Pendente' && (
                            <span className="approvals-light-status-badge approvals-light-status-pending inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Observação / Feedback para o Colaborador (Coluna Adicionada conforme solicitado) */}
                        <td className="p-3.5">
                          <input
                            type="text"
                            value={row.feedback}
                            onChange={(e) => handleUpdateFeedback(row.id, e.target.value)}
                            placeholder="Observação ou feedback para o colaborador (opcional)..."
                            className="approvals-light-feedback w-full min-w-[220px] max-w-[320px] px-3 py-1.5 bg-[#0e0f12] border border-[#282a33] focus:border-[#ff601f] rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                          />
                        </td>

                        {/* Ações */}
                        <td className="p-3.5 text-right pr-5">
                          {row.status === 'Pendente' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveOccurrence(row.id)}
                                title="Aprovar Pedido"
                                className="approvals-light-approve px-3 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprovar</span>
                              </button>
                              <button
                                onClick={() => handleRejectOccurrence(row.id)}
                                title="Recusar Pedido"
                                className="approvals-light-reject px-2.5 py-1.5 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Recusar</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px] italic">
                              {row.actionText || 'Processado'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Detalhes da Solicitação / Justificativa Completa */}
            {selectedDetailOccurrence && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={() => setSelectedDetailOccurrence(null)}
              >
                <div 
                  className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden relative flex flex-col my-auto transition-all animate-in zoom-in-95 ${
                    isDark 
                      ? 'bg-[#15161b] border-white/10 text-white' 
                      : 'bg-white border-[#E8DCCB] text-slate-800'
                  }`}
                  style={{
                    boxShadow: isDark 
                      ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(150, 24, 60, 0.2)' 
                      : '0 20px 40px -10px rgba(100, 12, 30, 0.15)',
                    maxHeight: '92vh',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Barra de destaque superior com gradiente de assinatura */}
                  <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #96183c, #f89847, #faf0ac)" }} />

                  {/* Header */}
                  <div 
                    className={`p-5 flex items-center justify-between border-b ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                    style={{
                      background: isDark 
                        ? 'linear-gradient(135deg, #190a12 0%, #170d18 50%, #20101c 100%)' 
                        : 'linear-gradient(135deg, #FFFDF8 0%, #FCFAF5 100%)',
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                        style={{
                          background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
                          color: '#ffffff'
                        }}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-[#640C1E]'
                        }`}>
                          Detalhes da Solicitação
                        </h3>
                        <p className={`text-xs mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          Justificativa completa enviada pelo colaborador
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedDetailOccurrence(null)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Conteúdo do Modal */}
                  <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {/* Card do Colaborador */}
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={selectedDetailOccurrence.employeeAvatar} 
                          alt={selectedDetailOccurrence.employeeName} 
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-[#f89847]/40 shrink-0" 
                        />
                        <div className="min-w-0">
                          <span className={`font-bold text-sm block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedDetailOccurrence.employeeName}
                          </span>
                          <span className={`text-xs block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {selectedDetailOccurrence.employeeRole} • {selectedDetailOccurrence.employeeDept}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        {selectedDetailOccurrence.status === 'Aprovado' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            Aprovado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Recusado / Falta' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                            Recusado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Falta Lançada' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                            Falta Lançada
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Pendente' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadados: Tipo de Solicitação e Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                          TIPO DE SOLICITAÇÃO
                        </span>
                        <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedDetailOccurrence.type}
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                          DATA / PERÍODO
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                          <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedDetailOccurrence.date}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* JUSTIFICATIVA COMPLETA (SEM LIMITES DE TAMANHO) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#f89847] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>JUSTIFICATIVA DO COLABORADOR</span>
                      </label>
                      <div className={`p-4 rounded-2xl border text-xs leading-relaxed whitespace-pre-wrap ${
                        isDark 
                          ? 'bg-[#0e0f12] border-white/10 text-slate-200' 
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        {selectedDetailOccurrence.reason || 'Nenhuma justificativa detalhada foi fornecida.'}
                      </div>
                    </div>

                    {/* Comprovante / Anexo */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                        COMPROVANTE / DOCUMENTO ANEXO
                      </label>
                      {selectedDetailOccurrence.documentName && selectedDetailOccurrence.documentName.toLowerCase().includes('.pdf') ? (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-[#f89847]/30 bg-[#f89847]/10">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-[#f89847]" />
                            <span className="text-xs font-mono font-bold text-[#f89847]">
                              {selectedDetailOccurrence.documentName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert(`Visualizando comprovante anexo: ${selectedDetailOccurrence.documentName}`)}
                            className="text-xs font-bold text-white bg-[#f89847] hover:bg-[#ff601f] px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                          >
                            Abrir Anexo
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          {selectedDetailOccurrence.documentName || 'Sem comprovante anexado'}
                        </p>
                      )}
                    </div>

                    {/* Observação / Feedback para o Colaborador */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                        OBSERVAÇÃO / FEEDBACK DO GESTOR
                      </label>
                      <textarea
                        rows={2}
                        value={selectedDetailOccurrence.feedback || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateFeedback(selectedDetailOccurrence.id, val);
                          setSelectedDetailOccurrence(prev => prev ? { ...prev, feedback: val } : null);
                        }}
                        placeholder="Insira uma observação ou orientação que o colaborador verá no portal dele..."
                        className={`w-full p-3 rounded-xl border text-xs outline-none transition-all resize-none ${
                          isDark 
                            ? 'bg-[#0e0f12] border-white/10 text-white placeholder:text-slate-600 focus:border-[#f89847]' 
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#f89847]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Footer com Ações */}
                  <div className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
                    isDark ? 'border-white/10 bg-[#121318]' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOccurrence(null)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Fechar
                    </button>

                    {selectedDetailOccurrence.status === 'Pendente' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleRejectOccurrence(selectedDetailOccurrence.id);
                            setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Recusado agora' } : null);
                          }}
                          className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Recusar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleApproveOccurrence(selectedDetailOccurrence.id);
                            setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Aprovado', actionText: 'Homologado agora' } : null);
                          }}
                          className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprovar Solicitação</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-slate-400 italic">
                        Solicitação já processada ({selectedDetailOccurrence.status})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Nova Solicitação / Lançar Falta */}
            {isNewOccurrenceModalOpen && (
              <div className="approvals-light-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                <div 
                  className="approval-modal approvals-light-modal w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl relative"
                  style={{ background: '#15161b' }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#e90045]" />
                      <h3 className="text-base font-bold text-white">Nova Solicitação / Lançar Falta</h3>
                    </div>
                    <button
                      onClick={() => setIsNewOccurrenceModalOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveNewOccurrence} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Colaborador</label>
                      <select
                        value={newOccurrenceForm.employeeId}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, employeeId: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.department})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Tipo da Ocorrência</label>
                        <select
                          value={newOccurrenceForm.type}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, type: e.target.value })}
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        >
                          <option value="Atestado Médico">Atestado Médico</option>
                          <option value="Troca de Turno">Troca de Turno</option>
                          <option value="Folga Compensatória">Folga Compensatória</option>
                          <option value="Falta Injustificada">Falta Injustificada</option>
                          <option value="Abono Especial">Abono Especial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Data / Período</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.date}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, date: e.target.value })}
                          placeholder="Ex: 21/09/2026"
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Motivo / Descrição</label>
                      <textarea
                        rows={2}
                        value={newOccurrenceForm.reason}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, reason: e.target.value })}
                        placeholder="Descreva o motivo informado pelo colaborador ou justificativa..."
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Comprovante / Anexo</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.documentName}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, documentName: e.target.value })}
                          placeholder="Ex: atestado.pdf ou Não se aplica"
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Status Inicial</label>
                        <select
                          value={newOccurrenceForm.status}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Falta Lançada">Falta Lançada</option>
                          <option value="Recusado / Falta">Recusado / Falta</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Observação ou Feedback para o Colaborador</label>
                      <input
                        type="text"
                        value={newOccurrenceForm.feedback}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, feedback: e.target.value })}
                        placeholder="Observação ou feedback para o colaborador (opcional)..."
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsNewOccurrenceModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer hover:scale-105"
                        style={{ background: 'linear-gradient(90deg, #e90045 0%, #ff601f 100%)' }}
                      >
                        Salvar Registro
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ─── TAB 3: RELATÓRIO DE PRESENÇAS (INSPIRADO NA IDENTIDADE VISUAL DA LP) ─── */}
      {activeTab === 'relatorios' && (
        <div className="attendance-report space-y-6 animate-in fade-in duration-200 relative">
          
          {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
          <div 
            className="attendance-report-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
            style={{
                background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
              filter: 'blur(90px)',
              zIndex: 0,
            }}
          />

          {/* Hero Banner Dark com Luz Quente na Lateral Direita (Fiel à LP) */}
          <div 
            className="approvals-hero attendance-report-hero rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden"
            style={{ 
              backgroundColor: '#111216',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}
          >
            {/* Feixe quente alaranjado/vermelho da Landing Page */}
            <div 
              className="attendance-report-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
              style={{
                  background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)',
                filter: 'blur(60px)',
              }}
            />

            <div className="attendance-report-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl space-y-2">
                <div className="attendance-report-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/10 bg-white/5">
                  <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                  GESTÃO INTELIGENTE DE EQUIPES
                </div>
                <h2 className="attendance-report-title text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Relatório de <br className="hidden sm:inline" />
                  <span style={{
                    background: 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    Presenças
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Consolidação em tempo real de jornadas, faltas justificadas, assiduidade e histórico operacional.
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-3 shrink-0">
                <button
                  onClick={onExportCsv}
                  className="attendance-report-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ 
                    background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)'
                  }}
                >
                  <Download className="w-4 h-4" /> Exportar Relatório CSV
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards Estilo Widget da LP */}
          <div className="attendance-report-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {[
              { label: 'Taxa de Presença', value: '96%', sub: '▲ +2.4% acima da meta', dotColor: '#49d982', dotGlow: '#49d982' },
              { label: 'Colaboradores Ativos', value: '48', sub: 'Total cadastrado na base', dotColor: '#F59242', dotGlow: '#F59242' },
              { label: 'Escalas Hoje', value: '24', sub: 'Diurnas e noturnas', dotColor: '#F9DE97', dotGlow: '#F9DE97' },
              { label: 'Faltas no Período', value: '02', sub: '1 abonada c/ atestado', dotColor: '#9F243C', dotGlow: '#9F243C' },
            ].map((kpi, i) => (
              <div 
                key={i} 
                className="approval-kpi attendance-report-kpi p-5 rounded-2xl border border-[#282a33] space-y-2 transition-transform hover:-translate-y-1 hover:border-[#3b3e4c]" 
                style={{ background: '#15161b', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="attendance-report-kpi-label text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">{kpi.label}</span>
                  <span 
                    className="attendance-report-kpi-dot w-2.5 h-2.5 rounded-full" 
                    style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                  />
                </div>
                <div className="attendance-report-kpi-value text-3xl font-extrabold text-white font-sans">{kpi.value}</div>
                <span className="attendance-report-kpi-sub text-[11px] text-slate-500 font-medium block">{kpi.sub}</span>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div 
            className="approval-filter-bar attendance-report-filters p-4 rounded-2xl border border-[#282a33] flex flex-wrap items-center justify-between gap-3 relative z-10" 
            style={{ background: '#15161b' }}
          >
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={relatorioSearch}
                  onChange={(e) => setRelatorioSearch(e.target.value)}
                  placeholder="Filtrar por colaborador ou setor..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-full text-white placeholder:text-slate-500 outline-none transition-colors"
                  style={{ background: '#0e0f12', border: '1px solid #282a33' }}
                />
              </div>
              <select
                value={relatorioStatus}
                onChange={(e) => setRelatorioStatus(e.target.value)}
                className="py-2 px-4 text-xs font-semibold rounded-full text-white outline-none cursor-pointer"
                style={{ background: '#0e0f12', border: '1px solid #282a33', colorScheme: 'dark' }}
              >
                <option value="all">Todos os Status</option>
                <option value="present">Presente</option>
                <option value="absent">Ausente</option>
                <option value="justified">Justificado</option>
              </select>
              <select
                value={relatorioDept}
                onChange={(e) => setRelatorioDept(e.target.value)}
                className="py-2 px-4 text-xs font-semibold rounded-full text-white outline-none cursor-pointer"
                style={{ background: '#0e0f12', border: '1px solid #282a33', colorScheme: 'dark' }}
              >
                <option value="all">Todos os Departamentos</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div 
            className="attendance-report-table rounded-2xl border border-[#282a33] overflow-hidden overflow-x-auto relative z-10" 
            style={{ background: '#15161b' }}
          >
            <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
              <thead>
                <tr className="border-b border-[#282a33] font-mono text-[10px] uppercase text-slate-400" style={{ background: '#101115' }}>
                  <th className="p-3.5">DATA</th>
                  <th className="p-3.5">COLABORADOR</th>
                  <th className="p-3.5">DEPARTAMENTO</th>
                  <th className="p-3.5">HORÁRIO</th>
                  <th className="p-3.5">CARGA</th>
                  <th className="p-3.5">STATUS PRESENÇA</th>
                  <th className="p-3.5">TIPO</th>
                  <th className="p-3.5">OBSERVAÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '2026-08-31', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: 'Check-in validado via GPS na sede.' },
                  { date: '2026-08-31', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Presente', type: 'Reunião', obs: 'Apresentação de indicadores de SLA Q3.' },
                  { date: '2026-08-31', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-08-31', name: 'Mariana Costa', role: 'Consultora de Vendas', dept: 'Comercial', time: '08:30 – 17:30', hours: '8h', status: 'Justificado', type: 'Regular', obs: 'Consulta médica agendada no período matutino - Atestado enviado.' },
                  { date: '2026-09-01', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-09-01', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Ausente', type: 'Regular', obs: 'No-show registrado (falta não justificada)' },
                  { date: '2026-09-01', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-09-01', name: 'Thiago Oliveira', role: 'Desenvolvedor Frontend', dept: 'Tecnologia', time: '10:00 – 19:00', hours: '8h', status: 'Presente', type: 'Plantão', obs: 'Suporte aos deploys de homologação.' },
                ].filter(row => {
                  const matchSearch = !relatorioSearch || row.name.toLowerCase().includes(relatorioSearch.toLowerCase()) || row.dept.toLowerCase().includes(relatorioSearch.toLowerCase());
                  const matchDept = relatorioDept === 'all' || row.dept === relatorioDept;
                  const matchStatus = relatorioStatus === 'all' || 
                    (relatorioStatus === 'present' && row.status === 'Presente') ||
                    (relatorioStatus === 'absent' && row.status === 'Ausente') ||
                    (relatorioStatus === 'justified' && row.status === 'Justificado');
                  return matchSearch && matchDept && matchStatus;
                }).map((row, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]" 
                    style={{ color: '#e2e8f0' }}
                  >
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">{row.date}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-full p-[1.5px] shrink-0" 
                          style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                        >
                  <div className="attendance-report-avatar w-full h-full rounded-full bg-[#15161b] flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            {row.name.substring(0, 2)}
                          </div>
                        </div>
                        <div>
                          <span className="font-bold text-white block">{row.name}</span>
                          <span className="block text-[10px] text-slate-500 font-normal">{row.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{row.dept}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-300">{row.time}</td>
                    <td className="p-3.5 font-mono font-bold text-white">{row.hours}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5" style={
                        row.status === 'Presente'
                          ? { background: 'rgba(73, 212, 123, 0.12)', color: '#49d982', border: '1px solid rgba(73, 212, 123, 0.25)' }
                          : row.status === 'Ausente'
                          ? { background: 'rgba(159, 36, 60, 0.14)', color: '#F9DE97', border: '1px solid rgba(159, 36, 60, 0.35)' }
                          : { background: 'rgba(249, 222, 151, 0.10)', color: '#F9DE97', border: '1px solid rgba(249, 222, 151, 0.24)' }
                      }>
                        <span 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ 
                            background: row.status === 'Presente' ? '#49d982' : row.status === 'Ausente' ? '#9F243C' : '#F9DE97',
                            boxShadow: `0 0 6px ${row.status === 'Presente' ? '#49d982' : row.status === 'Ausente' ? '#9F243C' : '#F9DE97'}`
                          }} 
                        />
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-[11px] text-slate-400">{row.type}</td>
                    <td className="p-3.5 text-slate-500 italic text-[11px] max-w-[260px] truncate">{row.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: LEMBRETES & TAREFAS (ESTILO DAS FOTOS / IDENTIDADE VISUAL LP) ─── */}
      {activeTab === 'tarefas' && (() => {
        const filteredReminders = reminders.filter((rem) => {
          if (reminderFilterType !== 'all' && rem.type !== reminderFilterType) return false;
          if (reminderCollaboratorFilter !== 'all') {
            if (!rem.assignedEmployeeIds || !rem.assignedEmployeeIds.includes(reminderCollaboratorFilter)) {
              return false;
            }
          }
          if (reminderSearch.trim()) {
            const q = reminderSearch.toLowerCase();
            const matchesAssigned = rem.assignedEmployeeIds?.some(empId => {
              const emp = allAssignablePeople.find(e => e.id === empId);
              return emp && (
                emp.name.toLowerCase().includes(q) ||
                emp.role.toLowerCase().includes(q) ||
                emp.department.toLowerCase().includes(q)
              );
            });
            return (
              rem.title.toLowerCase().includes(q) ||
              rem.description.toLowerCase().includes(q) ||
              rem.tag.toLowerCase().includes(q) ||
              (rem.assigneeName && rem.assigneeName.toLowerCase().includes(q)) ||
              Boolean(matchesAssigned)
            );
          }
          return true;
        });

        const getTypeBadge = (type: string) => {
          switch (type) {
            case 'reuniao':
              return {
                label: 'Reunião',
                dotColor: '#7c5cbf',
                accentColor: '#7c5cbf',
                bg: 'rgba(124, 92, 191, 0.10)',
                border: 'rgba(124, 92, 191, 0.22)',
                text: '#b49de0'
              };
            case 'plantao':
              return {
                label: 'Plantão',
                dotColor: '#b58e1a',
                accentColor: '#b58e1a',
                bg: 'rgba(181, 142, 26, 0.10)',
                border: 'rgba(181, 142, 26, 0.22)',
                text: '#d4a832'
              };
            case 'treinamento':
              return {
                label: 'Treinamento',
                dotColor: '#2d7fa8',
                accentColor: '#2d7fa8',
                bg: 'rgba(45, 127, 168, 0.10)',
                border: 'rgba(45, 127, 168, 0.22)',
                text: '#6db8d8'
              };
            default:
              return {
                label: 'Atividade',
                dotColor: '#c0541a',
                accentColor: '#c0541a',
                bg: 'rgba(192, 84, 26, 0.10)',
                border: 'rgba(192, 84, 26, 0.22)',
                text: '#d97c44'
              };
          }
        };

        return (
          <div className="approvals-page reminders-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo suave */}
            <div 
              className="reminders-background-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(245, 146, 66, 0.10) 0%, rgba(159, 36, 60, 0.07) 45%, transparent 75%)',
                filter: 'blur(90px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner Dark com Luz Quente na Lateral Direita (Fiel às Fotos) */}
            <div 
              className="approvals-hero reminders-hero rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden"
              style={{ 
                backgroundColor: '#111216',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}
            >
              {/* Feixe quente suavizado */}
              <div 
                className="reminders-hero-flare absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.16) 0%, rgba(100, 12, 30, 0.18) 45%, transparent 75%)',
                  filter: 'blur(60px)',
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-white/10 bg-white/5">
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640c1e, #9F243C, #F59242)' }} />
                    GESTÃO OPERACIONAL & ROTINA
                  </div>
                  <h1 className="reminders-title text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                    Lembretes e  <br className="hidden sm:inline" />
                    <span className="reminders-title-highlight" style={{
                      background: 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Tarefas
                    </span>
                  </h1>
                  <p className="reminders-description text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Organize reuniões operacionais, controle prazos de publicação de escalas e monitore tarefas de alinhamento com a equipe em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={handleOpenNewReminderModal}
                    className="reminders-primary-button px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 56%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)'
                    }}
                  >
                    <Plus className="w-4 h-4" /> Novo Lembrete / Tarefa
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar (Igual às imagens de referência com busca, filtros de tipo e filtro por colaborador) */}
            <div 
              className="approval-filter-bar reminders-filter-bar p-4 rounded-2xl border border-[#282a33] flex flex-wrap items-center justify-between gap-3 relative z-10" 
              style={{ background: '#15161b' }}
            >
              {/* Search */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="reminders-search-icon w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reminderSearch}
                  onChange={(e) => setReminderSearch(e.target.value)}
                  placeholder="Buscar tarefas por título, pauta, tag ou colaborador..."
                  className="reminders-search-input w-full pl-9 pr-3 py-2 text-xs rounded-full text-white placeholder:text-slate-500 outline-none transition-colors"
                  style={{ background: '#0e0f12', border: '1px solid #282a33' }}
                />
              </div>

              {/* Type Filter Pills */}
              <div className="reminders-type-filter flex items-center gap-1.5 bg-[#0e0f12] p-1 rounded-full border border-[#282a33]">
                {[
                  { id: 'all', label: 'Todos os Tipos' },
                  { id: 'reuniao', label: 'Reuniões' },
                  { id: 'atividade', label: 'Atividades' },
                  { id: 'plantao', label: 'Plantões' },
                  { id: 'treinamento', label: 'Treinamentos' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setReminderFilterType(tab.id)}
                    data-active={reminderFilterType === tab.id ? 'true' : 'false'}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      reminderFilterType === tab.id
                        ? 'bg-gradient-to-r from-[#640c1e] to-[#9F243C] text-[#F9DE97] shadow-md'
                        : 'text-slate-400 hover:text-[#F9DE97]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filter by allocated collaborator */}
              <div className="flex items-center gap-1.5 bg-[#0e0f12] px-3 py-1.5 rounded-full border border-[#282a33]">
                <Users className="w-3.5 h-3.5 text-[#F59242] shrink-0" />
                <select
                  value={reminderCollaboratorFilter}
                  onChange={(e) => setReminderCollaboratorFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-300 outline-none cursor-pointer pr-1"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="all">Todos os Responsáveis</option>
                  {allAssignablePeople.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenNewReminderModal}
                  className="reminders-primary-button px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  style={{ 
                    background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 55%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.38)'
                  }}
                >
                  <Plus className="w-4 h-4" /> Novo Lembrete / Tarefa
                </button>
              </div>
            </div>

            {/* Grid de Cards de Tarefas (Identidade Visual Dark das Fotos) */}
            {filteredReminders.length === 0 ? (
              <div className="reminders-empty-state flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#282a33] rounded-3xl bg-[#15161b] relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-sm">Nenhum lembrete ou tarefa encontrado</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm">
                  {reminderSearch || reminderCollaboratorFilter !== 'all' 
                    ? 'Tente ajustar sua busca ou limpar os filtros de colaboradores.' 
                    : 'Clique em "Novo Lembrete / Tarefa" para criar seu primeiro compromisso.'}
                </p>
              </div>
            ) : (
              <div className="reminders-grid grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {filteredReminders.map((rem) => {
                  const badge = getTypeBadge(rem.type);
                  const allocatedPeople = (rem.assignedEmployeeIds || [])
                    .map(id => allAssignablePeople.find(p => p.id === id))
                    .filter(Boolean) as Employee[];

                  return (
                    <div
                      key={rem.id}
                      className={`reminders-task-card group relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                        rem.completed
                          ? 'bg-[#15161b]/60 border-[#282a33]/60 opacity-75 hover:opacity-100'
                          : 'bg-[#15161b] border-[#282a33] hover:border-white/20'
                      }`}
                      data-reminder-type={rem.type}
                      style={{ 
                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                        borderLeft: rem.completed ? undefined : `3px solid ${badge.accentColor}`,
                      }}
                    >
                      {/* Top Header: Badge, Tag & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="reminder-type-badge inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                            data-reminder-type={rem.type}
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            <span 
                              className="w-1.5 h-1.5 rounded-full" 
                              style={{ background: badge.dotColor }} 
                            />
                            {badge.label}
                          </span>
                          <span className="reminder-tag text-[11px] font-mono text-slate-400 bg-[#0e0f12] px-2.5 py-0.5 rounded-lg border border-[#282a33]">
                            #{rem.tag}
                          </span>
                        </div>

                        {/* Actions: Toggle Complete, Edit & Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setReminders(prev => prev.map(r => r.id === rem.id ? { ...r, completed: !r.completed } : r));
                            }}
                            title={rem.completed ? "Marcar como pendente" : "Marcar como concluída"}
                            data-completed={rem.completed ? 'true' : 'false'}
                            className={`reminders-complete-button p-1.5 rounded-lg transition-colors cursor-pointer ${
                              rem.completed
                                ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-white/5 border border-white/5'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditReminderModal(rem)}
                            title="Editar lembrete / alocar pessoas"
                            className="reminders-edit-button p-1.5 rounded-lg text-slate-400 hover:text-[#F59242] hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-[#F59242]/20"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remover "${rem.title}"?`)) {
                                setReminders(prev => prev.filter(r => r.id !== rem.id));
                              }
                            }}
                            title="Excluir lembrete"
                            className="reminders-delete-button p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content: Title & Description */}
                      <div className="space-y-1.5 mb-2">
                        <h3 className={`reminders-task-title font-bold text-sm tracking-tight leading-snug transition-colors ${
                          rem.completed ? 'text-slate-500 line-through' : 'text-white group-hover:text-slate-200'
                        }`}>
                          {rem.title}
                        </h3>
                        <p className="reminders-task-description text-xs text-slate-400 leading-relaxed line-clamp-2">
                          {rem.description}
                        </p>
                      </div>

                      {/* Allocated Collaborators Banner */}
                      <div className="my-2.5 p-2 rounded-xl bg-[#0e0f12] border border-[#282a33] flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {allocatedPeople.length > 0 ? (
                            <div className="flex items-center shrink-0">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {allocatedPeople.slice(0, 3).map((person, idx) => (
                                  <img
                                    key={person.id || idx}
                                    src={person.avatar}
                                    alt={person.name}
                                    title={`${person.name} • ${person.role} (${person.department})`}
                                    className="inline-block w-6 h-6 rounded-full ring-2 ring-[#15161b] object-cover"
                                  />
                                ))}
                              </div>
                              {allocatedPeople.length > 3 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 font-mono">
                                  +{allocatedPeople.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-400">
                              <Users className="w-3 h-3" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block font-mono">
                              {allocatedPeople.length === 1 
                                ? 'Pessoa Alocada' 
                                : allocatedPeople.length > 1 
                                ? `${allocatedPeople.length} Pessoas Alocadas` 
                                : 'Equipe / Responsáveis'}
                            </span>
                            <span 
                              className="text-white font-medium truncate block text-xs" 
                              title={allocatedPeople.length > 0 ? allocatedPeople.map(p => p.name).join(', ') : rem.assigneeName || 'Equipe Geral'}
                            >
                              {allocatedPeople.length > 0 
                                ? allocatedPeople.map(p => p.name).join(', ') 
                                : (rem.assigneeName || 'Equipe Geral')}
                            </span>
                          </div>
                        </div>

                        {allocatedPeople.length > 0 ? (
                          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md text-[#F9DE97] bg-[#F59242]/10 border border-[#F59242]/20 font-mono">
                            {allocatedPeople.length === 1 ? '1 alocado' : `${allocatedPeople.length} alocados`}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md text-slate-400 bg-white/5 border border-white/10 font-mono">
                            Geral
                          </span>
                        )}
                      </div>

                      {/* Footer Row: Date, Time & Meeting Link */}
                      <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 font-mono text-slate-400">
                          <div className="reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0f12] border border-[#282a33] text-slate-300">
                            <Calendar className="reminder-meta-icon w-3.5 h-3.5 text-slate-400" />
                            <span>{rem.date}</span>
                          </div>
                          <div className="reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e0f12] border border-[#282a33] text-slate-300">
                            <Clock className="reminder-meta-icon w-3.5 h-3.5 text-slate-400" />
                            <span>{rem.time}</span>
                          </div>
                        </div>

                        {rem.link ? (
                          <a
                            href={rem.link}
                            target="_blank"
                            rel="noreferrer"
                            className="reminder-call-button px-3.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all hover:opacity-80 shadow-sm text-white"
                            style={{
                              background: '#1d5c42',
                              border: '1px solid rgba(16,185,129,0.25)',
                            }}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Acessar Chamada</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {rem.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal para Novo Lembrete / Tarefa ou Edição com Alocação de Pessoas */}
            {isNewReminderModalOpen && (
              <div
                className="reminders-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
                onClick={() => {
                  setIsNewReminderModalOpen(false);
                  setEditingReminderId(null);
                }}
              >
                <div
                  className="reminders-modal relative w-full max-w-xl max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 my-auto bg-[#15161b]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F59242]" />
                      <h3 className="text-base font-bold text-white">
                        {editingReminderId ? 'Editar Lembrete / Tarefa' : 'Criar Novo Lembrete / Tarefa'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsNewReminderModalOpen(false);
                        setEditingReminderId(null);
                      }}
                      className="reminders-modal-close w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Form Scrollable */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newReminderData.title.trim()) return;

                      const assignedNames = newReminderData.assignedEmployeeIds
                        .map(id => allAssignablePeople.find(p => p.id === id)?.name)
                        .filter(Boolean) as string[];

                      const computedAssigneeName = assignedNames.length > 0 
                        ? assignedNames.join(', ') 
                        : 'Equipe Geral';

                      if (editingReminderId) {
                        setReminders(prev => prev.map(r => r.id === editingReminderId ? {
                          ...r,
                          type: newReminderData.type,
                          tag: newReminderData.tag.trim() || 'Geral',
                          title: newReminderData.title.trim(),
                          description: newReminderData.description.trim() || 'Sem descrição adicional.',
                          date: newReminderData.date,
                          time: newReminderData.time,
                          link: newReminderData.link.trim() || undefined,
                          assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                          assigneeName: computedAssigneeName,
                        } : r));
                      } else {
                        setReminders(prev => [
                          {
                            id: `rem-${Date.now()}`,
                            type: newReminderData.type,
                            tag: newReminderData.tag.trim() || 'Geral',
                            title: newReminderData.title.trim(),
                            description: newReminderData.description.trim() || 'Sem descrição adicional.',
                            date: newReminderData.date,
                            time: newReminderData.time,
                            link: newReminderData.link.trim() || undefined,
                            assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                            assigneeName: computedAssigneeName,
                            completed: false,
                          },
                          ...prev
                        ]);
                      }

                      setIsNewReminderModalOpen(false);
                      setEditingReminderId(null);
                    }}
                    className="space-y-4 text-xs overflow-y-auto pr-1 flex-1"
                  >
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        TÍTULO DO COMPROMISSO
                      </label>
                      <input
                        type="text"
                        required
                        value={newReminderData.title}
                        onChange={(e) => setNewReminderData({ ...newReminderData, title: e.target.value })}
                        placeholder="Ex: Alinhamento de Metas Mensais"
                        className="w-full px-3.5 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#F59242] transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">
                          TIPO
                        </label>
                        <select
                          value={newReminderData.type}
                          onChange={(e) => setNewReminderData({ ...newReminderData, type: e.target.value as any })}
                          className="w-full px-3 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white outline-none focus:border-[#F59242] cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        >
                          <option value="atividade">Atividade Operacional</option>
                          <option value="reuniao">Reunião de Equipe</option>
                          <option value="plantao">Plantão / Sobreaviso</option>
                          <option value="treinamento">Treinamento / Onboarding</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">
                          TAG / PROJETO
                        </label>
                        <input
                          type="text"
                          value={newReminderData.tag}
                          onChange={(e) => setNewReminderData({ ...newReminderData, tag: e.target.value })}
                          placeholder="Ex: Gestão, Suporte, Metas"
                          className="w-full px-3 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#F59242] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">
                          DATA
                        </label>
                        <input
                          type="date"
                          value={newReminderData.date}
                          onChange={(e) => setNewReminderData({ ...newReminderData, date: e.target.value })}
                          className="w-full px-3 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white outline-none focus:border-[#F59242] cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-1">
                          HORÁRIO
                        </label>
                        <input
                          type="time"
                          value={newReminderData.time}
                          onChange={(e) => setNewReminderData({ ...newReminderData, time: e.target.value })}
                          className="w-full px-3 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white outline-none focus:border-[#F59242] cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>

                    {/* ALOCAR PESSOAS / COLABORADORES RESPONSÁVEIS */}
                    <div className="rounded-2xl bg-[#0e0f12] border border-[#282a33] p-3.5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#F59242]" />
                          <div>
                            <span className="text-xs font-bold text-white block">
                              ALOCAR PESSOAS PARA A TAREFA
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Selecione uma ou mais pessoas da equipe
                            </span>
                          </div>
                        </div>

                        {/* Quick Selection Actions */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setNewReminderData(prev => ({
                                ...prev,
                                assignedEmployeeIds: allAssignablePeople.map(p => p.id)
                              }));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          >
                            Selecionar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewReminderData(prev => ({
                                ...prev,
                                assignedEmployeeIds: []
                              }));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {/* Mini Search inside modal */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={collaboratorSearchInModal}
                          onChange={(e) => setCollaboratorSearchInModal(e.target.value)}
                          placeholder="Buscar colaborador por nome, cargo ou setor..."
                          className="w-full pl-8 pr-3 py-1.5 bg-[#15161b] border border-[#282a33] rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#F59242] transition-colors"
                        />
                      </div>

                      {/* Selected Chips */}
                      {newReminderData.assignedEmployeeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newReminderData.assignedEmployeeIds.map(id => {
                            const person = allAssignablePeople.find(p => p.id === id);
                            if (!person) return null;
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F59242]/15 border border-[#F59242]/30 text-amber-200"
                              >
                                <img
                                  src={person.avatar}
                                  alt={person.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                                <span>{person.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewReminderData(prev => ({
                                      ...prev,
                                      assignedEmployeeIds: prev.assignedEmployeeIds.filter(item => item !== id)
                                    }));
                                  }}
                                  className="hover:text-white transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Collaborator Grid / List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allAssignablePeople
                          .filter(p => {
                            if (!collaboratorSearchInModal.trim()) return true;
                            const query = collaboratorSearchInModal.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(query) ||
                              p.role.toLowerCase().includes(query) ||
                              p.department.toLowerCase().includes(query)
                            );
                          })
                          .map((person) => {
                            const isSelected = newReminderData.assignedEmployeeIds.includes(person.id);
                            return (
                              <div
                                key={person.id}
                                onClick={() => {
                                  setNewReminderData(prev => {
                                    const exists = prev.assignedEmployeeIds.includes(person.id);
                                    return {
                                      ...prev,
                                      assignedEmployeeIds: exists
                                        ? prev.assignedEmployeeIds.filter(id => id !== person.id)
                                        : [...prev.assignedEmployeeIds, person.id]
                                    };
                                  });
                                }}
                                className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                                  isSelected
                                    ? 'bg-[#F59242]/15 border-[#F59242] shadow-sm'
                                    : 'bg-[#15161b] border-[#282a33] hover:border-white/20'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-[#F59242] border-[#F59242] text-black font-bold'
                                    : 'border-slate-600 bg-black/40'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>

                                <img
                                  src={person.avatar}
                                  alt={person.name}
                                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                  <span className={`block font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                    {person.name}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 truncate">
                                    {person.role} • {person.department}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-mono">
                        <span>
                          {newReminderData.assignedEmployeeIds.length === 0
                            ? 'Nenhuma pessoa alocada (será atribuído à Equipe Geral)'
                            : `${newReminderData.assignedEmployeeIds.length} pessoa(s) alocada(s)`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        LINK DE VÍDEO (OPCIONAL)
                      </label>
                      <input
                        type="url"
                        value={newReminderData.link}
                        onChange={(e) => setNewReminderData({ ...newReminderData, link: e.target.value })}
                        placeholder="https://meet.google.com/..."
                        className="w-full px-3.5 py-2.5 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#F59242] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-1">
                        DESCRIÇÃO / PAUTA
                      </label>
                      <textarea
                        rows={2}
                        value={newReminderData.description}
                        onChange={(e) => setNewReminderData({ ...newReminderData, description: e.target.value })}
                        placeholder="Descreva detalhes ou orientações para a equipe..."
                        className="w-full px-3.5 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#F59242] transition-colors resize-none"
                      />
                    </div>

                    {/* Modal Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewReminderModalOpen(false);
                          setEditingReminderId(null);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:scale-105 cursor-pointer"
                        style={{
                          background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 58%, #F59242 100%)',
                          boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)'
                        }}
                      >
                        {editingReminderId ? 'Salvar Alterações' : 'Salvar Compromisso'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TAB 5: CHAT EQUIPE (ESTILO EXATO DO GESTOR COM BACKEND SUPABASE) ─── */}
      {activeTab === 'chat' && (() => {
        const quickSuggestions = [
          '📅 Alinhamento sobre a escala do fim de semana',
          '⚡ Aviso urgente de cobertura de plantão',
          '✅ Horários confirmados e ponto conferido',
          '❓ Solicitação de ajuste de turno',
        ];

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
                          {teamChannels.length}
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
                      {teamChannels.map((chan) => {
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
                              boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
                            } : {}}
                          >
                            <div 
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isCurrent 
                                  ? 'text-white' 
                                  : isDark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-100'
                              }`}
                              style={isCurrent ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                            >
                              <MessageSquare className="w-4 h-4" />
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

                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {employees.map((emp) => {
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
                      })}
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
                    {activeChatMode === 'direct' ? (
                      <div className="relative shrink-0">
                        <img 
                          src={selectedDirectEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={selectedDirectEmployee?.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#F59242]"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111216]" />
                      </div>
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
                            ? `Chat Privado: ${selectedDirectEmployee?.name}` 
                            : `#${activeChannelInfo.name}`}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeChatMode === 'channel' && (
                      <button
                        type="button"
                        onClick={() => handlePromptDeleteGroup(activeChannelInfo)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={`Excluir canal #${activeChannelInfo.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir Grupo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[380px] max-h-[520px]">
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
                          ? `Envie uma mensagem direta para ${selectedDirectEmployee?.name}.`
                          : `Envie a primeira mensagem no canal #${activeChannelInfo.name}!`}
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isManager = msg.sender_id === 'gestor-camila' || msg.sender_role?.toUpperCase().includes('GESTOR') || msg.sender_role?.toUpperCase().includes('GERENTE');
                      const timeStr = msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : 'Agora';
                      const parsed = parseChatMessage(msg.text, msg.attachment);

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 ${isManager ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={msg.sender_avatar || (isManager ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                              alt={msg.sender_name}
                              className={`w-9 h-9 rounded-2xl object-cover ${
                                isManager ? 'ring-2 ring-[#F59242]' : isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                              }`}
                            />
                            {!isManager && (
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                                isDark ? 'border-[#0e0f12]' : 'border-white'
                              }`} />
                            )}
                          </div>

                          <div className={`max-w-[75%] space-y-1 ${isManager ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 px-1 ${isManager ? 'justify-end' : 'justify-start'}`}>
                              <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                {msg.sender_name}
                              </strong>
                              <span className="text-slate-400">•</span>
                              <span className={isManager ? 'text-[#F59242] font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}>
                                {msg.sender_role}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-mono text-slate-400">{timeStr}</span>
                            </div>

                            <div
                              className="inline-block p-3.5 text-xs leading-relaxed text-left rounded-2xl shadow-lg break-words"
                              style={isManager ? {
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
                              {parsed.text && (
                                <p className="leading-relaxed">{parsed.text}</p>
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
                                      src={parsed.attachment.url}
                                      alt={parsed.attachment.name}
                                      className="w-full max-h-52 object-cover group-hover/img:scale-102 transition-transform duration-200"
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
                  {quickSuggestions.map((sug, idx) => (
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

                  <input
                    id="chat-main-input"
                    type="text"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    placeholder={
                      pendingManagerAttachment
                        ? 'Adicionar legenda para a imagem (opcional)...'
                        : activeChatMode === 'direct'
                          ? `Mensagem privada para ${selectedDirectEmployee?.name || 'Colaborador'}...`
                          : `Mensagem no canal #${activeChannelInfo.name}...`
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
                    disabled={!newChatInput.trim() && !pendingManagerAttachment}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                    style={{
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 16px rgba(100, 12, 30, 0.35)'
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
                    <div>
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
                        href={managerPreviewModalImage.url}
                        download={managerPreviewModalImage.name}
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
      })()}

    </div>
  );
};
