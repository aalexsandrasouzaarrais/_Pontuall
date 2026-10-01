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
import { Employee, NotificationItem } from '@/types';
import logoPainel from '@/assets/logo-painel.png';

interface EmployeeNavbarProps {
  activeEmployee: Employee;
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  employeeTab: 'overview' | 'calendar' | 'requests' | 'justifications' | 'chat';
  onEmployeeTabChange: (tab: 'overview' | 'calendar' | 'requests' | 'justifications' | 'chat') => void;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  onSwitchToManager?: () => void;
  onOpenProfile?: () => void;
}

export const EmployeeNavbar: React.FC<EmployeeNavbarProps> = ({
  activeEmployee,
  employees,
  onSelectEmployee,
  employeeTab,
  onEmployeeTabChange,
  notifications,
  onOpenNotifications,
  onSwitchToManager,
  onOpenProfile,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs font-sans">
      {/* Top Banner: Employee Context & Fast User Switcher */}
      <div className="bg-[#1E1B4B] text-slate-100 px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between text-xs gap-2 border-b border-indigo-950">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wide">
            <img src={logoPainel} alt="Logo Pontual" className="h-7 object-contain" />
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

        {/* Fast Switch between Employees & Button to Manager */}
        <div className="flex items-center gap-2.5">
          {onSwitchToManager && (
            <button
              onClick={onSwitchToManager}
              className="px-3 py-1 bg-[#E2F952] hover:bg-[#D4F639] text-black text-xs font-black rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 font-mono"
              title="Ir para a Visão do Gestor"
            >
              <span>👔 Painel do Gestor</span>
            </button>
          )}

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
            <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center text-[#BBF7D0] shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-sm leading-tight tracking-tight">
                  {activeEmployee.name}
                </h1>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded font-mono uppercase bg-[#BBF7D0] text-[#166534] border border-emerald-300">
                  {activeEmployee.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeEmployee.department} • Carga: {activeEmployee.standardHoursPerWeek}h/sem
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 ml-3 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              id="tab-overview"
              type="button"
              onClick={() => onEmployeeTabChange('overview')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'overview'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              Minha Presença & Ponto
            </button>

            <button
              id="tab-calendar"
              type="button"
              onClick={() => onEmployeeTabChange('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'calendar'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-[#6D28D9]" />
              Calendário da Escala
            </button>

            <button
              id="tab-requests"
              type="button"
              onClick={() => onEmployeeTabChange('requests')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'requests'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Folgas & Trocas
            </button>

            <button
              id="tab-justifications"
              type="button"
              onClick={() => onEmployeeTabChange('justifications')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'justifications'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#6D28D9]" />
              Atestados & Faltas
            </button>

            <button
              id="tab-chat"
              type="button"
              onClick={() => onEmployeeTabChange('chat')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                employeeTab === 'chat'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
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
            className="relative p-2 rounded-xl text-slate-600 hover:text-[#166534] hover:bg-emerald-50 transition-colors border border-slate-200 cursor-pointer"
            title="Minhas Notificações"
            aria-label="Abrir notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-emerald-600 text-white rounded-full text-[10px] font-mono font-bold flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Employee Avatar */}
          <button
            type="button"
            onClick={onOpenProfile}
            title="Clique para alterar sua foto de perfil"
            className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-85 transition-opacity text-left group"
          >
            <div className="relative">
              <img
                src={activeEmployee.avatar}
                alt={activeEmployee.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-600/30 group-hover:ring-emerald-600 transition-all"
              />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight group-hover:text-emerald-800 transition-colors">
                {activeEmployee.name}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold">
                Online ● Mudar foto
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Subnav */}
      <div className="lg:hidden flex overflow-x-auto px-4 py-1.5 border-t border-slate-200 bg-slate-50 gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => onEmployeeTabChange('overview')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs ${employeeTab === 'overview' ? 'bg-[#166534] text-[#BBF7D0]' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Minha Presença
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('calendar')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs ${employeeTab === 'calendar' ? 'bg-[#166534] text-[#BBF7D0]' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Calendário
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('requests')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs ${employeeTab === 'requests' ? 'bg-[#166534] text-[#BBF7D0]' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Folgas & Trocas
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('justifications')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs ${employeeTab === 'justifications' ? 'bg-[#166534] text-[#BBF7D0]' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Atestados
        </button>
        <button
          type="button"
          onClick={() => onEmployeeTabChange('chat')}
          className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-xs ${employeeTab === 'chat' ? 'bg-[#166534] text-[#BBF7D0]' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Chat
        </button>
      </div>
    </header>
  );
};
