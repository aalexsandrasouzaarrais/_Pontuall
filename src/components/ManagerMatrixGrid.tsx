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
  ArrowRightLeft
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

  // Tab 4 (Tarefas) State
  const [reminders, setReminders] = useState([
    {
      id: 'rem-1',
      type: 'reuniao',
      tag: '#Metas Corporativas',
      title: 'Alinhamento Semanal de Metas Q3',
      description: 'Revisão dos indicadores de NPS e tempo de resposta da equipe.',
      date: '2026-08-28',
      time: '14:00',
      link: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'rem-2',
      type: 'atividade',
      tag: '#Gestão de Escalas',
      title: 'Publicar Escala de Setembro',
      description: 'Validar solicitações de folga antes do fechamento do mês.',
      date: '2026-08-29',
      time: '16:30',
    }
  ]);

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

  return (
    <div className="w-full bg-[#f8fafc] text-slate-900 rounded-3xl p-3 sm:p-5 shadow-2xl border border-slate-200 font-sans space-y-4 select-none">
      
      {/* 1. STICKY TOP HEADER CARD (Painel de Gestão de Escalas GESTOR + Abas Superiores) */}
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

      {/* ─── TAB 2: APROVAÇÕES & FALTAS (EXATAMENTE COMO NA FOTO 2) ─── */}
      {activeTab === 'aprovacoes' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Central de Solicitações & Justificativas
              </h2>
              <p className="text-xs text-slate-500">
                Gerencie pedidos de folga, trocas de turnos entre colegas e atestados médicos
              </p>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setApprovalsSubTab('trocas')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  approvalsSubTab === 'trocas'
                    ? 'bg-purple-700 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Folgas & Trocas</span>
                <span className="w-4 h-4 rounded-full bg-purple-900 text-white text-[9px] flex items-center justify-center font-mono">2</span>
              </button>

              <button
                onClick={() => setApprovalsSubTab('atestados')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  approvalsSubTab === 'atestados'
                    ? 'bg-purple-700 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Justificativas & Atestados</span>
                <span className="w-4 h-4 rounded-full bg-slate-300 text-slate-800 text-[9px] flex items-center justify-center font-mono">2</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-mono font-extrabold text-amber-600 uppercase tracking-wider block">
              ● SOLICITAÇÕES AGUARDANDO DECISÃO ({requestsList.filter(r => r.status === 'pending').length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requestsList.filter(r => r.status === 'pending').map((req) => (
                <div key={req.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 relative shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img src={req.employeeAvatar} alt={req.employeeName} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200" />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-900">{req.employeeName}</span>
                        <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                          {req.type === 'swap' ? 'Troca de Turno' : 'Pedido de Folga'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{req.createdAt}</span>
                  </div>

                  <div className="bg-purple-50/50 p-2.5 rounded-xl text-xs space-y-1 border border-purple-100 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Data:</span>
                      <span className="font-bold text-slate-900">{req.date}</span>
                    </div>
                    {req.targetEmployeeName && (
                      <div className="flex justify-between text-purple-800">
                        <span>Cobrirá:</span>
                        <span className="font-bold">{req.targetEmployeeName}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 italic bg-white p-2.5 rounded-xl border border-slate-200">
                    MOTIVO: "{req.reason}"
                  </div>

                  <input
                    type="text"
                    placeholder="Observação para o colaborador (opcional)..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-purple-500"
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="py-2 px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Recusar
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req.id)}
                      className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar Pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-xs font-mono font-extrabold text-slate-500 uppercase tracking-wider block">HISTÓRICO JULGADO</span>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" alt="Rafael Mendes" className="w-7 h-7 rounded-full object-cover" />
                <span className="font-bold text-slate-900">Rafael Mendes · <span className="font-mono text-slate-500">Folga · 2026-08-21</span></span>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Aprovado
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: RELATÓRIO PRESENÇAS (EXATAMENTE COMO NA FOTO 3) ─── */}
      {activeTab === 'relatorios' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">TAXA DE ASSIDUIDADE</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 font-mono">89%</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">↗ Comparecimento geral</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">PRESENÇAS CONFIRMADAS</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700 font-mono">7</span>
                <span className="text-xs font-bold text-slate-500 font-mono">56h trabalhadas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">FALTAS NÃO JUSTIFICADAS</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-600 font-mono">1</span>
                <span className="text-[10px] text-slate-500 font-mono">1 justificada c/ atestado</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block">TOTAL NA ESCALA</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-700 font-mono">19</span>
                <span className="text-[10px] text-slate-500 font-mono">6 colaboradores ativos</span>
              </div>
            </div>
          </div>

          {/* Filter Bar & Export */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={relatorioSearch}
                  onChange={(e) => setRelatorioSearch(e.target.value)}
                  placeholder="Filtrar por nome ou setor..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <select
                value={relatorioStatus}
                onChange={(e) => setRelatorioStatus(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="present">Presente</option>
                <option value="absent">Ausente</option>
                <option value="justified">Justificado</option>
              </select>

              <select
                value={relatorioDept}
                onChange={(e) => setRelatorioDept(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl outline-none"
              >
                <option value="all">Todos os Departamentos</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <button
              onClick={onExportCsv}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 font-mono"
            >
              <Download className="w-4 h-4" /> Exportar Planilha (19)
            </button>
          </div>

          {/* Tabela Analítica Completa */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase">
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
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {[
                  { date: '2026-08-31', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: 'Realizar triagem das filas de espera prioritárias.' },
                  { date: '2026-08-31', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Presente', type: 'Reunião', obs: 'Apresentar métricas de SLA do suporte do mês anterior.' },
                  { date: '2026-08-31', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-08-31', name: 'Mariana Costa', role: 'Consultora de Vendas', dept: 'Comercial', time: '08:30 – 17:30', hours: '8h', status: 'Justificado', type: 'Regular', obs: 'Consulta médica agendada no período matutino - Atestado enviado.' },
                  { date: '2026-09-01', name: 'Lucas Silva', role: 'Analista de Atendimento', dept: 'Atendimento', time: '08:00 – 17:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                  { date: '2026-09-01', name: 'Beatriz Santos', role: 'Especialista de Suporte', dept: 'Suporte Técnico', time: '09:00 – 18:00', hours: '8h', status: 'Ausente', type: 'Regular', obs: 'Não compareceu ao turno (No-show registrado pelo sistema)' },
                  { date: '2026-09-01', name: 'Rafael Mendes', role: 'Operador de Escala', dept: 'Operações', time: '07:00 – 16:00', hours: '8h', status: 'Presente', type: 'Regular', obs: '—' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-[11px]">{row.date}</td>
                    <td className="p-3 font-bold text-slate-900">
                      {row.name}
                      <span className="block text-[10px] text-slate-500 font-normal">{row.role}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-600 text-[11px]">{row.dept}</td>
                    <td className="p-3 font-mono text-[11px]">{row.time}</td>
                    <td className="p-3 font-mono font-bold">{row.hours}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono inline-flex items-center gap-1 ${
                        row.status === 'Presente' ? 'bg-emerald-100 text-emerald-800' :
                        row.status === 'Ausente' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{row.type}</td>
                    <td className="p-3 text-slate-500 italic text-[11px]">{row.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: LEMBRETES & TAREFAS (EXATAMENTE COMO NA FOTO 4) ─── */}
      {activeTab === 'tarefas' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Lembretes, Reuniões & Compromissos da Gestão
              </h2>
              <p className="text-xs text-slate-500">
                Agende pautas, links de chamadas virtuais e atividades para a equipe
              </p>
            </div>

            <button
              onClick={() => {
                const title = prompt('Título do Lembrete/Reunião:');
                if (title) {
                  setReminders(prev => [
                    ...prev,
                    {
                      id: `rem-${Date.now()}`,
                      type: 'atividade',
                      tag: '#Gestão',
                      title,
                      description: 'Nova atividade adicionada pela Gestão.',
                      date: '2026-09-02',
                      time: '17:00',
                    }
                  ]);
                }
              }}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 font-mono"
            >
              <Plus className="w-4 h-4" /> Novo Lembrete / Reunião
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reminders.map((rem) => (
              <div key={rem.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 relative shadow-2xs hover:border-purple-300 transition-all">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-extrabold font-mono uppercase px-2 py-0.5 rounded-full ${
                    rem.type === 'reuniao' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    ● {rem.type.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{rem.tag}</span>
                </div>

                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">{rem.title}</h3>
                <p className="text-xs text-slate-600">{rem.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs text-slate-500 font-mono">
                  <div className="flex items-center gap-3">
                    <span>📅 {rem.date}</span>
                    <span>🕒 {rem.time}</span>
                  </div>

                  {rem.link && (
                    <a href={rem.link} target="_blank" rel="noreferrer" className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1">
                      <Video className="w-3 h-3" /> Abrir Link
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 5: CHAT EQUIPE (EXATAMENTE COMO NA FOTO 5) ─── */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[560px] animate-in fade-in duration-200">
          <div className="bg-[#1C1A3E] text-white p-4 flex items-center justify-between border-b border-purple-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>Canal Geral de Escalas & Equipe</span>
                  <span className="text-[9px] bg-emerald-500 text-slate-950 font-mono font-black px-1.5 py-0.2 rounded-full">● AO VIVO</span>
                </h3>
                <p className="text-xs text-slate-300">Avisos rápidos, dúvidas sobre escalas e cobertura de turnos</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg">Módulo Chat</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 items-start ${msg.isManager ? 'flex-row-reverse' : ''}`}>
                <img src={msg.avatar} alt={msg.senderName} className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-slate-200" />
                <div className={`max-w-[75%] space-y-1 ${msg.isManager ? 'text-right' : ''}`}>
                  <div className="text-[10px] text-slate-500 font-mono">
                    <strong className="text-slate-900 font-bold">{msg.senderName}</strong> · {msg.senderRole} · {msg.time}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed inline-block text-left ${
                    msg.isManager ? 'bg-purple-700 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={newChatInput}
              onChange={(e) => setNewChatInput(e.target.value)}
              placeholder="Mensagem como Gestora..."
              className="flex-1 p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs outline-none focus:border-purple-600 text-slate-900"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
