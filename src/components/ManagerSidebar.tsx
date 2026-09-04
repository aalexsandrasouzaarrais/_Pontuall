import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Sparkles,
  MessageSquare,
  ChevronLeft,
  CalendarRange,
  Plus,
} from 'lucide-react';

export type ManagerTabId = 'escala' | 'orbit' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat';

interface SidebarItem {
  id: ManagerTabId;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface ManagerSidebarProps {
  activeTab: ManagerTabId;
  onTabChange: (tab: ManagerTabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCalendarOrbit: () => void;
  onAddShift: () => void;
  pendingRequestsCount: number;
}

export const ManagerSidebar: React.FC<ManagerSidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  onOpenCalendarOrbit,
  onAddShift,
  pendingRequestsCount,
}) => {
  const navItems: SidebarItem[] = [
    {
      id: 'escala',
      label: 'Grade de Escalas',
      icon: <CalendarDays className="w-5 h-5" />,
    },
    {
      id: 'aprovacoes',
      label: 'Aprovações & Faltas',
      icon: <CheckCircle2 className="w-5 h-5" />,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : 4,
    },
    {
      id: 'relatorios',
      label: 'Relatório Presenças',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: 'tarefas',
      label: 'Lembretes & Tarefas',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: 'chat',
      label: 'Chat Equipe',
      icon: <MessageSquare className="w-5 h-5" />,
    },
  ];

  const currentWidth = collapsed ? 72 : 250;

  return (
    <aside
      aria-label="Navegação do Gestor"
      aria-expanded={!collapsed}
      style={{
        width: `${currentWidth}px`,
        minWidth: `${currentWidth}px`,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className="bg-[#0F1117] border-r border-[#222634] flex flex-col select-none shadow-2xl relative flex-shrink-0 h-full"
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#1E2230] border border-[#222634] text-slate-400 hover:text-white hover:bg-[#a42442] hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-lg z-50 cursor-pointer"
      >
        <ChevronLeft
          className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {/* Header: Logo Pontual */}
      <div className="h-[70px] flex items-center border-b border-[#222634] relative overflow-hidden flex-shrink-0">
        <div className="w-[72px] min-w-[72px] h-[70px] flex items-center justify-center flex-shrink-0">
          <img
            src="/logo-painel.png"
            alt="Logo Pontual"
            className="w-11 h-11 object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '<div style="width:36px;height:36px;background:#a42442;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px;">P</div>';
              }
            }}
          />
        </div>

        <div
          className={`flex flex-col whitespace-nowrap overflow-hidden pr-3 transition-all duration-300 ${
            collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'
          }`}
        >
          <span className="font-extrabold text-sm text-white tracking-tight leading-tight">Pontual</span>
          <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">Gestor Master</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2.5 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex items-center h-12 rounded-xl text-left cursor-pointer transition-all duration-200 outline-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#a42442]/30 to-[#a42442]/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 font-semibold'
              }`}
            >
              {/* Active left bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#a42442] shadow-[0_0_10px_#a42442]" />
              )}

              {/* Icon block (always 72px) */}
              <div className="w-[68px] min-w-[68px] h-12 flex items-center justify-center relative flex-shrink-0">
                <span
                  className={`transition-all duration-200 group-hover:scale-110 ${
                    isActive ? 'text-[#ff4d6d]' : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>

                {/* Badge collapsed */}
                {collapsed && item.badge !== undefined && (
                  <span className="absolute top-2 right-3 min-w-[18px] h-[18px] px-1 bg-[#a42442] text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 border-[#0F1117] shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label expanded */}
              <span
                className={`text-[13px] whitespace-nowrap overflow-hidden flex-1 pr-2 transition-all duration-300 ${
                  collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'
                }`}
              >
                {item.label}
              </span>

              {/* Badge expanded */}
              {!collapsed && item.badge !== undefined && (
                <span className="mr-3 min-w-[20px] h-5 px-1.5 bg-[#a42442] text-white rounded-full text-[11px] font-extrabold flex items-center justify-center">
                  {item.badge}
                </span>
              )}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="pointer-events-none absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-[#1E2230] border border-[#222634] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="h-px bg-[#222634] my-2 mx-2" />

        {/* Button: Visão Calendário Orbit */}
        <button
          type="button"
          onClick={onOpenCalendarOrbit}
          aria-label="Visão Calendário Orbit"
          className={`group relative flex items-center h-12 rounded-xl text-left cursor-pointer transition-all duration-200 outline-none ${
            activeTab === 'orbit'
              ? 'bg-gradient-to-r from-[#96183c]/40 to-[#f89847]/20 text-white font-bold'
              : 'text-slate-400 hover:text-white hover:bg-white/5 font-semibold'
          }`}
        >
          {activeTab === 'orbit' && (
            <span 
              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full shadow-[0_0_10px_#f89847]"
              style={{ background: 'linear-gradient(180deg, #96183c, #f89847)' }}
            />
          )}

          <div className="w-[68px] min-w-[68px] h-12 flex items-center justify-center flex-shrink-0">
            <span
              className={`transition-all duration-200 group-hover:scale-110 ${
                activeTab === 'orbit' ? 'text-[#faf0ac]' : 'text-slate-400 group-hover:text-[#f89847]'
              }`}
            >
              <CalendarRange className="w-5 h-5" />
            </span>
          </div>

          <span
            className={`text-[13px] whitespace-nowrap overflow-hidden flex-1 pr-2 transition-all duration-300 ${
              collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'
            }`}
          >
            Calendário Orbit
          </span>

          {collapsed && (
            <span className="pointer-events-none absolute left-[76px] px-2.5 py-1.5 rounded-lg bg-[#1E2230] border border-[#222634] text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50">
              Calendário Orbit
            </span>
          )}
        </button>

      </nav>
    </aside>
  );
};
