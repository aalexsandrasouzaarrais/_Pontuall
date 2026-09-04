import React, { useState } from 'react';
import { 
  EmployeeNavbar 
} from './components/EmployeeNavbar';
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
  LayoutGrid
} from 'lucide-react';

export function App() {
  // Global Role Mode: 'manager' (Visual requested in photo) vs 'employee'
  const [currentRole, setCurrentRole] = useState<'manager' | 'employee'>('manager');

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [activeEmployee, setActiveEmployee] = useState<Employee>(INITIAL_EMPLOYEES[0]);
  const [shifts, setShifts] = useState<Shift[]>(getInitialShifts());
  const [requests, setRequests] = useState<TimeOffRequest[]>(INITIAL_REQUESTS);
  const [justifications, setJustifications] = useState<AbsenceJustification[]>(INITIAL_JUSTIFICATIONS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  
  // Employee Tabs
  const [employeeTab, setEmployeeTab] = useState<'overview' | 'calendar' | 'requests' | 'justifications' | 'chat'>('overview');

  // Modals state
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isManagerRequestsModalOpen, setIsManagerRequestsModalOpen] = useState(false);

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

  const handleUpdateShift = (updated: Shift) => {
    setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
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

  return (
    <div className="min-h-screen bg-[#0B0B0E] flex flex-col font-sans selection:bg-[#BBF7D0] selection:text-[#166534]">
      
      {/* Top Global Role Switcher Bar */}
      <div className="bg-[#14141A] border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <img
            src="/logo-painel.png"
            alt="Logo Pontual"
            className="h-8 sm:h-9 object-contain drop-shadow-xs"
            onError={(e) => {
              // Fallback if image path fails
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="font-black text-base text-white tracking-tight sm:hidden">
            Pontual
          </span>
          <span className="text-slate-500 font-mono hidden sm:inline">|</span>
          <span className="text-slate-300 font-medium hidden sm:inline text-xs">
            Gestão Inteligente de Escalas, Turnos & Ponto
          </span>
        </div>

        {/* Switcher Pill */}
        <div className="flex items-center gap-1.5 bg-[#1C1C24] p-1 rounded-full border border-white/10">
          <button
            onClick={() => setCurrentRole('manager')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentRole === 'manager'
                ? 'bg-[#E2F952] text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>👔 Visão do Gestor</span>
          </button>

          <button
            onClick={() => setCurrentRole('employee')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentRole === 'employee'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>👤 Portal do Colaborador</span>
          </button>
        </div>
      </div>

      {/* RENDER VIEW ACCORDING TO ROLE */}
      {currentRole === 'manager' ? (
        /* MANAGER VIEW (Full screen width) */
        <div className="flex-1 w-full flex flex-col min-h-0">
          <ManagerView
            employees={employees}
            shifts={shifts}
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
        <div className="flex-1 bg-slate-100 flex flex-col">
          {/* Employee Navigation Header */}
          <EmployeeNavbar
            activeEmployee={activeEmployee}
            employees={employees}
            onSelectEmployee={setActiveEmployee}
            employeeTab={employeeTab}
            onEmployeeTabChange={(tab) => {
              if (tab === 'chat') {
                setIsChatModalOpen(true);
              } else {
                setEmployeeTab(tab);
              }
            }}
            notifications={notifications}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            onSwitchToManager={() => setCurrentRole('manager')}
          />

          {/* Main Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
            
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
              />
            )}

            {/* Tab 3: Time Off & Swaps */}
            {employeeTab === 'requests' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-[#166534]" />
                      Minhas Solicitações de Folga e Troca de Turno
                    </h2>
                    <p className="text-xs text-slate-500">
                      Acompanhe o status dos seus pedidos enviados para a gestão
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSwapModalOpen(true)}
                    className="px-3.5 py-2 bg-[#166534] hover:bg-emerald-800 text-[#BBF7D0] rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Nova Solicitação
                  </button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myRequests.length === 0 ? (
                    <div className="md:col-span-2 bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                      Você ainda não possui solicitações de folga ou troca cadastradas.
                    </div>
                  ) : (
                    myRequests.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${
                            req.type === 'swap' ? 'bg-[#BBF7D0] text-[#166534]' : 'bg-purple-100 text-[#6D28D9]'
                          }`}>
                            {req.type === 'swap' ? '🔄 Troca de Turno' : '🏖️ Folga Compensatória'}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            req.status === 'approved' ? 'bg-[#166534] text-[#BBF7D0]' :
                            req.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {req.status === 'approved' ? '✓ Aprovado' :
                             req.status === 'rejected' ? '✗ Rejeitado' : '○ Em Análise'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 font-semibold">
                          Data: <strong className="font-mono text-slate-900">{req.date}</strong>
                        </div>

                        {req.targetEmployeeName && (
                          <div className="text-xs text-slate-700">
                            Troca solicitada com: <strong>{req.targetEmployeeName}</strong>
                          </div>
                        )}

                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{req.reason}"
                        </p>

                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                          <span>Enviado: {req.createdAt}</span>
                          {req.managerNotes && <span className="text-emerald-800 font-bold">{req.managerNotes}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Justifications & Medical Notes */}
            {employeeTab === 'justifications' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#166534]" />
                      Atestados Médicos & Justificativas de Ausência
                    </h2>
                    <p className="text-xs text-slate-500">
                      Comprovantes enviados para abono e auditoria de ponto
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsJustificationModalOpen(true)}
                    className="px-3.5 py-2 bg-[#166534] hover:bg-emerald-800 text-[#BBF7D0] rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Enviar Novo Atestado
                  </button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myJustifications.length === 0 ? (
                    <div className="md:col-span-2 bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                      Nenhuma justificativa ou atestado registrado para este perfil.
                    </div>
                  ) : (
                    myJustifications.map(just => (
                      <div key={just.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-purple-100 text-[#6D28D9]">
                            📄 Atestado / Declaração
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            just.status === 'approved' ? 'bg-[#166534] text-[#BBF7D0]' :
                            just.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {just.status === 'approved' ? '✓ Homologado' :
                             just.status === 'rejected' ? '✗ Recusado' : '○ Em Análise pelo RH'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 font-semibold">
                          Data da Falta: <strong className="font-mono text-slate-900">{just.date}</strong>
                        </div>

                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{just.reason}"
                        </p>

                        {just.documentName && (
                          <div className="flex items-center gap-1.5 text-xs text-[#166534] font-bold bg-[#BBF7D0]/30 px-2 py-1 rounded border border-emerald-200">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate">{just.documentName}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                          Enviado: {just.submittedAt}
                        </div>
                      </div>
                    ))
                  )}
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
      />

      <ShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentEmployee={activeEmployee}
        employees={employees}
        myShifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitRequest={handleSubmitRequest}
      />

      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => setIsJustificationModalOpen(false)}
        currentEmployee={activeEmployee}
        shifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitJustification={handleSubmitJustification}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        currentEmployee={activeEmployee}
      />
    </div>
  );
}

export default App;
