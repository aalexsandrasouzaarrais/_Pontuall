import React, { useState } from 'react';
import { ManagerSidebar, ManagerTabId } from './ManagerSidebar';
import { ManagerMatrixGrid } from './ManagerMatrixGrid';
import { OrbitCalendarView } from './OrbitCalendarView';
import { AddUserModal } from './modals/AddUserModal';
import { Employee, Shift } from '../types';

interface ManagerViewProps {
  employees: Employee[];
  shifts: Shift[];
  onAddShift: (shift: Partial<Shift>) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  onAddEmployee: (employee: Employee) => void;
  onOpenRequests: () => void;
  onOpenChat: () => void;
  onOpenNotifications: () => void;
  onSwitchToEmployee: () => void;
  pendingRequestsCount: number;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  employees, shifts, onAddShift, onUpdateShift, onDeleteShift, onAddEmployee, onOpenRequests, onOpenChat,
  onOpenNotifications, onSwitchToEmployee, pendingRequestsCount,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<ManagerTabId>('escala');
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
    <div className="flex flex-1 w-full min-h-[calc(100vh-50px)] overflow-hidden bg-[#0f1117]">
      <ManagerSidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(value => !value)} onOpenCalendarOrbit={() => setActiveTab('orbit')}
        onAddShift={() => createShift()} pendingRequestsCount={pendingRequestsCount} />
      <main className={`min-w-0 flex-1 overflow-auto ${
        activeTab === 'orbit' ? 'bg-[#0F1117] p-0 flex flex-col' : 'bg-slate-100 p-3 sm:p-5'
      }`}>
        {activeTab === 'orbit' ? (
          <OrbitCalendarView
            employees={employees}
            shifts={shifts}
            onAddShift={onAddShift}
            onUpdateShift={onUpdateShift}
            onDeleteShift={onDeleteShift}
            onAddEmployee={() => setIsAddUserModalOpen(true)}
          />
        ) : (
          <ManagerMatrixGrid employees={employees} shifts={shifts} pendingRequestsCount={pendingRequestsCount}
            activeTab={activeTab} onOpenCreateShift={createShift} onOpenEditShift={onUpdateShift}
            onOpenRequests={onOpenRequests} onOpenPjModal={() => {}} onExportCsv={exportCsv}
            onAddEmployee={() => setIsAddUserModalOpen(true)} onSwitchToEmployee={onSwitchToEmployee} onOpenChat={onOpenChat}
            onOpenNotifications={onOpenNotifications} />
        )}
      </main>
    </div>
    <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onAddEmployee={onAddEmployee} />
  </>;
};
