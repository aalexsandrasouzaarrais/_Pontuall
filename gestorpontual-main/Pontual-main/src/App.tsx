import React, { useState, useEffect } from 'react';
import {
  EmployeeSidebar,
} from './components/EmployeeSidebar';
import { 
  EmployeeMainView 
} from './components/EmployeeMainView';
import { 
  EmployeeCalendarView 
} from './components/EmployeeCalendarView';
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
  INITIAL_REMINDERS
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
  Sun,
  Moon
} from 'lucide-react';

export function App() {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [isLightTheme]);

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [activeEmployee, setActiveEmployee] = useState<Employee>(INITIAL_EMPLOYEES[0]);
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

  const handleOpenShiftDetails = (shift: Shift) => {
    setSelectedShiftForDetail(shift);
    setIsDetailModalOpen(true);
  };

  const myRequests = requests.filter(r => r.employeeId === activeEmployee.id || r.targetEmployeeId === activeEmployee.id);
  const myJustifications = justifications.filter(j => j.employeeId === activeEmployee.id);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans selection:bg-[#BBF7D0] selection:text-[#166534] ${
        isLightTheme ? 'theme-light' : 'bg-[#0B0B0E]'
      }`}
    >
      
      {/* Top Global Header Bar */}
      <header className={`backdrop-blur-xl border-b px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs sticky top-0 z-50 shadow-md transition-colors ${
        isLightTheme ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#0D0F15]/95 border-[#222634]/80 text-white'
      }`}>
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <img
            src={isLightTheme ? "/logo-pontual-wide-dark.png" : "/logo-pontual-wide.png"}
            alt="Pontual"
            className="h-6 sm:h-7 w-auto object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="${isLightTheme ? 'text-slate-900' : 'text-white'} font-extrabold text-sm tracking-tight">Pontual</span>`;
              }
            }}
          />
        </div>

        {/* Right Section: Botão de Tema no canto direito */}
        <div className="flex items-center ml-auto">
          {/* Botão para alternar tema */}
          <button
            type="button"
            onClick={() => setIsLightTheme(prev => !prev)}
            aria-label={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
            title={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              isLightTheme
                ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                : 'border-[#252A3A] bg-[#151822] text-slate-300 hover:text-white hover:bg-[#96183c] hover:border-[#96183c]'
            }`}
          >
            {isLightTheme ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
            <span className="hidden sm:inline font-semibold">
              {isLightTheme ? 'Escuro' : 'Claro'}
            </span>
          </button>
        </div>
      </header>

      {/* EMPLOYEE VIEW */}
      <div className={`flex-1 flex overflow-hidden ${(employeeTab === 'requests' || employeeTab === 'justifications') ? (isLightTheme ? 'bg-[#f5f6f8]' : 'colaborador-page-container') : (isLightTheme ? 'bg-[#f5f6f8]' : 'bg-[#050104]')}`}>
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
            isLightTheme={isLightTheme}
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
                isLightTheme={isLightTheme}
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
                isLightTheme={isLightTheme}
              />
            )}

           
{/* Tab 3: Time Off & Swaps */}
{employeeTab === 'requests' && (
  <div
    className={`relative z-10 space-y-4 transition-colors duration-300 ${
      isLightTheme ? 'text-slate-800' : 'text-white'
    }`}
  >
    {/* Modern Dashboard Banner */}
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
        isLightTheme
          ? 'border-slate-200 bg-white shadow-slate-200/60'
          : 'border-white/10 bg-[#0b0b0e]'
      }`}
      style={
  isLightTheme
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
            isLightTheme
              ? 'bg-slate-100 border border-slate-200'
              : 'bg-white/[0.05] border border-white/10'
          }`}
        >
          <ArrowLeftRight
            className={`w-3.5 h-3.5 ${
              isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'
            }`}
          />

          <span
            className={`text-[11px] font-bold tracking-wider uppercase ${
              isLightTheme ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            Solicitações & Escalas
          </span>
        </div>

        {/* Título */}
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">

          <span
            className={`block ${
              isLightTheme ? 'text-slate-900' : 'text-white'
            }`}
          >
            Minhas Solicitações
          </span>

          <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
            de Folga e Troca de Turno
          </span>

        </h2>

        {/* Subtítulo */}
        <p
          className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
            isLightTheme ? 'text-slate-500' : 'text-slate-400'
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
            isLightTheme
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
              isLightTheme
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

                {/* Tipo */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                    req.type === 'swap'
                      ? isLightTheme
                        ? 'bg-orange-50 text-orange-600 border border-orange-200'
                        : 'bg-[#f89642]/15 text-[#f89642] border border-[#f89642]/30'
                      : isLightTheme
                      ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                      : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                  }`}
                >
                  {req.type === 'swap'
                    ? 'Troca de Turno'
                    : 'Folga Compensatória'}
                </span>

                {/* Status */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                    req.status === 'approved'
                      ? isLightTheme
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : req.status === 'rejected'
                      ? isLightTheme
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : isLightTheme
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

              {/* Data */}
              <div
                className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                  isLightTheme
                    ? 'text-slate-500 bg-slate-100 border border-slate-200'
                    : 'text-slate-400 bg-white/5 border border-white/10'
                }`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>

                {req.date}
              </div>

            </div>

            {/* Divider */}
            <div
              className={`mx-4 border-t ${
                isLightTheme ? 'border-slate-200' : 'border-white/5'
              }`}
            />

            {/* Body */}
            <div className="px-4 py-3 flex-1 space-y-2">

              {req.targetEmployeeName && (
                <div
                  className={`flex items-center gap-2 text-[11px] ${
                    isLightTheme ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 text-[#f89642] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>

                  <span>
                    Troca com{' '}
                    <strong
                      className={
                        isLightTheme ? 'text-slate-900' : 'text-white'
                      }
                    >
                      {req.targetEmployeeName}
                    </strong>
                  </span>
                </div>
              )}

              <p
                className={`text-xs leading-relaxed line-clamp-3 ${
                  isLightTheme ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                "{req.reason}"
              </p>

            </div>

            {/* Footer */}
            <div
              className={`px-4 pb-3 flex items-center justify-between gap-2 border-t pt-2 ${
                isLightTheme ? 'border-slate-200' : 'border-white/5'
              }`}
            >
              <span
                className={`text-[10px] font-mono ${
                  isLightTheme ? 'text-slate-400' : 'text-slate-500'
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
      isLightTheme ? 'text-slate-800' : 'text-white'
    }`}
  >
    {/* Modern Dashboard Banner */}
    <div
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
        isLightTheme
          ? 'border-slate-200 bg-white shadow-slate-200/60'
          : 'border-white/10 bg-[#0b0b0e]'
      }`}
      style={
  isLightTheme
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
            isLightTheme
              ? 'bg-slate-100 border border-slate-200'
              : 'bg-white/[0.05] border border-white/10'
          }`}
        >
          <FileText
            className={`w-3.5 h-3.5 ${
              isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'
            }`}
          />

          <span
            className={`text-[11px] font-bold tracking-wider uppercase ${
              isLightTheme ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            Atestados & Abonos
          </span>
        </div>

        {/* Título */}
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">

          <span
            className={`block ${
              isLightTheme ? 'text-slate-900' : 'text-white'
            }`}
          >
            Atestados Médicos
          </span>

          <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
            & Justificativas de Ausência
          </span>

        </h2>

        {/* Subtítulo */}
        <p
          className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
            isLightTheme ? 'text-slate-500' : 'text-slate-400'
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
            isLightTheme
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
              isLightTheme
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

                {/* Tipo badge */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                    isLightTheme
                      ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                      : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                  }`}
                >
                  📄 Atestado / Declaração
                </span>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                    just.status === 'approved'
                      ? isLightTheme
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : just.status === 'rejected'
                      ? isLightTheme
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : isLightTheme
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

              {/* Data da falta */}
              <div
                className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                  isLightTheme
                    ? 'text-slate-500 bg-slate-100 border border-slate-200'
                    : 'text-slate-400 bg-white/5 border border-white/10'
                }`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="18"
                    rx="2"
                  />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>

                {just.date}
              </div>

            </div>

            {/* Divider */}
            <div
              className={`mx-4 border-t ${
                isLightTheme
                  ? 'border-slate-200'
                  : 'border-white/5'
              }`}
            />

            {/* Body */}
            <div className="px-4 py-3 flex-1 space-y-2">

              <p
                className={`text-xs leading-relaxed line-clamp-3 ${
                  isLightTheme
                    ? 'text-slate-600'
                    : 'text-slate-300'
                }`}
              >
                "{just.reason}"
              </p>

              {/* Documento */}
              {just.documentName && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    isLightTheme
                      ? 'bg-rose-50 border border-rose-200'
                      : 'bg-[#96183c]/10 border border-[#96183c]/25'
                  }`}
                >
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isLightTheme
                        ? 'text-[#96183c]'
                        : 'text-[#f89642]'
                    }`}
                  />

                  <span
                    className={`text-[11px] font-semibold truncate ${
                      isLightTheme
                        ? 'text-[#96183c]'
                        : 'text-[#faf0ac]'
                    }`}
                  >
                    {just.documentName}
                  </span>
                </div>
              )}

            </div>

            {/* Footer */}
            <div
              className={`px-4 pb-3 border-t pt-2 ${
                isLightTheme
                  ? 'border-slate-200'
                  : 'border-white/5'
              }`}
            >
              <span
                className={`text-[10px] font-mono ${
                  isLightTheme
                    ? 'text-slate-400'
                    : 'text-slate-500'
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



          </main>
        </div>

      {/* Estilos do tema claro.
          O restante da aplicação usa classes Tailwind com cores escuras fixas,
          então estes overrides permitem alternar o tema sem alterar os componentes filhos. */}
      <style>{`
        .theme-light {
          background: #f5f6f8;
          color: #171923;
        }

        .theme-light header {
          background: rgba(255, 255, 255, 0.96) !important;
          border-color: #e2e5ea !important;
          color: #171923;
        }

        .theme-light header .text-slate-400,
        .theme-light header .text-slate-300 {
          color: #64748b !important;
        }

        .theme-light header .text-slate-600 {
          color: #94a3b8 !important;
        }

        .theme-light header .bg-\\[\\#151822\\] {
          background: #ffffff !important;
        }

        .theme-light header button:not([class*="bg-gradient"]) {
          background: #ffffff !important;
          border-color: #e2e5ea !important;
          color: #475569 !important;
        }

        .theme-light header button:not([class*="bg-gradient"]):hover {
          background: #f1f5f9 !important;
          color: #171923 !important;
        }

        .theme-light main {
          color: #171923;
        }

        .theme-light .colaborador-page-container {
          background: #f5f6f8 !important;
        }
      `}</style>

      {/* Modals */}

      <ShiftDetailModal
        shift={selectedShiftForDetail}
        employees={employees}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedShiftForDetail(null);
        }}
        isLightTheme={isLightTheme}
      />

      <ShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentEmployee={activeEmployee}
        employees={employees}
        myShifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitRequest={handleSubmitRequest}
        isLightTheme={isLightTheme}
      />

      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => setIsJustificationModalOpen(false)}
        currentEmployee={activeEmployee}
        shifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitJustification={handleSubmitJustification}
        isLightTheme={isLightTheme}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        isLightTheme={isLightTheme}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        currentEmployee={activeEmployee}
        isLightTheme={isLightTheme}
      />
    </div>
  );
}

export default App;
