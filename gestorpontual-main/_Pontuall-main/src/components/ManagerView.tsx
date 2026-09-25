import React, { useState } from 'react';
import { ManagerSidebar, ManagerTabId } from './ManagerSidebar';
import { ManagerMatrixGrid } from './ManagerMatrixGrid';
import { OrbitCalendarView } from './OrbitCalendarView';
import { AddUserModal } from './modals/AddUserModal';
import { Employee, Shift } from '../types';
import { useTheme } from '../context/ThemeContext';

interface ManagerViewProps {
  employees: Employee[];
  shifts: Shift[];
  activeEmployee?: Employee;
  notificationsCount?: number;
  onAddShift: (shift: Partial<Shift>) => void;
  onUpdateShift: (shift: Shift, notifyEmployee?: boolean, changeReason?: string) => void;
  onDeleteShift: (id: string) => void;
  onAddEmployee: (employee: Employee) => void;
  onOpenRequests: () => void;
  onOpenChat: () => void;
  onOpenNotifications: () => void;
  onSwitchToEmployee: () => void;
  pendingRequestsCount: number;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  employees, shifts, activeEmployee, notificationsCount, onAddShift, onUpdateShift, onDeleteShift, onAddEmployee, onOpenRequests, onOpenChat,
  onOpenNotifications, onSwitchToEmployee, pendingRequestsCount,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ManagerTabId>('orbit');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const createShift = (date?: string, employeeId?: string) => onAddShift({
    date: date || new Date().toISOString().slice(0, 10),
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
    <div className={`flex flex-1 w-full min-h-[calc(100vh-50px)] overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0f1117]' : 'bg-[#f8fafc]'
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
      />
      <main className={`min-w-0 flex-1 overflow-auto transition-colors duration-300 ${
        activeTab === 'orbit' 
          ? (isDark ? 'bg-[#0F1117] p-0 flex flex-col' : 'bg-[#f8fafc] p-0 flex flex-col') 
          : (activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios' || activeTab === 'chat')
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
            onAddEmployee={() => setIsAddUserModalOpen(true)}
            theme={theme}
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
          />
        )}
      </main>
    </div>
    <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onAddEmployee={onAddEmployee} theme={theme} />
  </>;
};
