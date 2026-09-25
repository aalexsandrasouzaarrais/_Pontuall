import React from 'react';
import { 
  CalendarDays, 
  CheckCircle2, 
  FileText, 
  Bell, 
  MessageSquare, 
  Building2,
  Clock,
  UserCheck
} from 'lucide-react';
import { Employee, NotificationItem } from '../types';

interface EmployeeNavbarProps {
  activeEmployee: Employee;
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  employeeTab: 'overview' | 'calendar' | 'requests' | 'justifications' | 'chat';
  onEmployeeTabChange: (tab: 'overview' | 'calendar' | 'requests' | 'justifications' | 'chat') => void;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
}

export const EmployeeNavbar: React.FC<EmployeeNavbarProps> = ({
  activeEmployee,
  employees,
  onSelectEmployee,
  employeeTab,
  onEmployeeTabChange,
  notifications,
  onOpenNotifications,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-[#050104] border-b border-white/10 shadow-xs">
      {/* Top Banner: Employee Context & Fast User Switcher */}
      <div className="bg-[#1E1B4B] text-slate-100 px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between text-xs gap-2 border-b border-indigo-950">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide">
            <div className="w-5 h-5 rounded bg-[#166534] flex items-center justify-center text-[#BBF7D0]">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-white tracking-tight text-xs">EMPLOYER</span>
            <span className="bg-[#BBF7D0] text-[#166534] text-[9px] px-1.5 py-0.5 rounded font-mono font-extrabold uppercase tracking-wider">
              COLABORADOR
            </span>
          </div>
          <span className="hidden md:inline-block text-indigo-400/40 font-mono">|</span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-indigo-200 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#BBF7D0] animate-pulse"></span>
            <span className="font-medium">Portal do Colaborador & Ponto Digital GPS</span>
          </span>
        </div>

        {/* Fast Switch between Employees (Mock profiles) */}
        <div className="flex items-center gap-2">
          <span className="text-indigo-300/80 text-[11px] hidden sm:inline font-medium flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#BBF7D0]" />
            Colaborador Logado:
          </span>
          <div className="flex items-center gap-1.5 bg-[#0F0D2E] border border-indigo-900/80 rounded-lg px-2.5 py-1">
            <select
              id="select-employee"
              aria-label="Selecionar colaborador ativo"
              value={activeEmployee.id}
              onChange={(e) => {
                const found = employees.find(emp => emp.id === e.target.value);
                if (found) onSelectEmployee(found);
              }}
              className="bg-transparent text-[#BBF7D0] text-xs font-bold focus:outline-none cursor-pointer"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} className="bg-[#1E1B4B] text-white">
                  {emp.name} — {emp.role} ({emp.department})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#96183C] to-[#F89847] flex items-center justify-center text-white shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-sm leading-tight tracking-tight">
                  {activeEmployee.name}
                </h1>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded font-mono uppercase bg-white/10 text-[#F89847] border border-white/20">
                  {activeEmployee.role}
                </span>
              </div>
              <p className="text-[11px] text-white/50 font-medium">
                {activeEmployee.department} • Carga: {activeEmployee.standardHoursPerWeek}h/sem
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 ml-3 bg-white/5 p-0.5 rounded-lg border border-white/10">
            <button
              id="tab-overview"
              type="button"
              onClick={() => onEmployeeTabChange('overview')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'overview'
                  ? 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] shadow-xs border border-[#F89847]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${employeeTab === 'overview' ? 'text-[#F89847]' : 'text-white/40'}`} />
              Minha Presença & Ponto
            </button>

            <button
              id="tab-calendar"
              type="button"
              onClick={() => onEmployeeTabChange('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'calendar'
                  ? 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] shadow-xs border border-[#F89847]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <CalendarDays className={`w-3.5 h-3.5 ${employeeTab === 'calendar' ? 'text-[#F89847]' : 'text-white/40'}`} />
              Calendário da Escala
            </button>

            <button
              id="tab-requests"
              type="button"
              onClick={() => onEmployeeTabChange('requests')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'requests'
                  ? 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] shadow-xs border border-[#F89847]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${employeeTab === 'requests' ? 'text-[#F89847]' : 'text-white/40'}`} />
              Folgas & Trocas
            </button>

            <button
              id="tab-justifications"
              type="button"
              onClick={() => onEmployeeTabChange('justifications')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'justifications'
                  ? 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] shadow-xs border border-[#F89847]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${employeeTab === 'justifications' ? 'text-[#F89847]' : 'text-white/40'}`} />
              Atestados & Faltas
            </button>

            <button
              id="tab-chat"
              type="button"
              onClick={() => onEmployeeTabChange('chat')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'chat'
                  ? 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] shadow-xs border border-[#F89847]/40'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 ${employeeTab === 'chat' ? 'text-[#F89847]' : 'text-white/40'}`} />
              Chat da Equipe
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Notifications Trigger */}
          <button
            id="btn-employee-notifs"
            type="button"
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
            title="Minhas Notificações"
            aria-label="Abrir notificações"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-[#96183C] to-[#F89847] text-white rounded-full text-[9px] font-mono font-bold flex items-center justify-center border border-[#050104]">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Employee Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <img
              src={activeEmployee.avatar}
              alt={activeEmployee.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-[#F89847]/40"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white leading-tight">
                {activeEmployee.name}
              </div>
              <div className="text-[10px] text-[#BBF7D0] font-bold">
                Online ● GPS Ativo
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Subnav */}
      <div className="lg:hidden flex overflow-x-auto px-4 py-1.5 border-t border-white/10 bg-[#050104] gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => onEmployeeTabChange('overview')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs transition-all ${employeeTab === 'overview' ? 'bg-gradient-to-br from-[#96183C] to-[#F89847] text-white shadow-md' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'}`}
        >
          Minha Presença
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('calendar')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs transition-all ${employeeTab === 'calendar' ? 'bg-gradient-to-br from-[#96183C] to-[#F89847] text-white shadow-md' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'}`}
        >
          Calendário
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('requests')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs transition-all ${employeeTab === 'requests' ? 'bg-gradient-to-br from-[#96183C] to-[#F89847] text-white shadow-md' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'}`}
        >
          Folgas & Trocas
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('justifications')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs transition-all ${employeeTab === 'justifications' ? 'bg-gradient-to-br from-[#96183C] to-[#F89847] text-white shadow-md' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'}`}
        >
          Atestados
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('chat')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs transition-all ${employeeTab === 'chat' ? 'bg-gradient-to-br from-[#96183C] to-[#F89847] text-white shadow-md' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'}`}
        >
          Chat
        </button>
      </div>
    </header>
  );
};
