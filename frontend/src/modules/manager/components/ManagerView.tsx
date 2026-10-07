import { getTodayDateString } from '@/shared/utils/dateUtils';
import React, { useState } from 'react';
import { ManagerSidebar, ManagerTabId } from './ManagerSidebar';
import { ManagerMatrixGrid } from '@/modules/shifts/components/ManagerMatrixGrid';
import { OrbitCalendarView } from '@/modules/shifts/components/OrbitCalendarView';
import { AddUserModal } from '@/modules/auth/components/AddUserModal';
import { Employee, Shift } from '@/types';
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
  onSwitchToEmployee: () => void;
  pendingRequestsCount: number;
  onOpenProfile?: () => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  employees, shifts, activeEmployee, notificationsCount, onAddShift, onUpdateShift, onDeleteShift, onDeleteShiftsBulk, onAddEmployee,
  onUpdateEmployee, onDeactivateEmployee, onOpenRequests, onOpenChat,
  onOpenNotifications, onSwitchToEmployee, pendingRequestsCount, onOpenProfile,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ManagerTabId>('orbit');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const createShift = (date?: string, employeeId?: string) => onAddShift({
    date: date || getTodayDateString(),
    employeeId: employeeId || employees[0]?.id,
    title: 'Novo turno', startTime: '09:00', endTime: '18:00', breakMinutes: 60,
  });

  const exportCsv = () => {
    const rows = ['Colaborador,Data,Início,Fim,Status', ...shifts.map(s => {
      const name = employees.find(e => e.id === s.employeeId)?.name || 'Não informado';
      return `${name},${s.date},${s.startTime},${s.endTime},${s.status}`;
    })];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = 'escalas-pontual.csv'; link.click(); URL.revokeObjectURL(link.href);
  };

  return <>
    <div className={`flex flex-1 w-full min-h-[calc(100vh-50px)] overflow-hidden transition-colors duration-300 manager-scope ${theme} ${
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
        notificationsCount={notificationsCount}
        onOpenNotifications={onOpenNotifications}
        currentUser={activeEmployee}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenProfile={onOpenProfile}
      />
      <main className={`min-w-0 flex-1 overflow-auto transition-colors duration-300 ${
        activeTab === 'orbit' 
          ? (isDark ? 'bg-[#0F1117] p-0 flex flex-col' : 'bg-[#f8fafc] p-0 flex flex-col') 
          : (activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios' || activeTab === 'chat' || activeTab === 'colaboradores')
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
        ) : (
          <ManagerMatrixGrid
            employees={employees}
            shifts={shifts}
            pendingRequestsCount={pendingRequestsCount}
            activeTab={activeTab}
            onOpenCreateShift={createShift}
            onOpenEditShift={onUpdateShift}
            onOpenRequests={onOpenRequests}
            onOpenPjModal={() => {}}
            onExportCsv={exportCsv}
            onAddEmployee={() => setIsAddUserModalOpen(true)}
            onSwitchToEmployee={onSwitchToEmployee}
            onOpenChat={onOpenChat}
            onOpenNotifications={onOpenNotifications}
            onNavigateToOrbit={() => setActiveTab('orbit')}
            theme={theme}
            activeEmployee={activeEmployee}
            isRh={activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager}
            onUpdateEmployee={onUpdateEmployee}
            onDeactivateEmployee={onDeactivateEmployee}
            onDeleteShift={onDeleteShift}
            onDeleteShiftsBulk={onDeleteShiftsBulk}
          />
        )}
      </main>
    </div>
    <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onAddEmployee={onAddEmployee} employees={employees} theme={theme} />
  </>;
};
