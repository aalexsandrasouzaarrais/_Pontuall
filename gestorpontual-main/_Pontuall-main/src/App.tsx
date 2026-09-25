import React, { useState } from 'react';
import { 
  EmployeeSidebar 
} from './components/EmployeeSidebar';
import { 
  EmployeeMainView 
} from './components/EmployeeMainView';
import { 
  EmployeeCalendarView 
} from './components/EmployeeCalendarView';
import { 
  ManagerView 
} from './components/ManagerView';
import { 
  ManagerRequestsModal 
} from './components/ManagerRequestsModal';
import { 
  ShiftDetailModal 
} from './components/ShiftDetailModal';
import { 
  ShiftSwapModal 
} from './components/ShiftSwapModal';
import { 
  JustificationModal 
} from './components/JustificationModal';
import { 
  NotificationsModal 
} from './components/NotificationsModal';
import { 
  ChatModal 
} from './components/ChatModal';
import { 
  INITIAL_EMPLOYEES, 
  getInitialShifts, 
  INITIAL_REQUESTS, 
  INITIAL_JUSTIFICATIONS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_REMINDERS,
  MANAGER_PROFILE
} from './data/mockData';
import { 
  Employee, 
  Shift, 
  TimeOffRequest, 
  AbsenceJustification, 
  NotificationItem 
} from './types';
import { 
  CheckCircle2, 
  Clock, 
  CalendarDays, 
  FileText, 
  ArrowLeftRight, 
  Sparkles, 
  AlertCircle,
  Plus,
  ShieldCheck,
  User,
  SlidersHorizontal,
  LayoutGrid,
  MessageSquare,
  Send,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import logoWideDark from './assets/logo-pontual-wide-dark.png';
import logoWideLight from './assets/logo-pontual-wide.png';

function AppContent() {
  const { theme, isDark, toggleTheme } = useTheme();
  // Global Role Mode: 'manager' (Visual requested in photo) vs 'employee'
  const [currentRole, setCurrentRole] = useState<'manager' | 'employee'>(() => {
    try {
      const saved = localStorage.getItem('pontual_role');
      if (saved === 'manager' || saved === 'employee') return saved;
    } catch {}
    return 'manager';
  });

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [activeEmployee, setActiveEmployee] = useState<Employee>(() => {
    try {
      const savedUserStr = localStorage.getItem('pontual_active_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        const match = INITIAL_EMPLOYEES.find(e => 
          e.id === parsed.id || 
          e.email?.toLowerCase() === parsed.email?.toLowerCase() ||
          (parsed.emailSecundario && e.email?.toLowerCase() === parsed.emailSecundario?.toLowerCase())
        );
        if (match) return match;
      }
    } catch {}
    return INITIAL_EMPLOYEES[0];
  });
  const [shifts, setShifts] = useState<Shift[]>(getInitialShifts());
  const [requests, setRequests] = useState<TimeOffRequest[]>(INITIAL_REQUESTS);
  const [justifications, setJustifications] = useState<AbsenceJustification[]>(INITIAL_JUSTIFICATIONS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  
  // Employee Tabs
  const [employeeTab, setEmployeeTab] = useState<'overview' | 'calendar' | 'requests' | 'justifications' | 'chat'>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modals state
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isManagerRequestsModalOpen, setIsManagerRequestsModalOpen] = useState(false);

  // Employee Chat State
  const [employeeChatMessages, setEmployeeChatMessages] = useState([
    {
      id: 'm-1',
      senderName: 'Camila Duarte',
      senderRole: 'Gerente de Escalas',
      senderAvatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
      isMe: false,
      text: 'Olá equipe! A escala semanal já está disponível no portal. Por favor confirmem seus horários e avisem caso haja qualquer divergência.',
      timestamp: '09:00'
    },
    {
      id: 'm-2',
      senderName: 'Lucas Silva',
      senderRole: 'Analista de Atendimento',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isMe: activeEmployee.id === 'emp-1',
      text: 'Bom dia Camila! Escala conferida e ponto batido com sucesso via GPS.',
      timestamp: '09:05'
    },
    {
      id: 'm-3',
      senderName: 'Beatriz Santos',
      senderRole: 'Especialista de Suporte',
      senderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      isMe: activeEmployee.id === 'emp-2',
      text: 'Conferido também! Qualquer dúvida aviso por aqui.',
      timestamp: '09:12'
    }
  ]);
  const [employeeChatInput, setEmployeeChatInput] = useState('');

  const handleSendEmployeeMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeChatInput.trim()) return;
    setEmployeeChatMessages(prev => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        senderName: activeEmployee.name,
        senderRole: activeEmployee.role,
        senderAvatar: activeEmployee.avatar,
        isMe: true,
        text: employeeChatInput.trim(),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setEmployeeChatInput('');
  };

  // Check-In handler for employee
  const handleCheckIn = (shiftId: string, locationData: { address: string; gpsValidated: boolean }) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return {
          ...s,
          attendanceStatus: 'present',
          checkInTime: timeStr,
          checkInLocation: {
            latitude: -23.5505,
            longitude: -46.6333,
            address: locationData.address,
            gpsValidated: locationData.gpsValidated,
          }
        };
      }
      return s;
    }));

    // Add confirmation notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Ponto Registrado com Sucesso!',
      message: `Sua presença foi confirmada às ${timeStr} na Sede Employer (GPS Validado).`,
      type: 'system',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Submit swap or time-off request
  const handleSubmitRequest = (req: Partial<TimeOffRequest>) => {
    const newRequest: TimeOffRequest = {
      id: `req-${Date.now()}`,
      employeeId: activeEmployee.id,
      employeeName: activeEmployee.name,
      employeeAvatar: activeEmployee.avatar,
      type: req.type || 'swap',
      date: req.date || new Date().toISOString().split('T')[0],
      shiftId: req.shiftId,
      targetEmployeeId: req.targetEmployeeId,
      targetEmployeeName: req.targetEmployeeName,
      reason: req.reason || '',
      status: 'pending',
      createdAt: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setRequests(prev => [newRequest, ...prev]);
    setEmployeeTab('requests');
  };

  // Submit absence justification
  const handleSubmitJustification = (just: Partial<AbsenceJustification>) => {
    const newJust: AbsenceJustification = {
      id: `just-${Date.now()}`,
      employeeId: activeEmployee.id,
      employeeName: activeEmployee.name,
      employeeAvatar: activeEmployee.avatar,
      shiftId: just.shiftId || '',
      date: just.date || new Date().toISOString().split('T')[0],
      reason: just.reason || '',
      documentName: just.documentName,
      documentType: just.documentType,
      status: 'pending',
      submittedAt: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setJustifications(prev => [newJust, ...prev]);
    
    if (just.shiftId) {
      setShifts(prev => prev.map(s => s.id === just.shiftId ? { ...s, attendanceStatus: 'justified' } : s));
    }

    setEmployeeTab('justifications');
  };

  // Manager Actions
  const handleAddShift = (newShiftData: Partial<Shift>) => {
    const created: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: newShiftData.employeeId || employees[0]?.id || 'emp-1',
      date: newShiftData.date || new Date().toISOString().split('T')[0],
      startTime: newShiftData.startTime || '08:00',
      endTime: newShiftData.endTime || '17:00',
      breakMinutes: newShiftData.breakMinutes || 60,
      status: 'published',
      attendanceStatus: 'pending',
      type: newShiftData.type || 'regular',
      title: newShiftData.title || 'Turno de Trabalho',
    };
    setShifts(prev => [...prev, created]);
  };

  const handleUpdateShift = (updated: Shift, notifyEmployee: boolean = true, changeReason?: string) => {
    const prevShift = shifts.find(s => s.id === updated.id);
    setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));

    if ((notifyEmployee || (prevShift && prevShift.status === 'published')) && updated.status === 'published') {
      const emp = employees.find(e => e.id === updated.employeeId);
      const empName = emp?.name || 'Colaborador';
      const reasonMsg = changeReason?.trim() ? ` Motivo: "${changeReason.trim()}".` : '';
      
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: 'Escala Alterada pelo Gestor',
        message: `Atenção: A escala de ${empName} no dia ${updated.date} foi alterada para ${updated.startTime} às ${updated.endTime} (${updated.title || 'Turno'}).${reasonMsg} Por favor, verifique seus novos horários.`,
        type: 'shift_change',
        timestamp: 'Agora',
        read: false,
        actionRequired: true,
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const handleDeleteShift = (shiftId: string) => {
    setShifts(prev => prev.filter(s => s.id !== shiftId));
  };

  const handleApproveRequest = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', managerNotes: 'Aprovado pelo gestor' } : r));
  };

  const handleRejectRequest = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', managerNotes: 'Recusado pelo gestor' } : r));
  };

  const handleApproveJustification = (id: string) => {
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'approved', managerNotes: 'Homologado pelo RH' } : j));
  };

  const handleRejectJustification = (id: string) => {
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'rejected', managerNotes: 'Não homologado' } : j));
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('pontual_active_user');
      localStorage.removeItem('pontual_role');
    } catch {}

    const currentPath = window.location.pathname.replace(/\\/g, '/');
    if (currentPath.includes('/_Pontuall-main/')) {
      window.location.href = '../Login_Pontual/Login-Pontual-v1-main/login2.html';
    } else {
      window.location.href = './Login_Pontual/Login-Pontual-v1-main/login2.html';
    }
  };

  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees(prev => [...prev, newEmp]);
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Novo Colaborador Cadastrado',
      message: `${newEmp.name} foi adicionado(a) à equipe (${newEmp.role} - ${newEmp.contractType || 'CLT'}).`,
      type: 'system',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleOpenShiftDetails = (shift: Shift) => {
    setSelectedShiftForDetail(shift);
    setIsDetailModalOpen(true);
  };

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length + justifications.filter(j => j.status === 'pending').length;
  const myRequests = requests.filter(r => r.employeeId === activeEmployee.id || r.targetEmployeeId === activeEmployee.id);
  const myJustifications = justifications.filter(j => j.employeeId === activeEmployee.id);

  const isManagerLight = currentRole === 'manager' && !isDark;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-[#BBF7D0] selection:text-[#166534] ${
      isManagerLight ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#0B0B0E] text-slate-100'
    }`}>
      
      {/* Top Global Header Bar — Design moderno com suporte para Gestor e Colaborador */}
      <header className={`backdrop-blur-xl border-b px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs sticky top-0 z-50 shadow-md transition-colors ${
        !isDark ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#0D0F15]/95 border-[#222634]/80 text-white'
      }`}>
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <img
            src={!isDark ? logoWideDark : logoWideLight}
            alt="Pontual"
            className="h-6 sm:h-7 w-auto object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="${!isDark ? 'text-slate-900' : 'text-white'} font-extrabold text-sm tracking-tight">Pontual</span>`;
              }
            }}
          />
        </div>

        {/* Center/Right: Switcher de Perfil + Botão de Tema */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Switcher Pill de Perfil */}
          <div className={`flex items-center gap-1.5 p-1 rounded-full border transition-colors ${
            !isDark ? 'bg-slate-100 border-slate-200' : 'bg-[#151822] border-[#252A3A]'
          }`}>
            <button
              onClick={() => {
                setCurrentRole('manager');
                localStorage.setItem('pontual_role', 'manager');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'manager'
                  ? 'text-white shadow-md font-black'
                  : !isDark ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              style={currentRole === 'manager' ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : {}}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>👔 Visão do Gestor</span>
            </button>

            <button
              onClick={() => {
                setCurrentRole('employee');
                localStorage.setItem('pontual_role', 'employee');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'employee'
                  ? 'text-white shadow-md font-black'
                  : !isDark ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              style={currentRole === 'employee' ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : {}}
            >
              <User className="w-3.5 h-3.5" />
              <span>👤 Portal do Colaborador</span>
            </button>
          </div>

          {/* Botão de Tema Moderno (Claro / Escuro) ativo tanto para Gestor quanto para Colaborador */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            title={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                : 'border-[#252A3A] bg-[#151822] text-slate-300 hover:text-white hover:bg-[#96183c] hover:border-[#96183c]'
            }`}
          >
            {!isDark ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
            <span className="hidden sm:inline font-semibold">
              {!isDark ? 'Escuro' : 'Claro'}
            </span>
          </button>

          {/* Botão Sair / Logout para retornar ao Login */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair da conta e voltar ao Login"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                : 'border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Sair</span>
          </button>
        </div>
      </header>

      {/* RENDER VIEW ACCORDING TO ROLE */}
      {currentRole === 'manager' ? (
        /* MANAGER VIEW (Full screen width) */
        <div className={`flex-1 w-full flex flex-col min-h-0 manager-scope ${theme}`}>
          <ManagerView
            employees={employees}
            shifts={shifts}
            activeEmployee={activeEmployee}
            notificationsCount={notifications.filter(n => !n.read).length}
            onAddShift={handleAddShift}
            onUpdateShift={handleUpdateShift}
            onDeleteShift={handleDeleteShift}
            onAddEmployee={handleAddEmployee}
            onOpenRequests={() => setIsManagerRequestsModalOpen(true)}
            onOpenChat={() => setIsChatModalOpen(true)}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            onSwitchToEmployee={() => setCurrentRole('employee')}
            pendingRequestsCount={pendingRequestsCount}
          />
        </div>
      ) : (
        /* EMPLOYEE VIEW */
        <div className={`flex-1 flex overflow-hidden ${(employeeTab === 'requests' || employeeTab === 'justifications') ? (!isDark ? 'bg-[#f4f5f8]' : 'colaborador-page-container') : (!isDark ? 'bg-[#f4f5f8]' : 'bg-[#050104]')}`}>
          {/* Full-height Collapsible Sidebar */}
          <EmployeeSidebar
            activeTab={employeeTab}
            onTabChange={(tab) => {
              if (tab === 'chat') {
                setIsChatModalOpen(true);
              } else {
                setEmployeeTab(tab);
              }
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            activeEmployee={activeEmployee}
            employees={employees}
            onSelectEmployee={setActiveEmployee}
            notifications={notifications}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            isLightTheme={!isDark}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative">
            {/* Tab 1: Overview & Digital Punch Clock */}
            {employeeTab === 'overview' && (
              <EmployeeMainView
                employee={activeEmployee}
                shifts={shifts}
                reminders={INITIAL_REMINDERS}
                onCheckIn={handleCheckIn}
                onNavigateToCalendar={() => setEmployeeTab('calendar')}
                onNavigateToRequests={() => setEmployeeTab('requests')}
                onNavigateToJustifications={() => setEmployeeTab('justifications')}
                onShiftClick={handleOpenShiftDetails}
                isLightTheme={!isDark}
              />
            )}

            {/* Tab 2: Monthly / Weekly Calendar */}
            {employeeTab === 'calendar' && (
              <EmployeeCalendarView
                employee={activeEmployee}
                shifts={shifts}
                onShiftClick={handleOpenShiftDetails}
                onRequestTimeOff={() => setIsSwapModalOpen(true)}
                onSendJustification={() => setIsJustificationModalOpen(true)}
                isLightTheme={!isDark}
              />
            )}

            {/* Tab 3: Time Off & Swaps */}
            {employeeTab === 'requests' && (
              <div
                className={`relative z-10 space-y-4 transition-colors duration-300 ${
                  !isDark ? 'text-slate-800' : 'text-white'
                }`}
              >
                {/* Modern Dashboard Banner */}
                <div
                  className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
                    !isDark
                      ? 'border-slate-200 bg-white shadow-slate-200/60'
                      : 'border-white/10 bg-[#0b0b0e]'
                  }`}
                  style={
                    !isDark
                      ? {
                          background:
                            'radial-gradient(ellipse 95% 130% at 95% 50%, rgba(150, 24, 60, 0.35) 0%, rgba(248, 150, 66, 0.23) 40%, rgba(255, 240, 172, 0.14) 65%, rgba(255, 255, 255, 0) 90%), #ffffff',
                        }
                      : {
                          background:
                            'radial-gradient(ellipse 75% 100% at 95% 50%, rgba(150, 24, 60, 0.40) 0%, rgba(248, 150, 66, 0.16) 45%, rgba(11, 11, 14, 0) 75%), #0b0b0e',
                        }
                  }
                >
                  <div className="relative z-10 space-y-2">
                    {/* Tag Superior */}
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md transition-colors duration-300 ${
                        !isDark
                          ? 'bg-slate-100 border border-slate-200'
                          : 'bg-white/[0.05] border border-white/10'
                      }`}
                    >
                      <ArrowLeftRight
                        className={`w-3.5 h-3.5 ${
                          !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold tracking-wider uppercase ${
                          !isDark ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        Solicitações & Escalas
                      </span>
                    </div>

                    {/* Título */}
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      <span className={`block ${!isDark ? 'text-slate-900' : 'text-white'}`}>
                        Minhas Solicitações
                      </span>
                      <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
                        de Folga e Troca de Turno
                      </span>
                    </h2>

                    {/* Subtítulo */}
                    <p
                      className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
                        !isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Acompanhe o status dos seus pedidos enviados para a gestão
                    </p>
                  </div>

                  {/* Botão Nova Solicitação */}
                  <button
                    type="button"
                    onClick={() => setIsSwapModalOpen(true)}
                    className="relative z-10 shrink-0 self-start md:self-center px-6 py-3 rounded-full bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#96183c]/25 hover:shadow-[#96183c]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Nova Solicitação</span>
                  </button>
                </div>

                {/* Lista */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myRequests.length === 0 ? (
                    <div
                      className={`md:col-span-2 p-8 rounded-xl border text-center text-xs transition-all duration-300 ${
                        !isDark
                          ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                          : 'bg-[#0d0d10] border-white/10 text-slate-400'
                      }`}
                    >
                      Você ainda não possui solicitações de folga ou troca cadastradas.
                    </div>
                  ) : (
                    myRequests.map(req => (
                      <div
                        key={req.id}
                        className={`relative rounded-xl border overflow-hidden shadow-lg flex flex-col transition-all duration-300 ${
                          !isDark
                            ? 'bg-white border-slate-200 shadow-slate-200/60'
                            : 'bg-[#0d0d10] border-white/10'
                        }`}
                        style={{
                          borderLeft: `3px solid ${
                            req.type === 'swap' ? '#f89642' : '#96183c'
                          }`,
                        }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                                req.type === 'swap'
                                  ? !isDark
                                    ? 'bg-orange-50 text-orange-600 border border-orange-200'
                                    : 'bg-[#f89642]/15 text-[#f89642] border border-[#f89642]/30'
                                  : !isDark
                                  ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                                  : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                              }`}
                            >
                              {req.type === 'swap'
                                ? 'Troca de Turno'
                                : 'Folga Compensatória'}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                req.status === 'approved'
                                  ? !isDark
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : req.status === 'rejected'
                                  ? !isDark
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : !isDark
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  req.status === 'approved'
                                    ? 'bg-emerald-400'
                                    : req.status === 'rejected'
                                    ? 'bg-rose-400'
                                    : 'bg-amber-300'
                                }`}
                              />
                              {req.status === 'approved'
                                ? 'Aprovado'
                                : req.status === 'rejected'
                                ? 'Rejeitado'
                                : 'Em Análise'}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                              !isDark
                                ? 'text-slate-500 bg-slate-100 border border-slate-200'
                                : 'text-slate-400 bg-white/5 border border-white/10'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            {req.date}
                          </div>
                        </div>

                        <div
                          className={`mx-4 border-t ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        />

                        <div className="px-4 py-3 flex-1 space-y-2">
                          {req.targetEmployeeName && (
                            <div
                              className={`flex items-center gap-2 text-[11px] ${
                                !isDark ? 'text-slate-600' : 'text-slate-300'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 text-[#f89642] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                              <span>
                                Troca com{' '}
                                <strong className={!isDark ? 'text-slate-900' : 'text-white'}>
                                  {req.targetEmployeeName}
                                </strong>
                              </span>
                            </div>
                          )}

                          <p
                            className={`text-xs leading-relaxed line-clamp-3 ${
                              !isDark ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            "{req.reason}"
                          </p>
                        </div>

                        <div
                          className={`px-4 pb-3 flex items-center justify-between gap-2 border-t pt-2 ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-mono ${
                              !isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Enviado: {req.createdAt}
                          </span>

                          {req.managerNotes && (
                            <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              {req.managerNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Justifications & Medical Notes */}
            {employeeTab === 'justifications' && (
              <div
                className={`relative z-10 space-y-4 transition-colors duration-300 ${
                  !isDark ? 'text-slate-800' : 'text-white'
                }`}
              >
                {/* Modern Dashboard Banner */}
                <div
                  className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
                    !isDark
                      ? 'border-slate-200 bg-white shadow-slate-200/60'
                      : 'border-white/10 bg-[#0b0b0e]'
                  }`}
                  style={
                    !isDark
                      ? {
                          background:
                            'radial-gradient(ellipse 95% 130% at 95% 50%, rgba(150, 24, 60, 0.35) 0%, rgba(248, 150, 66, 0.23) 40%, rgba(255, 240, 172, 0.14) 65%, rgba(255, 255, 255, 0) 90%), #ffffff',
                        }
                      : {
                          background:
                            'radial-gradient(ellipse 75% 100% at 95% 50%, rgba(150, 24, 60, 0.40) 0%, rgba(248, 150, 66, 0.16) 45%, rgba(11, 11, 14, 0) 75%), #0b0b0e',
                        }
                  }
                >
                  <div className="relative z-10 space-y-2">
                    {/* Tag Superior */}
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md transition-colors duration-300 ${
                        !isDark
                          ? 'bg-slate-100 border border-slate-200'
                          : 'bg-white/[0.05] border border-white/10'
                      }`}
                    >
                      <FileText
                        className={`w-3.5 h-3.5 ${
                          !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold tracking-wider uppercase ${
                          !isDark ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        Atestados & Abonos
                      </span>
                    </div>

                    {/* Título */}
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      <span className={`block ${!isDark ? 'text-slate-900' : 'text-white'}`}>
                        Atestados Médicos
                      </span>
                      <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
                        & Justificativas de Ausência
                      </span>
                    </h2>

                    {/* Subtítulo */}
                    <p
                      className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
                        !isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Comprovantes enviados para abono e auditoria de ponto
                    </p>
                  </div>

                  {/* Botão Enviar Novo Atestado */}
                  <button
                    type="button"
                    onClick={() => setIsJustificationModalOpen(true)}
                    className="relative z-10 shrink-0 self-start md:self-center px-6 py-3 rounded-full bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#96183c]/25 hover:shadow-[#96183c]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Enviar Novo Atestado</span>
                  </button>
                </div>

                {/* Lista */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myJustifications.length === 0 ? (
                    <div
                      className={`md:col-span-2 p-8 rounded-xl border text-center text-xs transition-all duration-300 ${
                        !isDark
                          ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                          : 'bg-[#0d0d10] border-white/10 text-slate-400'
                      }`}
                    >
                      Nenhuma justificativa ou atestado registrado para este perfil.
                    </div>
                  ) : (
                    myJustifications.map(just => (
                      <div
                        key={just.id}
                        className={`relative rounded-xl border overflow-hidden shadow-lg flex flex-col transition-all duration-300 ${
                          !isDark
                            ? 'bg-white border-slate-200 shadow-slate-200/60'
                            : 'bg-[#0d0d10] border-white/10'
                        }`}
                        style={{
                          borderLeft: '3px solid #96183c',
                        }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                                !isDark
                                  ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                                  : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                              }`}
                            >
                              📄 Atestado / Declaração
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                just.status === 'approved'
                                  ? !isDark
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : just.status === 'rejected'
                                  ? !isDark
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : !isDark
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  just.status === 'approved'
                                    ? 'bg-emerald-400'
                                    : just.status === 'rejected'
                                    ? 'bg-rose-400'
                                    : 'bg-amber-300'
                                }`}
                              />
                              {just.status === 'approved'
                                ? 'Homologado'
                                : just.status === 'rejected'
                                ? 'Recusado'
                                : 'Em Análise pelo RH'}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                              !isDark
                                ? 'text-slate-500 bg-slate-100 border border-slate-200'
                                : 'text-slate-400 bg-white/5 border border-white/10'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            {just.date}
                          </div>
                        </div>

                        <div
                          className={`mx-4 border-t ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        />

                        <div className="px-4 py-3 flex-1 space-y-2">
                          <p
                            className={`text-xs leading-relaxed line-clamp-3 ${
                              !isDark ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            "{just.reason}"
                          </p>

                          {just.documentName && (
                            <div
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                                !isDark
                                  ? 'bg-rose-50 border border-rose-200'
                                  : 'bg-[#96183c]/10 border border-[#96183c]/25'
                              }`}
                            >
                              <FileText
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                                }`}
                              />
                              <span
                                className={`text-[11px] font-semibold truncate ${
                                  !isDark ? 'text-[#96183c]' : 'text-[#faf0ac]'
                                }`}
                              >
                                {just.documentName}
                              </span>
                            </div>
                          )}
                        </div>

                        <div
                          className={`px-4 pb-3 border-t pt-2 ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-mono ${
                              !isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Enviado: {just.submittedAt}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Chat da Equipe */}
            {employeeTab === 'chat' && (
              <div className="space-y-4">
                {/* Header card matching requests & justifications tabs */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#166534]" />
                      Chat da Equipe & Gestão
                    </h2>
                    <p className="text-xs text-slate-500">
                      Canal corporativo em tempo real para alinhamento com a gestão e colegas de escala
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      5 Membros Online
                    </span>
                  </div>
                </div>

                {/* Main Chat Box matching employee portal design */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[580px]">
                  {/* Channel bar / quick topic */}
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-extrabold text-slate-900"># Canal Geral da Equipe</span>
                      <span className="text-[10px] text-slate-500">• Todos os colaboradores e gestores</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Sincronizado via Web</span>
                  </div>

                  {/* Message feed */}
                  <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-slate-50/50">
                    {employeeChatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <img
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                        />
                        <div className={`max-w-[75%] rounded-2xl p-3 text-xs shadow-xs ${
                          msg.isMe 
                            ? 'bg-[#166534] text-white rounded-tr-none' 
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`font-bold text-[11px] ${msg.isMe ? 'text-emerald-100' : 'text-slate-900'}`}>
                              {msg.senderName}
                            </span>
                            <span className={`text-[9px] font-mono ${msg.isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                              {msg.timestamp}
                            </span>
                          </div>
                          <p className="leading-relaxed text-xs">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick suggestion chips */}
                  <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                      Respostas rápidas:
                    </span>
                    {[
                      '✅ Ponto conferido e presença confirmada!',
                      '🔄 Gostaria de solicitar troca de turno',
                      '❓ Dúvida sobre meu plantão de sábado',
                      '📍 Chegando no posto de atendimento'
                    ].map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEmployeeChatInput(sug)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-[10px] text-slate-700 whitespace-nowrap transition-colors cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendEmployeeMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                    <input
                      type="text"
                      value={employeeChatInput}
                      onChange={(e) => setEmployeeChatInput(e.target.value)}
                      placeholder="Digite uma mensagem para a equipe ou coordenação..."
                      className="flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-600 focus:bg-white rounded-lg px-3.5 py-2.5 text-xs text-slate-800 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!employeeChatInput.trim()}
                      className="px-4 py-2.5 bg-[#166534] hover:bg-emerald-800 disabled:opacity-40 text-[#BBF7D0] rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

          </main>
        </div>
      )}

      {/* Modals */}
      <ManagerRequestsModal
        isOpen={isManagerRequestsModalOpen}
        onClose={() => setIsManagerRequestsModalOpen(false)}
        requests={requests}
        justifications={justifications}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onApproveJustification={handleApproveJustification}
        onRejectJustification={handleRejectJustification}
      />

      <ShiftDetailModal
        shift={selectedShiftForDetail}
        employees={employees}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedShiftForDetail(null);
        }}
        isLightTheme={!isDark}
      />

      <ShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentEmployee={activeEmployee}
        employees={employees}
        myShifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitRequest={handleSubmitRequest}
        isLightTheme={!isDark}
      />

      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => setIsJustificationModalOpen(false)}
        currentEmployee={activeEmployee}
        shifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitJustification={handleSubmitJustification}
        isLightTheme={!isDark}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        isLightTheme={!isDark}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        currentEmployee={activeEmployee}
        isLightTheme={!isDark}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
