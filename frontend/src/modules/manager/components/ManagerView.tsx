import { 
  getTodayDateString,
  calculateShiftDurationHours,
  formatMinutesToHoursString,
  hoursToMinutes,
  calculatePunchDurationMinutes
} from '@/shared/utils/dateUtils';
import React, { useState } from 'react';
import { ManagerSidebar, ManagerTabId } from './ManagerSidebar';
import { ManagerMatrixGrid } from '@/modules/shifts/components/ManagerMatrixGrid';
import { OrbitCalendarView } from '@/modules/shifts/components/OrbitCalendarView';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ManagerPjDeliverablesView } from './ManagerPjDeliverablesView';
import { AddUserModal } from '@/modules/auth/components/AddUserModal';
import { Employee, Shift, AbsenceJustification, TimeOffRequest, PjDeliverableReport } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';

interface ManagerViewProps {
  employees: Employee[];
  shifts: Shift[];
  activeEmployee?: Employee;
  notificationsCount?: number;
  onAddShift: (shift: Partial<Shift>) => void;
  onUpdateShift: (shift: Shift, notifyEmployee?: boolean, changeReason?: string) => void;
  onDeleteShift: (id: string) => void;
  onDeleteShiftsBulk?: (ids: string[]) => void;
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee?: (updated: Employee) => void;
  onDeactivateEmployee?: (id: string) => void;
  onOpenRequests: () => void;
  onOpenChat: () => void;
  onOpenNotifications: () => void;
  onSwitchToEmployee?: () => void;
  pendingRequestsCount: number;
  unreadChatCount?: number;
  onResetUnreadChat?: () => void;
  onChatViewActive?: (isActive: boolean) => void;
  onOpenProfile?: () => void;
  justifications?: AbsenceJustification[];
  requests?: TimeOffRequest[];
  pjReports?: PjDeliverableReport[];
  onApproveRequest?: (id: string, customFeedback?: string) => void;
  onRejectRequest?: (id: string, customFeedback?: string) => void;
  onApproveJustification?: (id: string, customFeedback?: string) => void;
  onRejectJustification?: (id: string, customFeedback?: string) => void;
  onApprovePjReport?: (id: string) => void;
  onRejectPjReport?: (id: string, reason?: string) => void;
  activeTab?: ManagerTabId;
  onTabChange?: (tab: ManagerTabId) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  employees, shifts, activeEmployee, notificationsCount, onAddShift, onUpdateShift, onDeleteShift, onDeleteShiftsBulk, onAddEmployee,
  onUpdateEmployee, onDeactivateEmployee, onOpenRequests, onOpenChat,
  onOpenNotifications, onSwitchToEmployee, pendingRequestsCount, unreadChatCount, onResetUnreadChat, onChatViewActive, onOpenProfile,
  justifications, requests, pjReports = [], onApproveRequest, onRejectRequest, onApproveJustification, onRejectJustification,
  onApprovePjReport, onRejectPjReport,
  activeTab: activeTabProp,
  onTabChange: onTabChangeProp,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [internalTab, setInternalTab] = useState<ManagerTabId>('orbit');
  const activeTab = activeTabProp !== undefined ? activeTabProp : internalTab;
  const setActiveTab = (tab: ManagerTabId) => {
    setInternalTab(tab);
    onTabChangeProp?.(tab);
  };
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'chat') {
      onResetUnreadChat?.();
      onChatViewActive?.(true);
    } else {
      onChatViewActive?.(false);
    }
  }, [activeTab, onResetUnreadChat, onChatViewActive]);

  const createShift = (date?: string, employeeId?: string) => onAddShift({
    date: date || getTodayDateString(),
    employeeId: employeeId || employees[0]?.id,
    title: 'Novo turno', startTime: '09:00', endTime: '18:00', breakMinutes: 60,
  });

  const exportCsv = () => {
    // Relatório de Auditoria de Ponto & Banco de Horas (Conformidade Portaria MTE 671/2021)
    const headers = [
      'Colaborador',
      'Departamento',
      'Data',
      'Início Previsto',
      'Fim Previsto',
      'Entrada Registrada',
      'Saída Registrada',
      'Carga Prevista',
      'Carga Real Trabalhada',
      'Saldo / Variação',
      'Horas Extras (min)',
      'Atraso (min)',
      'Situação Presença',
      'Ocorrência / Justificativa',
      'Parecer / Auditoria Legal (Portaria 671)'
    ];

    const rows = shifts.map(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const name = `"${(emp?.name || 'Não informado').replace(/"/g, '""')}"`;
      const dept = `"${(emp?.department || 'Geral').replace(/"/g, '""')}"`;
      const date = s.date;
      const scheduledStart = s.startTime || '--:--';
      const scheduledEnd = s.endTime || '--:--';
      const realIn = s.checkInTime || '--:--';
      const realOut = s.checkOutTime || '--:--';

      const scheduledHours = calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
      const scheduledMinutes = hoursToMinutes(scheduledHours);

      let realMinutes = 0;
      if (s.checkInTime && s.checkOutTime) {
        realMinutes = calculatePunchDurationMinutes(s.checkInTime, s.checkOutTime, s.breakMinutes);
      } else if (s.attendanceStatus === 'present' || s.attendanceStatus === 'late' || s.attendanceStatus === 'justified') {
        realMinutes = scheduledMinutes;
      }

      const realHoursFormatted = formatMinutesToHoursString(realMinutes);
      const saldoMinutes = realMinutes - scheduledMinutes;
      const saldoFormatted = saldoMinutes > 0
        ? `+${formatMinutesToHoursString(saldoMinutes)}`
        : saldoMinutes < 0
        ? `-${formatMinutesToHoursString(Math.abs(saldoMinutes))}`
        : '0h 00m';

      let heMin = 0;
      let lateMin = 0;
      if (s.notes) {
        const heMatch = s.notes.match(/\[HE \+(\d+)m/);
        if (heMatch) heMin = Number(heMatch[1]);
        const lateMatch = s.notes.match(/\[Atraso (\d+)m/);
        if (lateMatch) lateMin = Number(lateMatch[1]);
      }

      let statusPresenca = 'Pendente';
      if (s.attendanceStatus === 'justified') statusPresenca = 'Atestado / Justificado';
      else if (s.attendanceStatus === 'late') statusPresenca = 'Entrada com Atraso';
      else if (s.attendanceStatus === 'absent') statusPresenca = 'Falta';
      else if (s.attendanceStatus === 'present') statusPresenca = 'Presente';

      const notesClean = `"${(s.notes || '').replace(/"/g, '""')}"`;

      let auditStatus = 'Conforme escala';
      if (s.notes?.includes('Esquecimento')) {
        auditStatus = 'Ajuste de Tratamento: Saída efetiva considerada no horário contratual (sem HE indevida)';
      } else if (s.notes?.includes('HOMOLOGADO')) {
        auditStatus = 'Horas extras homologadas pelo gestor para Banco de Horas';
      } else if (s.notes?.includes('AJUSTE GESTOR')) {
        auditStatus = 'Ajuste do Gestor: Regularizado na jornada contratual (Art. 4º CLT)';
      } else if (heMin > 0) {
        auditStatus = `Hora extra registrada: +${heMin}m aguardando homologação`;
      } else if (lateMin > 0) {
        auditStatus = `Atraso apurado: ${lateMin}m`;
      } else if (s.attendanceStatus === 'justified') {
        auditStatus = 'Atestado médico homologado com abono legal';
      }

      return [
        name,
        dept,
        date,
        scheduledStart,
        scheduledEnd,
        realIn,
        realOut,
        `"${scheduledHours}h"`,
        `"${realHoursFormatted}"`,
        `"${saldoFormatted}"`,
        heMin,
        lateMin,
        `"${statusPresenca}"`,
        notesClean,
        `"${auditStatus}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-espelho-ponto-auditoria-${getTodayDateString()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <>
    <div className={`flex flex-col md:flex-row flex-1 w-full min-h-[calc(100vh-50px)] overflow-hidden transition-colors duration-300 manager-scope ${theme} ${
      isDark ? 'bg-[#0f1117]' : 'bg-[#f8fafc] text-slate-800'
    }`}>
      <ManagerSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(value => !value)}
        onOpenCalendarOrbit={() => setActiveTab('orbit')}
        onAddShift={() => createShift()}
        pendingRequestsCount={pendingRequestsCount}
        pendingPjCount={pjReports.filter(p => p.status === 'pending').length}
        notificationsCount={notificationsCount}
        onOpenNotifications={onOpenNotifications}
        unreadChatCount={unreadChatCount}
        currentUser={activeEmployee}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenProfile={onOpenProfile}
      />
      <main className={`min-w-0 flex-1 overflow-auto transition-colors duration-300 ${
        activeTab === 'orbit' 
          ? (isDark ? 'bg-[#0F1117] p-0 flex flex-col' : 'bg-[#f8fafc] p-0 flex flex-col') 
          : (activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'pj_entregas' || activeTab === 'relatorios' || activeTab === 'chat' || activeTab === 'colaboradores')
          ? (isDark ? 'bg-[#0F1117] p-3 sm:p-6' : 'bg-[#f8fafc] p-3 sm:p-6')
          : (isDark ? 'bg-[#15161b] p-3 sm:p-5' : 'bg-slate-100 p-3 sm:p-5')
      }`}>
        {activeTab === 'orbit' ? (
          <OrbitCalendarView
            employees={employees}
            shifts={shifts}
            onAddShift={onAddShift}
            onUpdateShift={onUpdateShift}
            onDeleteShift={onDeleteShift}
            onDeleteShiftsBulk={onDeleteShiftsBulk}
            onAddEmployee={() => setIsAddUserModalOpen(true)}
            theme={theme}
            activeEmployee={activeEmployee}
            isRh={activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager}
          />
        ) : activeTab === 'pj_entregas' ? (
          <ManagerPjDeliverablesView
            employees={employees}
            pjReports={pjReports}
            onApproveReport={onApprovePjReport}
            onRejectReport={onRejectPjReport}
            isDark={isDark}
            isRh={activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager}
          />
        ) : (
          <ErrorBoundary fallbackTitle="Painel de Gestão" fallbackMessage="Ocorreu uma instabilidade na exibição do painel. Clique abaixo para recarregar com segurança.">
            <ManagerMatrixGrid
              employees={employees}
              shifts={shifts}
              pendingRequestsCount={pendingRequestsCount}
              activeTab={activeTab}
              onOpenCreateShift={createShift}
              onOpenEditShift={onUpdateShift}
              onOpenRequests={onOpenRequests}
              onOpenPjModal={() => setActiveTab('pj_entregas')}
              onExportCsv={exportCsv}
              onAddEmployee={() => setIsAddUserModalOpen(true)}
              onSwitchToEmployee={onSwitchToEmployee}
              onOpenChat={onOpenChat}
              onOpenNotifications={onOpenNotifications}
              unreadChatCount={unreadChatCount}
              onNavigateToOrbit={() => setActiveTab('orbit')}
              theme={theme}
              activeEmployee={activeEmployee}
              isRh={activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager}
              onUpdateEmployee={onUpdateEmployee}
              onDeactivateEmployee={onDeactivateEmployee}
              onDeleteShift={onDeleteShift}
              onDeleteShiftsBulk={onDeleteShiftsBulk}
              justifications={justifications}
              requests={requests}
              onApproveRequest={onApproveRequest}
              onRejectRequest={onRejectRequest}
              onApproveJustification={onApproveJustification}
              onRejectJustification={onRejectJustification}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
    <AddUserModal 
      isOpen={isAddUserModalOpen} 
      onClose={() => setIsAddUserModalOpen(false)} 
      onAddEmployee={onAddEmployee} 
      employees={employees} 
      activeEmployee={activeEmployee}
      theme={theme} 
    />
  </>;
};
