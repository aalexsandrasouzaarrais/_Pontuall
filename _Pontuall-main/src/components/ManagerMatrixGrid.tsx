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
  X
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
  activeTab?: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat';
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
  activeTab: sidebarTab,
}) => {
  // Active top tab state: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat'
  const [activeTab, setActiveTab] = useState<'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat'>('escala');

  useEffect(() => {
    if (sidebarTab) setActiveTab(sidebarTab);
  }, [sidebarTab]);
  
  // Tab 1 (Escala) States
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(27);
  const [isDraftPublished, setIsDraftPublished] = useState<boolean>(false);

  // Tab 2 (Aprovações) Sub-tabs
  const [approvalsSubTab, setApprovalsSubTab] = useState<'trocas' | 'atestados'>('trocas');
  const [requestsList, setRequestsList] = useState<TimeOffRequest[]>([
    {
      id: 'req-1',
      employeeId: 'emp-2',
      employeeName: 'Beatriz Santos',
      employeeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      type: 'swap',
      date: '2026-08-29',
      targetEmployeeId: 'emp-1',
      targetEmployeeName: 'Lucas Silva',
      reason: 'Compromisso pessoal na faculdade na sexta à noite. Lucas concordou em cobrir meu turno.',
      status: 'pending',
      createdAt: 'Hoje às 10:15',
    },
    {
      id: 'req-2',
      employeeId: 'emp-4',
      employeeName: 'Mariana Costa',
      employeeAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      type: 'time_off',
      date: '2026-09-04',
      reason: 'Solicitação de folga compensatória banco de horas para viagem familiar.',
      status: 'pending',
      createdAt: 'Ontem às 16:40',
    }
  ]);

  // Tab 3 (Relatórios) States
  const [relatorioSearch, setRelatorioSearch] = useState('');
  const [relatorioStatus, setRelatorioStatus] = useState('all');
  const [relatorioDept, setRelatorioDept] = useState('all');

  // Tab 4 (Tarefas) State - Orbit Visual Identity
  const [reminders, setReminders] = useState([
    {
      id: 'rem-1',
      type: 'reuniao' as 'reuniao' | 'atividade' | 'plantao' | 'treinamento',
      tag: 'Metas Corporativas',
      title: 'Alinhamento Semanal de Metas Q3',
      description: 'Revisão dos indicadores de NPS e tempo de resposta da equipe.',
      date: '2026-08-28',
      time: '14:00',
      link: 'https://meet.google.com/abc-defg-hij',
      assigneeName: 'Camila Duarte',
      completed: false,
    },
    {
      id: 'rem-2',
      type: 'atividade' as 'reuniao' | 'atividade' | 'plantao' | 'treinamento',
      tag: 'Gestão de Escalas',
      title: 'Publicar Escala de Setembro',
      description: 'Validar solicitações de folga e atestados antes do fechamento do mês.',
      date: '2026-08-29',
      time: '16:30',
      assigneeName: 'Camila Duarte',
      completed: false,
    },
    {
      id: 'rem-3',
      type: 'plantao' as 'reuniao' | 'atividade' | 'plantao' | 'treinamento',
      tag: 'Operacional',
      title: 'Supervisão de Plantão de Fim de Semana',
      description: 'Garantir escala de contingência e cobertura de suporte aos chamados críticos.',
      date: '2026-08-30',
      time: '08:00',
      assigneeName: 'Rafael Mendes',
      completed: true,
    },
    {
      id: 'rem-4',
      type: 'treinamento' as 'reuniao' | 'atividade' | 'plantao' | 'treinamento',
      tag: 'Onboarding & Treinamento',
      title: 'Treinamento de Novos Analistas CLT',
      description: 'Apresentação das políticas de pontualidade, intervalos e rotina de registro.',
      date: '2026-09-01',
      time: '10:00',
      link: 'https://meet.google.com/tech-treinamento',
      assigneeName: 'Lucas Silva',
      completed: false,
    }
  ]);

  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderFilterType, setReminderFilterType] = useState<string>('all');
  const [isNewReminderModalOpen, setIsNewReminderModalOpen] = useState(false);
  const [newReminderData, setNewReminderData] = useState({
    title: '',
    description: '',
    type: 'atividade' as 'reuniao' | 'atividade' | 'plantao' | 'treinamento',
    tag: 'Geral',
    date: '2026-09-02',
    time: '09:00',
    link: '',
  });

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

  const handleApproveRequest = (reqId: string) => {
    setRequestsList(prev => prev.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
  };

  const handleRejectRequest = (reqId: string) => {
    setRequestsList(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
  };

  const isOrbitStyledTab = activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios';

  return (
    <div className={`w-full font-sans space-y-4 select-none ${
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
              onClick={() => setActiveTab('escala')}
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

            {/* Tab 3: Relatório Presenças */}
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'relatorios'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Relatório Presenças</span>
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

              <button className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
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

      {/* ─── TAB 2: APROVAÇÕES & FALTAS (IDENTIDADE VISUAL ORBIT) ─── */}
      {activeTab === 'aprovacoes' && (
        <div className="bg-[#14151C] rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl space-y-6 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
              >
                <CheckCircle2 className="w-6 h-6 text-[#faf0ac]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Central de Solicitações & Aprovações
                  </h2>
                  <span 
                    className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #96183c, #f89847)', color: '#fff' }}
                  >
                    ORBIT APROVAÇÕES
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gerencie pedidos de folga, trocas de turnos entre colegas e atestados com auditoria imediata
                </p>
              </div>
            </div>

            {/* Sub-tab Switcher in Orbit Style */}
            <div className="flex items-center bg-[#1A1C24] p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => setApprovalsSubTab('trocas')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  approvalsSubTab === 'trocas'
                    ? 'shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={approvalsSubTab === 'trocas' ? {
                  background: 'linear-gradient(135deg, #96183c, #f89847)',
                  color: '#faf0ac'
                } : undefined}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Folgas & Trocas</span>
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                  approvalsSubTab === 'trocas' ? 'bg-black/30 text-white font-bold' : 'bg-white/10 text-slate-300'
                }`}>
                  {requestsList.filter(r => r.type === 'swap' && r.status === 'pending').length || 2}
                </span>
              </button>

              <button
                onClick={() => setApprovalsSubTab('atestados')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  approvalsSubTab === 'atestados'
                    ? 'shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={approvalsSubTab === 'atestados' ? {
                  background: 'linear-gradient(135deg, #96183c, #f89847)',
                  color: '#faf0ac'
                } : undefined}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Justificativas & Atestados</span>
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                  approvalsSubTab === 'atestados' ? 'bg-black/30 text-white font-bold' : 'bg-white/10 text-slate-300'
                }`}>
                  {requestsList.filter(r => r.type !== 'swap' && r.status === 'pending').length || 2}
                </span>
              </button>
            </div>
          </div>

          {/* Pending Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#f89847] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f89847] animate-pulse" />
                SOLICITAÇÕES AGUARDANDO DECISÃO ({requestsList.filter(r => r.status === 'pending').length})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Decisões notificam o colaborador automaticamente
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requestsList.filter(r => r.status === 'pending').map((req) => (
                <div 
                  key={req.id} 
                  className="bg-[#1A1C24] border border-white/10 hover:border-[#f89847]/40 rounded-2xl p-5 space-y-3.5 relative shadow-lg transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={req.employeeAvatar} 
                        alt={req.employeeName} 
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10" 
                      />
                      <div>
                        <span className="block text-sm font-bold text-white leading-tight">
                          {req.employeeName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span 
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase"
                            style={req.type === 'swap' ? {
                              background: 'rgba(124, 58, 237, 0.20)',
                              color: '#c4b5fd',
                              border: '1px solid rgba(167, 139, 250, 0.40)'
                            } : {
                              background: 'rgba(248, 152, 71, 0.20)',
                              color: '#fed7aa',
                              border: '1px solid rgba(248, 152, 71, 0.40)'
                            }}
                          >
                            {req.type === 'swap' ? 'Troca de Turno' : 'Pedido de Folga'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono bg-white/5 px-2.5 py-1 rounded-lg">
                      {req.createdAt}
                    </span>
                  </div>

                  {/* Details Card */}
                  <div className="bg-[#14151C] p-3 rounded-xl text-xs space-y-1.5 border border-white/5 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Data Solicitada:</span>
                      <span className="font-bold text-white">{req.date}</span>
                    </div>
                    {req.targetEmployeeName && (
                      <div className="flex justify-between text-[#faf0ac]">
                        <span className="text-slate-400">Colega Substituto:</span>
                        <span className="font-bold">{req.targetEmployeeName}</span>
                      </div>
                    )}
                  </div>

                  {/* Justification Reason Box */}
                  <div className="text-xs text-slate-300 bg-[#14151C] p-3 rounded-xl border border-white/5 leading-relaxed">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 font-mono">MOTIVO INFORMADO:</span>
                    "{req.reason}"
                  </div>

                  {/* Manager Note Input */}
                  <input
                    type="text"
                    placeholder="Observação ou feedback para o colaborador (opcional)..."
                    className="w-full px-3 py-2 bg-[#14151C] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
                  />

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="py-2.5 px-3 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" /> 
                      <span>Recusar</span>
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req.id)}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> 
                      <span>Aprovar Pedido</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Judged Requests */}
          <div className="pt-5 border-t border-white/10 space-y-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              HISTÓRICO JULGADO RECENTEMENTE
            </span>
            <div className="bg-[#1A1C24] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" 
                  alt="Rafael Mendes" 
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" 
                />
                <div>
                  <span className="font-bold text-white">Rafael Mendes</span>
                  <span className="font-mono text-slate-400 text-[11px] ml-2">Solicitação de Folga · 21/08/2026</span>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[11px] rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado pelo Gestor
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: RELATÓRIO PRESENÇAS (ORBIT DARK IDENTITY) ─── */}
      {activeTab === 'relatorios' && (
        <div className="space-y-5 animate-in fade-in duration-200">

          {/* Orbit Header */}
          <div className="rounded-3xl p-5 border border-white/10 shadow-2xl overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #12131A 0%, #1A1C24 100%)' }}>
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #f89847 0%, transparent 50%)' }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)', borderRadius: '14px' }}>
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-white font-extrabold text-base tracking-tight">Relatório de Presenças</h2>
                    <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(248,152,71,0.15)', color: '#f89847', border: '1px solid rgba(248,152,71,0.35)' }}>
                      ORBIT ANALYTICS
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">Histórico consolidado de presença, faltas e justificativas da equipe</p>
                </div>
              </div>
              <button
                onClick={onExportCsv}
                className="px-4 py-2 font-bold text-xs rounded-xl text-white flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'TAXA DE ASSIDUIDADE', value: '89%', sub: '↗ Comparecimento geral', valueColor: '#f89847', subBg: 'rgba(248,152,71,0.12)', subColor: '#f89847' },
              { label: 'PRESENÇAS CONFIRMADAS', value: '7', sub: '56h trabalhadas', valueColor: '#34d399', subBg: 'rgba(52,211,153,0.12)', subColor: '#34d399' },
              { label: 'FALTAS NÃO JUSTIFICADAS', value: '1', sub: '1 justificada c/ atestado', valueColor: '#f87171', subBg: 'rgba(248,113,113,0.12)', subColor: '#f87171' },
              { label: 'TOTAL NA ESCALA', value: '19', sub: '6 colaboradores ativos', valueColor: '#a78bfa', subBg: 'rgba(167,139,250,0.12)', subColor: '#a78bfa' },
            ].map((kpi, i) => (
              <div key={i} className="p-4 rounded-2xl border border-white/10 space-y-2" style={{ background: '#1A1C24' }}>
                <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">{kpi.label}</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black font-mono" style={{ color: kpi.valueColor }}>{kpi.value}</span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg" style={{ background: kpi.subBg, color: kpi.subColor }}>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="p-3.5 rounded-2xl border border-white/10 flex flex-wrap items-center gap-3" style={{ background: '#1A1C24' }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={relatorioSearch}
                onChange={(e) => setRelatorioSearch(e.target.value)}
                placeholder="Filtrar por nome ou setor..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl text-white placeholder:text-slate-500 outline-none transition-colors"
                style={{ background: '#14151C', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
            <select
              value={relatorioStatus}
              onChange={(e) => setRelatorioStatus(e.target.value)}
              className="py-2 px-3 text-xs font-bold rounded-xl text-white outline-none cursor-pointer"
              style={{ background: '#14151C', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
            >
              <option value="all">Todos os Status</option>
              <option value="present">Presente</option>
              <option value="absent">Ausente</option>
              <option value="justified">Justificado</option>
            </select>
            <select
              value={relatorioDept}
              onChange={(e) => setRelatorioDept(e.target.value)}
              className="py-2 px-3 text-xs font-bold rounded-xl text-white outline-none cursor-pointer"
              style={{ background: '#14151C', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
            >
              <option value="all">Todos os Departamentos</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Data Table */}
          <div className="rounded-2xl border border-white/10 overflow-hidden overflow-x-auto" style={{ background: '#1A1C24' }}>
            <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10px] uppercase text-slate-400" style={{ background: '#14151C' }}>
                  <th className="p-3">DATA</th>
                  <th className="p-3">COLABORADOR</th>
                  <th className="p-3">DEPARTAMENTO</th>
                  <th className="p-3">HORÁRIO</th>
                  <th className="p-3">CARGA</th>
                  <th className="p-3">STATUS PRESENÇA</th>
                  <th className="p-3">TIPO</th>
                  <th className="p-3">OBSERVAÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '2026-08-31', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: 'Realizar triagem das filas de espera prioritárias.' },
                  { date: '2026-08-31', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Presente', type: 'Reunião', obs: 'Apresentar métricas de SLA do suporte do mês anterior.' },
                  { date: '2026-08-31', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-08-31', name: 'Mariana Costa', role: 'Consultora de Vendas', dept: 'Comercial', time: '08:30 – 17:30', hours: '8h', status: 'Justificado', type: 'Regular', obs: 'Consulta médica agendada no período matutino - Atestado enviado.' },
                  { date: '2026-09-01', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-09-01', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Ausente', type: 'Regular', obs: 'Não compareceu ao turno (No-show registrado pelo sistema)' },
                  { date: '2026-09-01', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 transition-colors" style={{ color: '#e2e8f0' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="p-3 font-mono text-[11px] text-slate-400">{row.date}</td>
                    <td className="p-3 font-bold text-white">
                      {row.name}
                      <span className="block text-[10px] text-slate-500 font-normal">{row.role}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">{row.dept}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-300">{row.time}</td>
                    <td className="p-3 font-mono font-bold text-white">{row.hours}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono inline-flex items-center gap-1" style={
                        row.status === 'Presente'
                          ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }
                          : row.status === 'Ausente'
                          ? { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.35)' }
                          : { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }
                      }>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400">{row.type}</td>
                    <td className="p-3 text-slate-500 italic text-[11px]">{row.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: LEMBRETES & TAREFAS (IDENTIDADE VISUAL CALENDÁRIO ORBIT) ─── */}
      {activeTab === 'tarefas' && (() => {
        const filteredReminders = reminders.filter((rem) => {
          if (reminderFilterType !== 'all' && rem.type !== reminderFilterType) return false;
          if (reminderSearch.trim()) {
            const q = reminderSearch.toLowerCase();
            return (
              rem.title.toLowerCase().includes(q) ||
              rem.description.toLowerCase().includes(q) ||
              rem.tag.toLowerCase().includes(q) ||
              (rem.assigneeName && rem.assigneeName.toLowerCase().includes(q))
            );
          }
          return true;
        });

        const pendingCount = reminders.filter(r => !r.completed).length;
        const completedCount = reminders.filter(r => r.completed).length;

        const getTypeBadge = (type: string) => {
          switch (type) {
            case 'reuniao':
              return {
                label: 'Reunião',
                color: '#7c3aed',
                bg: 'rgba(124, 58, 237, 0.20)',
                border: 'rgba(167, 139, 250, 0.40)',
                text: '#c4b5fd'
              };
            case 'plantao':
              return {
                label: 'Plantão',
                color: '#d97706',
                bg: 'rgba(217, 119, 6, 0.20)',
                border: 'rgba(245, 158, 11, 0.40)',
                text: '#fcd34d'
              };
            case 'treinamento':
              return {
                label: 'Treinamento',
                color: '#0284c7',
                bg: 'rgba(2, 132, 199, 0.20)',
                border: 'rgba(56, 189, 248, 0.40)',
                text: '#7dd3fc'
              };
            default:
              return {
                label: 'Atividade',
                color: '#f89847',
                bg: 'rgba(248, 152, 71, 0.20)',
                border: 'rgba(248, 152, 71, 0.40)',
                text: '#fed7aa'
              };
          }
        };

        return (
          <div className="bg-[#14151C] rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl space-y-6 animate-in fade-in duration-200">
            {/* 1. Header Toolbar in Orbit Style */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  <Sparkles className="w-6 h-6 text-[#faf0ac]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      Lembretes, Reuniões & Tarefas
                    </h2>
                    <span 
                      className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #96183c, #f89847)', color: '#fff' }}
                    >
                      ORBIT GESTÃO
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Central de compromissos operacionais, reuniões com link e tarefas de acompanhamento da equipe
                  </p>
                </div>
              </div>

              {/* Action Buttons & Counters */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 bg-[#1A1C24] px-3 py-1.5 rounded-xl border border-white/5 text-xs font-mono">
                  <span className="text-slate-400">Pendentes:</span>
                  <span className="text-[#f89847] font-bold">{pendingCount}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">Concluídas:</span>
                  <span className="text-emerald-400 font-bold">{completedCount}</span>
                </div>

                <button
                  onClick={() => setIsNewReminderModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #96183c, #f89847)',
                    color: '#faf0ac',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Lembrete / Tarefa</span>
                </button>
              </div>
            </div>

            {/* 2. Search & Category Filters (Orbit Style) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-[260px] max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={reminderSearch}
                    onChange={(e) => setReminderSearch(e.target.value)}
                    placeholder="Buscar tarefas por título, pauta ou tag..."
                    className="w-full pl-9 pr-3 py-2 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
                  />
                  {reminderSearch && (
                    <button
                      onClick={() => setReminderSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap bg-[#1A1C24] p-1 rounded-2xl border border-white/5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'reuniao', label: 'Reuniões' },
                  { id: 'atividade', label: 'Atividades' },
                  { id: 'plantao', label: 'Plantões' },
                  { id: 'treinamento', label: 'Treinamentos' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setReminderFilterType(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      reminderFilterType === tab.id
                        ? 'bg-white/15 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    style={reminderFilterType === tab.id ? {
                      background: 'linear-gradient(135deg, rgba(150,24,60,0.4), rgba(248,152,71,0.4))',
                      borderColor: 'rgba(248,152,71,0.5)',
                      color: '#faf0ac'
                    } : undefined}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Cards Grid in Orbit Style */}
            {filteredReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-3xl bg-[#181922]">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-sm">Nenhum lembrete ou tarefa encontrado</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm">
                  {reminderSearch ? 'Tente ajustar sua busca ou limpar os filtros.' : 'Clique em "Novo Lembrete / Tarefa" para criar seu primeiro compromisso.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReminders.map((rem) => {
                  const badge = getTypeBadge(rem.type);
                  return (
                    <div
                      key={rem.id}
                      className={`group relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                        rem.completed
                          ? 'bg-[#14151C]/60 border-white/5 opacity-70 hover:opacity-100'
                          : 'bg-[#1A1C24] border-white/10 hover:border-[#f89847]/40 hover:bg-[#1E202B] shadow-lg'
                      }`}
                    >
                      {/* Top Header Row with Type Badge and Tag */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            ● {badge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                            #{rem.tag}
                          </span>
                        </div>

                        {/* Actions: Toggle Complete & Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setReminders(prev => prev.map(r => r.id === rem.id ? { ...r, completed: !r.completed } : r));
                            }}
                            title={rem.completed ? "Marcar como pendente" : "Marcar como concluída"}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              rem.completed
                                ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-white/5'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remover "${rem.title}"?`)) {
                                setReminders(prev => prev.filter(r => r.id !== rem.id));
                              }
                            }}
                            title="Excluir lembrete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content: Title & Description */}
                      <div className="space-y-1.5 mb-4">
                        <h3 className={`font-bold text-sm tracking-tight leading-snug transition-colors ${
                          rem.completed ? 'text-slate-400 line-through' : 'text-white group-hover:text-[#faf0ac]'
                        }`}>
                          {rem.title}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                          {rem.description}
                        </p>
                      </div>

                      {/* Footer Row: Date, Time, Assignee & Meeting Link */}
                      <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 font-mono text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                            <span>{rem.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#f89847]" />
                            <span>{rem.time}</span>
                          </div>
                        </div>

                        {rem.link ? (
                          <a
                            href={rem.link}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-transform hover:scale-105 shadow-sm text-white"
                            style={{
                              background: 'linear-gradient(135deg, #059669, #10b981)',
                            }}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Acessar Chamada</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {rem.assigneeName ? `Resp: ${rem.assigneeName}` : 'Equipe Geral'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. Modal para Novo Lembrete / Tarefa (Orbit Visual Modal) */}
            {isNewReminderModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(10,11,18,0.85)', backdropFilter: 'blur(8px)' }}
                onClick={() => setIsNewReminderModalOpen(false)}
              >
                <div
                  className="relative w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col space-y-4"
                  style={{ background: '#14151C' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
                        style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-base font-bold text-white">Criar Novo Lembrete / Tarefa</h3>
                    </div>
                    <button
                      onClick={() => setIsNewReminderModalOpen(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newReminderData.title.trim()) return;
                      setReminders(prev => [
                        ...prev,
                        {
                          id: `rem-${Date.now()}`,
                          type: newReminderData.type,
                          tag: newReminderData.tag.trim() || 'Geral',
                          title: newReminderData.title.trim(),
                          description: newReminderData.description.trim() || 'Sem descrição adicional.',
                          date: newReminderData.date,
                          time: newReminderData.time,
                          link: newReminderData.link.trim() || undefined,
                          assigneeName: 'Camila Duarte',
                          completed: false,
                        }
                      ]);
                      setNewReminderData({
                        title: '',
                        description: '',
                        type: 'atividade',
                        tag: 'Geral',
                        date: '2026-09-02',
                        time: '09:00',
                        link: '',
                      });
                      setIsNewReminderModalOpen(false);
                    }}
                    className="space-y-4"
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
                        className="w-full px-3.5 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
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
                          className="w-full px-3 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#f89847] cursor-pointer"
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
                          className="w-full px-3 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
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
                          className="w-full px-3 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#f89847] cursor-pointer"
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
                          className="w-full px-3 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-[#f89847] cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        />
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
                        className="w-full px-3.5 py-2.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
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
                        className="w-full px-3.5 py-2 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors resize-none"
                      />
                    </div>

                    {/* Modal Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsNewReminderModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:scale-105 cursor-pointer"
                        style={{
                          background: 'linear-gradient(135deg, #96183c, #f89847)',
                        }}
                      >
                        Salvar Compromisso
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TAB 5: CHAT EQUIPE (ORBIT DARK IDENTITY) ─── */}
      {activeTab === 'chat' && (
        <div className="rounded-3xl border border-white/10 overflow-hidden flex flex-col animate-in fade-in duration-200"
          style={{ background: '#14151C', height: '600px' }}>

          {/* Orbit Chat Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0"
            style={{ background: '#12131A' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ background: 'linear-gradient(135deg, #96183c, #f89847)', borderRadius: '12px' }}>
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-extrabold text-sm text-white">Canal Geral · Equipe</h3>
                  <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }}>
                    ● AO VIVO
                  </span>
                  <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(248,152,71,0.15)', color: '#f89847', border: '1px solid rgba(248,152,71,0.35)' }}>
                    ORBIT CHAT
                  </span>
                </div>
                <p className="text-xs text-slate-500">Avisos rápidos, dúvidas sobre escalas e cobertura de turnos</p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4" style={{ background: '#0F1117' }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 items-start ${msg.isManager ? 'flex-row-reverse' : ''}`}>
                <img src={msg.avatar} alt={msg.senderName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                  style={{ outline: '2px solid rgba(255,255,255,0.1)' }} />
                <div className={`max-w-[75%] space-y-1 ${msg.isManager ? 'text-right' : ''}`}>
                  <div className="text-[10px] text-slate-500 font-mono">
                    <strong className="text-slate-300 font-bold">{msg.senderName}</strong> · {msg.senderRole} · {msg.time}
                  </div>
                  <div className="p-3 rounded-2xl text-xs leading-relaxed inline-block text-left"
                    style={msg.isManager
                      ? { background: 'linear-gradient(135deg, #96183c, #c0592f)', color: '#fff', borderRadius: msg.isManager ? '18px 4px 18px 18px' : '4px 18px 18px 18px' }
                      : { background: '#1A1C24', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 18px 18px 18px' }
                    }>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSendMessage}
            className="p-3 flex gap-2 border-t border-white/10 shrink-0"
            style={{ background: '#12131A' }}>
            <input
              type="text"
              value={newChatInput}
              onChange={(e) => setNewChatInput(e.target.value)}
              placeholder="Mensagem como Gestora..."
              className="flex-1 px-4 py-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              style={{ background: '#1A1C24', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <button
              type="submit"
              className="px-4 py-2.5 font-bold rounded-xl text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
