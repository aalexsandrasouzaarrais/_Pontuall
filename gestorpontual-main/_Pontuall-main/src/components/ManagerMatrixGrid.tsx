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
  Maximize2
} from 'lucide-react';
import { Employee, Shift, TimeOffRequest } from '../types';

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

  // Tab 5 (Chat) State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'msg-1',
      senderName: 'Camila Duarte',
      senderRole: 'GESTORA',
      isManager: true,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      text: 'Olá equipe! A escala da próxima semana já está sendo finalizada no módulo Scheduler. Favor checar os plantões.',
      time: 'Hoje às 09:00',
    },
    {
      id: 'msg-2',
      senderName: 'Lucas Silva',
      senderRole: 'Analista de Atendimento',
      isManager: false,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      text: 'Perfeito Camila! Já conferi meu horário de atendimento de segunda e confirmei minha presença.',
      time: 'Hoje às 09:12',
    },
    {
      id: 'msg-3',
      senderName: 'Beatriz Santos',
      senderRole: 'Especialista de Suporte',
      isManager: false,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      text: 'Enviei uma solicitação de troca de turno com o Lucas para a sexta-feira no painel. Assim que puder, dê uma olhada por favor!',
      time: 'Hoje às 10:18',
    }
  ]);
  const [newChatInput, setNewChatInput] = useState('');
  const [activeChatChannel, setActiveChatChannel] = useState<'geral' | 'escalas' | 'gestao'>('geral');
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim()) return;

    setChatMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        senderName: 'Camila Duarte',
        senderRole: 'GESTORA',
        isManager: true,
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        text: newChatInput.trim(),
        time: 'Agora',
      }
    ]);
    setNewChatInput('');
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
              onClick={() => setActiveTab('chat')}
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
          <div className="approvals-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
            <div 
              className="absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: isDark 
                  ? 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)'
                  : 'radial-gradient(circle, rgba(245, 146, 66, 0.22) 0%, rgba(218, 0, 67, 0.15) 45%, transparent 75%)',
                filter: 'blur(80px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner (Fiel ao estilo da LP no Dark e moderno no Light) */}
            <div 
              className={`rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all ${
                isDark 
                  ? 'bg-[#111216] border-white/10 shadow-2xl' 
                  : 'border-slate-200/90 shadow-xs'
              }`}
              style={
                isDark 
                  ? { boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }
                  : { 
                      background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 52%, #fffbf5 75%, #fff2e5 100%)',
                      boxShadow: '0 10px 30px -5px rgba(245, 146, 66, 0.10), 0 4px 12px rgba(0, 0, 0, 0.03)'
                    }
              }
            >
              {/* Feixe quente alaranjado/vermelho da Landing Page */}
              <div 
                className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
                    : 'radial-gradient(circle at 65% 50%, rgba(245, 146, 66, 0.38) 0%, rgba(218, 0, 67, 0.28) 40%, rgba(154, 20, 68, 0.16) 65%, transparent 80%)',
                  filter: isDark ? 'blur(60px)' : 'blur(45px)',
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-xl space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark 
                      ? 'text-slate-300 border-white/10 bg-white/5' 
                      : 'text-slate-600 border-slate-200 bg-slate-100/90'
                  }`}>
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                    CENTRAL DE GESTÃO & AUDITORIA DE PONTO
                  </div>
                  <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Aprovações e <br className="hidden sm:inline" />
                    <span 
                      className="approvals-title-highlight bg-clip-text text-transparent inline-block"
                      style={{
                        backgroundImage: isDark
                          ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)'
                          : 'linear-gradient(90deg, #9F243C 0%, #c2323e 48%, #F59242 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'inline-block'
                      }}
                    >
                      Faltas
                    </span>
                  </h1>
                  
                  <p className={`text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Central unificada para análise de atestados médicos, gestão de ocorrências, homologação de justificativas e aprovação de trocas de escala em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={onExportCsv}
                    className="px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.25)'
                    }}
                  >
                    <Download className="w-4 h-4" /> Exportar Relatório CSV
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards Estilo Widget com Métricas de Aprovações/Faltas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
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
                  className={`p-5 rounded-2xl border space-y-2 transition-all hover:-translate-y-1 ${
                    isDark 
                      ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]' 
                      : 'bg-white border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300'
                  }`} 
                  style={isDark ? { boxShadow: '0 8px 24px rgba(0,0,0,0.4)' } : {}}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>{kpi.label}</span>
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                    />
                  </div>
                  <div className={`text-3xl font-extrabold font-sans ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>{kpi.value}</div>
                  <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {kpi.hasDotInSub && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59242]" />
                    )}
                    {kpi.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Filter Bar (Igual à do dark mode com paridade total no light mode) */}
            <div 
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
                isDark 
                  ? 'bg-[#15161b] border-[#282a33]' 
                  : 'bg-white border-slate-200 shadow-2xs'
              }`} 
            >
              {/* Search & Departamentos */}
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="text"
                    value={approvalsSearch}
                    onChange={(e) => setApprovalsSearch(e.target.value)}
                    placeholder="Buscar por colaborador..."
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#ff601f]' 
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                    }`}
                  />
                </div>
                <select
                  value={approvalsDept}
                  onChange={(e) => setApprovalsDept(e.target.value)}
                  className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#0e0f12] border border-[#282a33] text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all">Todos os Departamentos</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Status Filter Pills */}
              <div className={`flex items-center gap-1.5 p-1 rounded-full border transition-all ${
                isDark 
                  ? 'bg-[#0e0f12] border-[#282a33]' 
                  : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  onClick={() => setApprovalsFilterTab('all')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    approvalsFilterTab === 'all'
                      ? isDark
                        ? 'bg-gradient-to-r from-[#640C1E] to-[#9F243C] text-[#F9DE97] shadow-md'
                        : 'bg-gradient-to-r from-[#96183c] to-[#b3223e] text-white shadow-xs font-bold'
                      : isDark
                        ? 'text-slate-400 hover:text-[#F9DE97]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('pending')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    approvalsFilterTab === 'pending'
                      ? isDark
                        ? 'bg-white/15 text-white font-black border border-white/20'
                        : 'bg-white text-slate-900 font-bold border border-slate-200/80 shadow-2xs'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>Pendentes</span>
                  {pendingCount > 0 && (
                    <span className={`w-4 h-4 rounded-full text-[9px] font-mono flex items-center justify-center font-bold ${
                      isDark 
                        ? 'bg-[#F59242] text-[#640C1E]' 
                        : 'bg-[#f89847] text-white'
                    }`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('approved')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    approvalsFilterTab === 'approved'
                      ? isDark
                        ? 'bg-white/15 text-white font-black border border-white/20'
                        : 'bg-white text-slate-900 font-bold border border-slate-200/80 shadow-2xs'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  Aprovados
                </button>
                <button
                  onClick={() => setApprovalsFilterTab('rejected')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    approvalsFilterTab === 'rejected'
                      ? isDark
                        ? 'bg-white/15 text-white font-black border border-white/20'
                        : 'bg-white text-slate-900 font-bold border border-slate-200/80 shadow-2xs'
                      : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  Faltas / Recusados
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div 
              className={`rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
                isDark 
                  ? 'bg-[#15161b] border-[#282a33] shadow-xl' 
                  : 'bg-white border-slate-200 shadow-2xs'
              }`} 
            >
              <table className="w-full border-collapse text-left text-xs font-sans min-w-[1000px]">
                <thead>
                  <tr className={`border-b font-mono text-[10px] uppercase font-bold tracking-wider ${
                    isDark 
                      ? 'bg-[#101115] border-[#282a33] text-slate-400' 
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
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
                      <td colSpan={7} className={`p-8 text-center text-xs ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Nenhuma solicitação ou ocorrência encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredApprovals.map((row) => (
                      <tr 
                        key={row.id} 
                        className={`border-b transition-colors ${
                          isDark 
                            ? 'border-white/5 hover:bg-white/[0.03] text-slate-200' 
                            : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'
                        }`} 
                      >
                        {/* Colaborador */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img 
                              src={row.employeeAvatar} 
                              alt={row.employeeName} 
                              className={`w-9 h-9 rounded-full object-cover ring-2 shrink-0 ${
                                isDark ? 'ring-white/10' : 'ring-slate-200'
                              }`} 
                            />
                            <div>
                              <span className={`font-bold block text-xs leading-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>{row.employeeName}</span>
                              <span className={`block text-[11px] font-normal leading-tight mt-0.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>{row.employeeRole}</span>
                            </div>
                          </div>
                        </td>

                        {/* Tipo & Justificativa (com expandir inline e abrir modal detalhado) */}
                        <td className="p-3.5 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold block text-xs leading-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>{row.type}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedDetailOccurrence(row)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs ${
                                  isDark 
                                    ? 'text-[#f89847] hover:text-[#faf0ac] bg-[#f89847]/10 hover:bg-[#f89847]/20 border border-[#f89847]/30' 
                                    : 'text-[#96183c] hover:text-[#640C1E] bg-[#96183c]/8 hover:bg-[#96183c]/15 border border-[#96183c]/20'
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
                                <span className={`text-[10px] hover:underline font-semibold block mt-0.5 select-none ${
                                  isDark ? 'text-[#f89847]' : 'text-[#96183c]'
                                }`}>
                                  {expandedReasons[row.id] ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Data / Período */}
                        <td className="p-3.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] ${
                            isDark 
                              ? 'bg-white/5 border border-white/5 text-slate-300' 
                              : 'bg-slate-100/80 border border-slate-200 text-slate-700'
                          }`}>
                            <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{row.date}</span>
                          </div>
                        </td>

                        {/* Comprovante */}
                        <td className="p-3.5">
                          {row.documentName && row.documentName.toLowerCase().includes('.pdf') ? (
                            <button
                              onClick={() => alert(`Visualizando comprovante: ${row.documentName}`)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                                isDark 
                                  ? 'text-[#f89847] bg-[#f89847]/10 border border-[#f89847]/25 hover:bg-[#f89847]/20' 
                                  : 'text-[#96183c] bg-[#96183c]/8 border border-[#96183c]/20 hover:bg-[#96183c]/15'
                              }`}
                            >
                              <Paperclip className={`w-3 h-3 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                              <span>{row.documentName}</span>
                            </button>
                          ) : (
                            <span className={`italic text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {row.documentName}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5">
                          {row.status === 'Aprovado' && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                              isDark 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399]" />
                              Aprovado
                            </span>
                          )}
                          {row.status === 'Recusado / Falta' && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                              isDark 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f87171]" />
                              Recusado / Falta
                            </span>
                          )}
                          {row.status === 'Falta Lançada' && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                              isDark 
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f87171]" />
                              Falta Lançada
                            </span>
                          )}
                          {row.status === 'Pendente' && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                              isDark 
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25' 
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#fbbf24] animate-pulse" />
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Observação / Feedback para o Colaborador */}
                        <td className="p-3.5">
                          <input
                            type="text"
                            value={row.feedback}
                            onChange={(e) => handleUpdateFeedback(row.id, e.target.value)}
                            placeholder="Observação ou feedback para o colaborador (opcional)..."
                            className={`w-full min-w-[220px] max-w-[320px] px-3 py-1.5 rounded-xl text-xs outline-none transition-all ${
                              isDark 
                                ? 'bg-[#0e0f12] border border-[#282a33] focus:border-[#ff601f] text-slate-200 placeholder:text-slate-600' 
                                : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#96183c] focus:ring-1 focus:ring-[#96183c]/20 text-slate-800 placeholder:text-slate-400'
                            }`}
                          />
                        </td>

                        {/* Ações */}
                        <td className="p-3.5 text-right pr-5">
                          {row.status === 'Pendente' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveOccurrence(row.id)}
                                title="Aprovar Pedido"
                                className="px-3 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprovar</span>
                              </button>
                              <button
                                onClick={() => handleRejectOccurrence(row.id)}
                                title="Recusar Pedido"
                                className={`px-2.5 py-1.5 border font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                                  isDark 
                                    ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' 
                                    : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Recusar</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`font-mono text-[11px] italic ${
                              isDark ? 'text-slate-400' : 'text-slate-400'
                            }`}>
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
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={() => setSelectedDetailOccurrence(null)}
              >
                <div 
                  className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden relative flex flex-col my-auto transition-all animate-in zoom-in-95 ${
                    isDark 
                      ? 'bg-[#15161b] border-white/10 text-white' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                  style={{
                    boxShadow: isDark 
                      ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(150, 24, 60, 0.2)' 
                      : '0 20px 40px -10px rgba(15, 23, 42, 0.15)',
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
                        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
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
                          isDark ? 'text-white' : 'text-slate-900'
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
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
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
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            isDark 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#34d399]" />
                            Aprovado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Recusado / Falta' && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            isDark 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f87171]" />
                            Recusado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Falta Lançada' && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            isDark 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f87171]" />
                            Falta Lançada
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Pendente' && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            isDark 
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#fbbf24] animate-pulse" />
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
                        <span className={`text-[10px] font-bold font-mono tracking-wider uppercase block mb-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          TIPO DE SOLICITAÇÃO
                        </span>
                        <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedDetailOccurrence.type}
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className={`text-[10px] font-bold font-mono tracking-wider uppercase block mb-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          DATA / PERÍODO
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                          <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedDetailOccurrence.date}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* JUSTIFICATIVA COMPLETA (SEM LIMITES DE TAMANHO) */}
                    <div className="space-y-1.5">
                      <label className={`text-[11px] font-bold font-mono tracking-wider uppercase flex items-center gap-1.5 ${
                        isDark ? 'text-[#f89847]' : 'text-[#96183c]'
                      }`}>
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
                      <label className={`text-[10px] font-bold font-mono tracking-wider uppercase block ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        COMPROVANTE / DOCUMENTO ANEXO
                      </label>
                      {selectedDetailOccurrence.documentName && selectedDetailOccurrence.documentName.toLowerCase().includes('.pdf') ? (
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${
                          isDark 
                            ? 'border-[#f89847]/30 bg-[#f89847]/10' 
                            : 'border-[#96183c]/20 bg-[#96183c]/5'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Paperclip className={`w-4 h-4 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                            <span className={`text-xs font-mono font-bold ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                              {selectedDetailOccurrence.documentName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert(`Visualizando comprovante anexo: ${selectedDetailOccurrence.documentName}`)}
                            className="text-xs font-bold text-white bg-gradient-to-r from-[#96183c] to-[#f89847] hover:opacity-95 px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                          >
                            Abrir Anexo
                          </button>
                        </div>
                      ) : (
                        <p className={`text-xs italic ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                          {selectedDetailOccurrence.documentName || 'Sem comprovante anexado'}
                        </p>
                      )}
                    </div>

                    {/* Observação / Feedback para o Colaborador */}
                    <div className="space-y-1.5 pt-1">
                      <label className={`text-[10px] font-bold font-mono tracking-wider uppercase block ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
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
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
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
                          className={`px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            isDark
                              ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/15'
                              : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                          }`}
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
                      <span className={`text-xs font-mono italic ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        Solicitação já processada ({selectedDetailOccurrence.status})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Nova Solicitação / Lançar Falta */}
            {isNewOccurrenceModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
                <div 
                  className={`w-full max-w-lg rounded-3xl border p-6 space-y-4 shadow-2xl relative transition-all animate-in zoom-in-95 ${
                    isDark 
                      ? 'bg-[#15161b] border-white/10 text-white' 
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  style={{
                    boxShadow: isDark 
                      ? '0 25px 60px rgba(0, 0, 0, 0.85)' 
                      : '0 20px 40px -10px rgba(15, 23, 42, 0.15)'
                  }}
                >
                  <div className={`flex items-center justify-between pb-3 border-b ${
                    isDark ? 'border-white/10' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#e90045]" />
                      <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Nova Solicitação / Lançar Falta
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsNewOccurrenceModalOpen(false)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveNewOccurrence} className="space-y-3.5 text-xs">
                    <div>
                      <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Colaborador</label>
                      <select
                        value={newOccurrenceForm.employeeId}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, employeeId: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                        }`}
                        style={{ colorScheme: isDark ? 'dark' : 'light' }}
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.department})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tipo da Ocorrência</label>
                        <select
                          value={newOccurrenceForm.type}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, type: e.target.value })}
                          className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        >
                          <option value="Atestado Médico">Atestado Médico</option>
                          <option value="Troca de Turno">Troca de Turno</option>
                          <option value="Folga Compensatória">Folga Compensatória</option>
                          <option value="Falta Injustificada">Falta Injustificada</option>
                          <option value="Abono Especial">Abono Especial</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Data / Período</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.date}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, date: e.target.value })}
                          placeholder="Ex: 21/09/2026"
                          className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Motivo / Descrição</label>
                      <textarea
                        rows={2}
                        value={newOccurrenceForm.reason}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, reason: e.target.value })}
                        placeholder="Descreva o motivo informado pelo colaborador ou justificativa..."
                        className={`w-full px-3 py-2 rounded-xl outline-none transition-all resize-none ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                        }`}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Comprovante / Anexo</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.documentName}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, documentName: e.target.value })}
                          placeholder="Ex: atestado.pdf ou Não se aplica"
                          className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Status Inicial</label>
                        <select
                          value={newOccurrenceForm.status}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, status: e.target.value as any })}
                          className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Falta Lançada">Falta Lançada</option>
                          <option value="Recusado / Falta">Recusado / Falta</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Observação ou Feedback para o Colaborador</label>
                      <input
                        type="text"
                        value={newOccurrenceForm.feedback}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, feedback: e.target.value })}
                        placeholder="Observação ou feedback para o colaborador (opcional)..."
                        className={`w-full px-3 py-2 rounded-xl outline-none transition-all ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#ff601f]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                        }`}
                      />
                    </div>

                    <div className={`flex items-center justify-end gap-3 pt-3 border-t ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setIsNewOccurrenceModalOpen(false)}
                        className={`px-4 py-2 rounded-xl transition-colors font-semibold cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(90deg, #96183c 0%, #b3223e 50%, #f89847 100%)' }}
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
        <div className="approvals-page w-full space-y-6 animate-in fade-in duration-200 relative">
          
          {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
          <div 
            className="absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
            style={{
              background: isDark 
                ? 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)'
                : 'radial-gradient(circle, rgba(245, 146, 66, 0.22) 0%, rgba(218, 0, 67, 0.15) 45%, transparent 75%)',
              filter: 'blur(80px)',
              zIndex: 0,
            }}
          />

          {/* Hero Banner (Fiel ao estilo da LP no Dark e moderno no Light) */}
          <div 
            className={`rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all ${
              isDark 
                ? 'bg-[#111216] border-white/10 shadow-2xl' 
                : 'border-slate-200/90 shadow-xs'
            }`}
            style={
              isDark 
                ? { boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }
                : { 
                    background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 52%, #fffbf5 75%, #fff2e5 100%)',
                    boxShadow: '0 10px 30px -5px rgba(245, 146, 66, 0.10), 0 4px 12px rgba(0, 0, 0, 0.03)'
                  }
            }
          >
            {/* Feixe quente alaranjado/vermelho da Landing Page */}
            <div 
              className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
              style={{
                background: isDark
                  ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
                  : 'radial-gradient(circle at 65% 50%, rgba(245, 146, 66, 0.38) 0%, rgba(218, 0, 67, 0.28) 40%, rgba(154, 20, 68, 0.16) 65%, transparent 80%)',
                filter: isDark ? 'blur(60px)' : 'blur(45px)',
              }}
            />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl space-y-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isDark 
                    ? 'text-slate-300 border-white/10 bg-white/5' 
                    : 'text-slate-600 border-slate-200 bg-slate-100/90'
                }`}>
                  <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                  GESTÃO INTELIGENTE DE EQUIPES
                </div>
                <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Relatório de <br className="hidden sm:inline" />
                  <span 
                    className="approvals-title-highlight bg-clip-text text-transparent inline-block"
                    style={{
                      backgroundImage: isDark
                        ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)'
                        : 'linear-gradient(90deg, #9F243C 0%, #c2323e 48%, #F59242 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                      display: 'inline-block'
                    }}
                  >
                    Presenças
                  </span>
                </h1>
                <p className={`text-xs sm:text-sm leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Consolidação em tempo real de jornadas, faltas justificadas, assiduidade e histórico operacional.
                </p>
              </div>

              <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={onExportCsv}
                  className="px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ 
                    background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.25)'
                  }}
                >
                  <Download className="w-4 h-4" /> Exportar Relatório CSV
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards Estilo Widget com Métricas de Presenças */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {[
              { label: 'Taxa de Presença', value: '96%', sub: '▲ +2.4% acima da meta', dotColor: '#49d982', dotGlow: '#49d982' },
              { label: 'Colaboradores Ativos', value: '48', sub: 'Total cadastrado na base', dotColor: '#F59242', dotGlow: '#F59242' },
              { label: 'Escalas Hoje', value: '24', sub: 'Diurnas e noturnas', dotColor: '#F9DE97', dotGlow: '#F9DE97' },
              { label: 'Faltas no Período', value: '02', sub: '1 abonada c/ atestado', dotColor: '#9F243C', dotGlow: '#9F243C' },
            ].map((kpi, i) => (
              <div 
                key={i} 
                className={`p-5 rounded-2xl border space-y-2 transition-all hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]' 
                    : 'bg-white border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300'
                }`} 
                style={isDark ? { boxShadow: '0 8px 24px rgba(0,0,0,0.4)' } : {}}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>{kpi.label}</span>
                  <span 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                  />
                </div>
                <div className={`text-3xl font-extrabold font-sans ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>{kpi.value}</div>
                <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}>
                  {kpi.sub}
                </span>
              </div>
            ))}
          </div>

          {/* Filter Bar (Igual à do dark mode com paridade total no light mode) */}
          <div 
            className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
              isDark 
                ? 'bg-[#15161b] border-[#282a33]' 
                : 'bg-white border-slate-200 shadow-2xs'
            }`} 
          >
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={relatorioSearch}
                  onChange={(e) => setRelatorioSearch(e.target.value)}
                  placeholder="Filtrar por colaborador ou setor..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-all ${
                    isDark 
                      ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#ff601f]' 
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                  }`}
                />
              </div>
              <select
                value={relatorioStatus}
                onChange={(e) => setRelatorioStatus(e.target.value)}
                className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer transition-all ${
                  isDark
                    ? 'bg-[#0e0f12] border border-[#282a33] text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              >
                <option value="all">Todos os Status</option>
                <option value="present">Presente</option>
                <option value="absent">Ausente</option>
                <option value="justified">Justificado</option>
              </select>
              <select
                value={relatorioDept}
                onChange={(e) => setRelatorioDept(e.target.value)}
                className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer transition-all ${
                  isDark
                    ? 'bg-[#0e0f12] border border-[#282a33] text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              >
                <option value="all">Todos os Departamentos</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div 
            className={`rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
              isDark 
                ? 'bg-[#15161b] border-[#282a33] shadow-xl' 
                : 'bg-white border-slate-200 shadow-2xs'
            }`} 
          >
            <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
              <thead>
                <tr className={`border-b font-mono text-[10px] uppercase font-bold tracking-wider ${
                  isDark 
                    ? 'bg-[#101115] border-[#282a33] text-slate-400' 
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
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
                    className={`border-b transition-colors ${
                      isDark 
                        ? 'border-white/5 hover:bg-white/[0.03] text-slate-200' 
                        : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'
                    }`} 
                  >
                    <td className={`p-3.5 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.date}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-full p-[1.5px] shrink-0" 
                          style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                        >
                          <div className={`w-full h-full rounded-full flex items-center justify-center text-[10px] font-bold uppercase ${
                            isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-800'
                          }`}>
                            {row.name.substring(0, 2)}
                          </div>
                        </div>
                        <div>
                          <span className={`font-bold block text-xs leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</span>
                          <span className={`block text-[11px] font-normal leading-tight mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{row.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`p-3.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.dept}</td>
                    <td className={`p-3.5 font-mono text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.time}</td>
                    <td className={`p-3.5 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.hours}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                        row.status === 'Presente'
                          ? isDark 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : row.status === 'Ausente'
                          ? isDark 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isDark 
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span 
                          className={`w-1.5 h-1.5 rounded-full ${
                            row.status === 'Presente' ? 'bg-emerald-500' : row.status === 'Ausente' ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                        {row.status}
                      </span>
                    </td>
                    <td className={`p-3.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.type}</td>
                    <td className={`p-3.5 italic text-[11px] max-w-[260px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{row.obs}</td>
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
                dotColor: '#9333ea',
                accentColor: '#9333ea',
                bg: isDark ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff',
                border: isDark ? 'rgba(147, 51, 234, 0.3)' : '#e9d5ff',
                text: isDark ? '#d8b4fe' : '#7e22ce'
              };
            case 'plantao':
              return {
                label: 'Plantão',
                dotColor: '#d97706',
                accentColor: '#d97706',
                bg: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7',
                border: isDark ? 'rgba(217, 119, 6, 0.3)' : '#fde68a',
                text: isDark ? '#fde68a' : '#b45309'
              };
            case 'treinamento':
              return {
                label: 'Treinamento',
                dotColor: '#0284c7',
                accentColor: '#0284c7',
                bg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
                border: isDark ? 'rgba(2, 132, 199, 0.3)' : '#bae6fd',
                text: isDark ? '#7dd3fc' : '#0369a1'
              };
            default:
              return {
                label: 'Atividade',
                dotColor: '#ea580c',
                accentColor: '#ea580c',
                bg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#ffedd5',
                border: isDark ? 'rgba(234, 88, 12, 0.3)' : '#fed7aa',
                text: isDark ? '#fdba74' : '#c2410c'
              };
          }
        };

        return (
          <div className="approvals-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
            <div 
              className="absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: isDark 
                  ? 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)'
                  : 'radial-gradient(circle, rgba(245, 146, 66, 0.22) 0%, rgba(218, 0, 67, 0.15) 45%, transparent 75%)',
                filter: 'blur(80px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner (Fiel ao estilo da LP no Dark e moderno no Light) */}
            <div 
              className={`rounded-3xl p-6 sm:p-8 border relative overflow-hidden transition-all ${
                isDark 
                  ? 'bg-[#111216] border-white/10 shadow-2xl' 
                  : 'border-slate-200/90 shadow-xs'
              }`}
              style={
                isDark 
                  ? { boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }
                  : { 
                      background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 52%, #fffbf5 75%, #fff2e5 100%)',
                      boxShadow: '0 10px 30px -5px rgba(245, 146, 66, 0.10), 0 4px 12px rgba(0, 0, 0, 0.03)'
                    }
              }
            >
              {/* Feixe quente alaranjado/vermelho da Landing Page */}
              <div 
                className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
                    : 'radial-gradient(circle at 65% 50%, rgba(245, 146, 66, 0.38) 0%, rgba(218, 0, 67, 0.28) 40%, rgba(154, 20, 68, 0.16) 65%, transparent 80%)',
                  filter: isDark ? 'blur(60px)' : 'blur(45px)',
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark 
                      ? 'text-slate-300 border-white/10 bg-white/5' 
                      : 'text-slate-600 border-slate-200 bg-slate-100/90'
                  }`}>
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                    GESTÃO OPERACIONAL & ROTINA
                  </div>
                  <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Lembretes e  <br className="hidden sm:inline" />
                    <span 
                      className="approvals-title-highlight bg-clip-text text-transparent inline-block" 
                      style={{
                        backgroundImage: isDark
                          ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)'
                          : 'linear-gradient(90deg, #9F243C 0%, #c2323e 48%, #F59242 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        display: 'inline-block'
                      }}
                    >
                      Tarefas
                    </span>
                  </h1>
                  <p className={`text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Organize reuniões operacionais, controle prazos de publicação de escalas e monitore tarefas de alinhamento com a equipe em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={handleOpenNewReminderModal}
                    className="px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.25)'
                    }}
                  >
                    <Plus className="w-4 h-4" /> Novo Lembrete / Tarefa
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar (Igual à do dark mode com paridade total no light mode) */}
            <div 
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
                isDark 
                  ? 'bg-[#15161b] border-[#282a33]' 
                  : 'bg-white border-slate-200 shadow-2xs'
              }`} 
            >
              {/* Search */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={reminderSearch}
                  onChange={(e) => setReminderSearch(e.target.value)}
                  placeholder="Buscar tarefas por título, pauta, tag ou colaborador..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-all ${
                    isDark 
                      ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#ff601f]' 
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                  }`}
                />
              </div>

              {/* Type Filter Pills */}
              <div className={`flex items-center gap-1.5 p-1 rounded-full border transition-all ${
                isDark 
                  ? 'bg-[#0e0f12] border-[#282a33]' 
                  : 'bg-slate-100 border-slate-200'
              }`}>
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
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      reminderFilterType === tab.id
                        ? isDark
                          ? 'bg-gradient-to-r from-[#640C1E] to-[#9F243C] text-[#F9DE97] shadow-md'
                          : 'bg-gradient-to-r from-[#96183c] to-[#b3223e] text-white shadow-xs font-bold'
                        : isDark
                          ? 'text-slate-400 hover:text-[#F9DE97]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filter by allocated collaborator */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
              }`}>
                <Users className="w-3.5 h-3.5 text-[#F59242] shrink-0" />
                <select
                  value={reminderCollaboratorFilter}
                  onChange={(e) => setReminderCollaboratorFilter(e.target.value)}
                  className={`bg-transparent text-xs font-semibold outline-none cursor-pointer pr-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-800'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all">Todos os Responsáveis</option>
                  {allAssignablePeople.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid de Cards de Tarefas (Identidade Visual Dark das Fotos / Light idêntico a Tab 2) */}
            {filteredReminders.length === 0 ? (
              <div className={`reminders-empty-state flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-3xl relative z-10 ${
                isDark ? 'border-[#282a33] bg-[#15161b]' : 'border-slate-200 bg-white shadow-xs'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-white/5' : 'bg-slate-100'
                }`}>
                  <Sparkles className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhum lembrete ou tarefa encontrado</h3>
                <p className={`text-xs mt-1 max-w-sm ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
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
                          ? isDark
                            ? 'bg-[#15161b]/60 border-[#282a33]/60 opacity-75 hover:opacity-100'
                            : 'bg-slate-50 border-slate-200 opacity-75 hover:opacity-100'
                          : isDark
                            ? 'bg-[#15161b] border-[#282a33] hover:border-white/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-md'
                      }`}
                      data-reminder-type={rem.type}
                      style={{ 
                        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.35)' : undefined,
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
                          <span className={`reminder-tag text-[11px] font-mono px-2.5 py-0.5 rounded-lg border ${
                            isDark ? 'text-slate-400 bg-[#0e0f12] border-[#282a33]' : 'text-slate-600 bg-slate-100 border-slate-200'
                          }`}>
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
                                ? isDark
                                  ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                : isDark
                                  ? 'text-slate-400 hover:text-emerald-400 hover:bg-white/5 border border-white/5'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 border border-transparent'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditReminderModal(rem)}
                            title="Editar lembrete / alocar pessoas"
                            className={`reminders-edit-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                              isDark
                                ? 'text-slate-400 hover:text-[#F59242] hover:bg-white/5 border-transparent hover:border-[#F59242]/20'
                                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100 border-transparent hover:border-slate-200'
                            }`}
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
                            className={`reminders-delete-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                              isDark
                                ? 'text-slate-400 hover:text-rose-400 hover:bg-white/5 border-transparent hover:border-rose-500/20'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content: Title & Description */}
                      <div className="space-y-1.5 mb-2">
                        <h3 className={`reminders-task-title font-bold text-sm tracking-tight leading-snug transition-colors ${
                          rem.completed 
                            ? 'text-slate-400 line-through' 
                            : isDark ? 'text-white group-hover:text-slate-200' : 'text-slate-900 group-hover:text-slate-700'
                        }`}>
                          {rem.title}
                        </h3>
                        <p className={`reminders-task-description text-xs leading-relaxed line-clamp-2 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {rem.description}
                        </p>
                      </div>

                      {/* Allocated Collaborators Banner */}
                      <div className={`my-2.5 p-2 rounded-xl border flex items-center justify-between gap-2.5 ${
                        isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                      }`}>
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
                                    className={`inline-block w-6 h-6 rounded-full object-cover ring-2 ${
                                      isDark ? 'ring-[#15161b]' : 'ring-white'
                                    }`}
                                  />
                                ))}
                              </div>
                              {allocatedPeople.length > 3 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                  isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  +{allocatedPeople.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                              isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}>
                              <Users className="w-3 h-3" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className={`text-[9px] uppercase font-bold tracking-wider block font-mono ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {allocatedPeople.length === 1 
                                ? 'Pessoa Alocada' 
                                : allocatedPeople.length > 1 
                                ? `${allocatedPeople.length} Pessoas Alocadas` 
                                : 'Equipe / Responsáveis'}
                            </span>
                            <span 
                              className={`font-medium truncate block text-xs ${
                                isDark ? 'text-white' : 'text-slate-800'
                              }`} 
                              title={allocatedPeople.length > 0 ? allocatedPeople.map(p => p.name).join(', ') : rem.assigneeName || 'Equipe Geral'}
                            >
                              {allocatedPeople.length > 0 
                                ? allocatedPeople.map(p => p.name).join(', ') 
                                : (rem.assigneeName || 'Equipe Geral')}
                            </span>
                          </div>
                        </div>

                        {allocatedPeople.length > 0 ? (
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono ${
                            isDark ? 'text-[#F9DE97] bg-[#F59242]/10 border border-[#F59242]/20' : 'text-amber-800 bg-amber-50 border border-amber-200'
                          }`}>
                            {allocatedPeople.length === 1 ? '1 alocado' : `${allocatedPeople.length} alocados`}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono ${
                            isDark ? 'text-slate-400 bg-white/5 border border-white/10' : 'text-slate-500 bg-slate-100 border border-slate-200'
                          }`}>
                            Geral
                          </span>
                        )}
                      </div>

                      {/* Footer Row: Date, Time & Meeting Link */}
                      <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                      }`}>
                        <div className="flex items-center gap-2 font-mono">
                          <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <Calendar className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{rem.date}</span>
                          </div>
                          <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <Clock className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
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
                          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
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
                  className={`reminders-modal relative w-full max-w-xl max-h-[90vh] rounded-3xl border shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 my-auto transition-all ${
                    isDark 
                      ? 'bg-[#15161b] border-white/10 text-white' 
                      : 'bg-white border-slate-200 text-slate-900 shadow-xl'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                    isDark ? 'border-white/10' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F59242]" />
                      <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingReminderId ? 'Editar Lembrete / Tarefa' : 'Criar Novo Lembrete / Tarefa'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsNewReminderModalOpen(false);
                        setEditingReminderId(null);
                      }}
                      className={`reminders-modal-close w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                      }`}
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
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        TÍTULO DO COMPROMISSO
                      </label>
                      <input
                        type="text"
                        required
                        value={newReminderData.title}
                        onChange={(e) => setNewReminderData({ ...newReminderData, title: e.target.value })}
                        placeholder="Ex: Alinhamento de Metas Mensais"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-colors ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          TIPO
                        </label>
                        <select
                          value={newReminderData.type}
                          onChange={(e) => setNewReminderData({ ...newReminderData, type: e.target.value as any })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#F59242]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        >
                          <option value="atividade">Atividade Operacional</option>
                          <option value="reuniao">Reunião de Equipe</option>
                          <option value="plantao">Plantão / Sobreaviso</option>
                          <option value="treinamento">Treinamento / Onboarding</option>
                        </select>
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          TAG / PROJETO
                        </label>
                        <input
                          type="text"
                          value={newReminderData.tag}
                          onChange={(e) => setNewReminderData({ ...newReminderData, tag: e.target.value })}
                          placeholder="Ex: Gestão, Suporte, Metas"
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none transition-colors ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          DATA
                        </label>
                        <input
                          type="date"
                          value={newReminderData.date}
                          onChange={(e) => setNewReminderData({ ...newReminderData, date: e.target.value })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#F59242]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        />
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          HORÁRIO
                        </label>
                        <input
                          type="time"
                          value={newReminderData.time}
                          onChange={(e) => setNewReminderData({ ...newReminderData, time: e.target.value })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer ${
                            isDark 
                              ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#F59242]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183c]'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        />
                      </div>
                    </div>

                    {/* ALOCAR PESSOAS / COLABORADORES RESPONSÁVEIS */}
                    <div className={`rounded-2xl border p-3.5 space-y-3 ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#F59242]" />
                          <div>
                            <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              ALOCAR PESSOAS PARA A TAREFA
                            </span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              isDark 
                                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white' 
                                : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                            }`}
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
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              isDark 
                                ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400' 
                                : 'bg-white border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600'
                            }`}
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {/* Mini Search inside modal */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={collaboratorSearchInModal}
                          onChange={(e) => setCollaboratorSearchInModal(e.target.value)}
                          placeholder="Buscar colaborador por nome, cargo ou setor..."
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none transition-colors ${
                            isDark 
                              ? 'bg-[#15161b] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]' 
                              : 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#96183c]'
                          }`}
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
                                className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                  isDark 
                                    ? 'bg-[#F59242]/15 border-[#F59242]/30 text-amber-200' 
                                    : 'bg-amber-50 border-amber-300 text-amber-900'
                                }`}
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
                                  className="hover:opacity-80 transition-opacity cursor-pointer"
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
                                    ? isDark
                                      ? 'bg-[#F59242]/15 border-[#F59242] shadow-sm'
                                      : 'bg-amber-50 border-amber-400 shadow-2xs'
                                    : isDark
                                      ? 'bg-[#15161b] border-[#282a33] hover:border-white/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-[#F59242] border-[#F59242] text-black font-bold'
                                    : isDark ? 'border-slate-600 bg-black/40' : 'border-slate-300 bg-slate-100'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>

                                <img
                                  src={person.avatar}
                                  alt={person.name}
                                  className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200/50 shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                  <span className={`block font-semibold text-xs truncate ${
                                    isSelected 
                                      ? isDark ? 'text-white' : 'text-slate-900 font-bold' 
                                      : isDark ? 'text-slate-200' : 'text-slate-800'
                                  }`}>
                                    {person.name}
                                  </span>
                                  <span className={`block text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {person.role} • {person.department}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className={`flex items-center justify-between text-[11px] pt-1 font-mono ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <span>
                          {newReminderData.assignedEmployeeIds.length === 0
                            ? 'Nenhuma pessoa alocada (será atribuído à Equipe Geral)'
                            : `${newReminderData.assignedEmployeeIds.length} pessoa(s) alocada(s)`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        LINK DE VÍDEO (OPCIONAL)
                      </label>
                      <input
                        type="url"
                        value={newReminderData.link}
                        onChange={(e) => setNewReminderData({ ...newReminderData, link: e.target.value })}
                        placeholder="https://meet.google.com/..."
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-colors ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        DESCRIÇÃO / PAUTA
                      </label>
                      <textarea
                        rows={2}
                        value={newReminderData.description}
                        onChange={(e) => setNewReminderData({ ...newReminderData, description: e.target.value })}
                        placeholder="Descreva detalhes ou orientações para a equipe..."
                        className={`w-full px-3.5 py-2 rounded-xl text-xs outline-none transition-colors resize-none ${
                          isDark 
                            ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]' 
                            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                        }`}
                      />
                    </div>

                    {/* Modal Footer Buttons */}
                    <div className={`flex items-center justify-end gap-3 pt-3 border-t shrink-0 ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewReminderModalOpen(false);
                          setEditingReminderId(null);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
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

      {/* ─── TAB 5: CHAT EQUIPE (ESTILO IDÊNTICO ÀS DEMAIS ABAS LP: APROVAÇÕES, RELATÓRIOS E TAREFAS) ─── */}
      {activeTab === 'chat' && (() => {
        const filteredMessages = chatMessages;

        const channels = [
          { id: 'geral' as const, name: 'Canal Geral & Avisos', desc: 'Comunicação aberta para toda a equipe', badge: 'Online', unread: 0 },
          { id: 'escalas' as const, name: 'Escalas & Plantões', desc: 'Dúvidas sobre horários e plantões de fim de semana', badge: 'Ativo', unread: 2 },
          { id: 'gestao' as const, name: 'Gestão Operacional', desc: 'Alinhamento direto entre liderança e supervisão', badge: 'RH', unread: 1 },
        ];

        const activeChannelInfo = channels.find(c => c.id === activeChatChannel) || channels[0];

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
                  : 'border-slate-200 bg-white shadow-xl'
              }`}
            >
              {/* Left Channel & Presence Column */}
              <aside className={`hidden lg:flex flex-col border-r p-4 justify-between transition-all ${
                isDark 
                  ? 'border-[#282a33] bg-[#15161b]/95' 
                  : 'border-slate-200 bg-slate-50/50'
              }`}>
                <div className="space-y-4">
                  {/* Channels section */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Canais da Equipe
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-200/80 text-slate-700'
                      }`}>
                        3
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {channels.map((chan) => {
                        const isCurrent = activeChatChannel === chan.id;
                        return (
                          <button
                            key={chan.id}
                            type="button"
                            onClick={() => setActiveChatChannel(chan.id)}
                            className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 ${
                              isCurrent
                                ? isDark 
                                  ? 'border-[#F59242]/40 shadow-lg' 
                                  : 'border-[#96183c]/30 bg-white shadow-xs ring-1 ring-[#96183c]/15'
                                : isDark
                                  ? 'border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                                  : 'border-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                            style={isCurrent && isDark ? {
                              background: 'linear-gradient(135deg, rgba(100, 12, 30, 0.45) 0%, rgba(159, 36, 60, 0.35) 60%, rgba(245, 146, 66, 0.20) 100%)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
                            } : undefined}
                          >
                            <div 
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isCurrent 
                                  ? 'text-white' 
                                  : isDark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-100'
                              }`}
                              style={isCurrent ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : undefined}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold truncate ${
                                  isCurrent 
                                    ? isDark ? 'text-white font-black' : 'text-[#96183c] font-black'
                                    : isDark ? 'text-slate-300' : 'text-slate-700'
                                }`}>
                                  #{chan.name}
                                </p>
                                {chan.unread > 0 && !isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#F59242] text-black">
                                    {chan.unread}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] truncate mt-0.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {chan.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Online Team Members */}
                  <div className={`pt-2 border-t ${
                    isDark ? 'border-[#282a33]/60' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between px-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Equipe Conectada
                      </span>
                      <span className="text-[10px] text-emerald-500 font-bold">● 5 online</span>
                    </div>
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {employees.map((emp) => (
                        <div
                          key={emp.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors ${
                            isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className={`w-7 h-7 rounded-full object-cover ${
                                isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                              }`}
                            />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                              isDark ? 'border-[#15161b]' : 'border-white'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[11px] font-bold truncate ${
                              isDark ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {emp.name}
                            </p>
                            <p className={`text-[9px] truncate ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {emp.role} • {emp.department}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer status card */}
                <div className={`p-3 rounded-xl border text-[10px] flex items-center gap-2 mt-4 ${
                  isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-2xs'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="truncate">Sincronização em tempo real ativa</span>
                </div>
              </aside>

              {/* Main Chat Conversation Column */}
              <div 
                className="flex flex-col min-w-0" 
                style={{ 
                  background: isDark 
                    ? 'radial-gradient(circle at 95% 5%, rgba(245, 146, 66, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 0%, rgba(100, 12, 30, 0.08) 0%, transparent 35%), #0e0f12' 
                    : '#f8fafc'
                }}
              >
                {/* Conversation Header */}
                <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 backdrop-blur-xs transition-all ${
                  isDark ? 'border-[#282a33] bg-[#111216]/90' : 'border-slate-200 bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                      style={{ background: 'linear-gradient(135deg, #640C1E, #F59242)' }}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          #{activeChannelInfo.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {activeChannelInfo.badge}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {activeChannelInfo.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono hidden sm:inline ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Canal Corporativo Oficial
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : setActiveTab('escala')}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isDark 
                          ? 'border-white/10 text-slate-300 hover:text-white hover:bg-white/5' 
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Ver Escala</span>
                    </button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[380px] max-h-[520px]">
                  <div className="flex items-center gap-3">
                    <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-slate-200'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Mensagens de Hoje
                    </span>
                    <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-slate-200'}`} />
                  </div>

                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Nenhuma mensagem enviada ainda.
                    </div>
                  ) : (
                    filteredMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${msg.isManager ? 'flex-row-reverse' : ''}`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={msg.avatar}
                            alt={msg.senderName}
                            className={`w-9 h-9 rounded-2xl object-cover ${
                              isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                            }`}
                          />
                          {!msg.isManager && (
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                              isDark ? 'border-[#0e0f12]' : 'border-white'
                            }`} />
                          )}
                        </div>

                        <div className={`max-w-[80%] space-y-1 ${msg.isManager ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-1">
                            <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              {msg.senderName}
                            </strong>
                            <span className="text-slate-400">•</span>
                            <span className={msg.isManager ? (isDark ? 'text-[#F59242] font-semibold' : 'text-[#96183c] font-semibold') : isDark ? 'text-slate-400' : 'text-slate-500'}>
                              {msg.senderRole}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-mono text-slate-400">{msg.time}</span>
                          </div>

                          <div
                            className="inline-block p-3.5 text-xs leading-relaxed text-left rounded-2xl shadow-sm"
                            style={msg.isManager ? {
                              background: 'linear-gradient(135deg, #640C1E 0%, #9F243C 100%)',
                              color: '#ffffff',
                              borderRadius: '18px 4px 18px 18px',
                              boxShadow: '0 8px 20px rgba(100, 12, 30, 0.22)',
                              border: '1px solid rgba(255, 255, 255, 0.12)'
                            } : {
                              background: isDark ? '#1b1d24' : '#ffffff',
                              color: isDark ? '#e2e8f0' : '#1e293b',
                              border: isDark ? '1px solid #282a33' : '1px solid #e2e8f0',
                              borderRadius: '4px 18px 18px 18px',
                              boxShadow: isDark ? '0 8px 20px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(15, 23, 42, 0.04)'
                            }}
                          >
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick Suggestion Chips */}
                <div className={`px-4 py-2 border-t flex items-center gap-2 overflow-x-auto scrollbar-none ${
                  isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-white border-slate-200'
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
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Input Area */}
                <form
                  onSubmit={handleSendMessage}
                  className={`p-3 sm:p-4 border-t flex items-center gap-2 ${
                    isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Anexar arquivo ou comprovante"
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Anexar documento"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    id="chat-main-input"
                    type="text"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    placeholder={`Escreva uma mensagem no #${activeChannelInfo.name}...`}
                    className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]/60' 
                        : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c]'
                    }`}
                  />

                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    disabled={!newChatInput.trim()}
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
          </div>
      );
    })()}

    </div>
  );
};
