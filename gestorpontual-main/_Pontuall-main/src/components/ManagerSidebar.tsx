import React from 'react';
import {
  CheckCircle2,
  FileText,
  Sparkles,
  MessageSquare,
  ChevronLeft,
  CalendarRange,
  Bell,
  Sun,
  Moon,
} from 'lucide-react';
import logoPainel from '../assets/logo-painel.png';
import logoColaboradorLight from '../assets/logo-colaborador-light.png';

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
  notificationsCount?: number;
  onOpenNotifications?: () => void;
  currentUser?: {
    name: string;
    avatar: string;
    role?: string;
  };
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const ManagerSidebar: React.FC<ManagerSidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  pendingRequestsCount,
  notificationsCount,
  onOpenNotifications,
  currentUser,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isLightTheme = theme === 'light';

  const navItems: SidebarItem[] = [
    {
      id: 'orbit',
      label: 'Grade de Escalas',
      icon: <CalendarRange className="w-5 h-5" />,
    },
    {
      id: 'aprovacoes',
      label: 'Aprovações & Faltas',
      icon: <CheckCircle2 className="w-5 h-5" />,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    {
      id: 'relatorios',
      label: 'Relatório de Presenças',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: 'tarefas',
      label: 'Lembretes & Tarefas',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: 'chat',
      label: 'Chat da Equipe',
      icon: <MessageSquare className="w-5 h-5" />,
    },
  ];

  const currentWidth = collapsed ? 72 : 260;
  const unreadCount = notificationsCount !== undefined ? notificationsCount : 0;
  const displayUser = currentUser || {
    name: 'Camila Duarte',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
    role: 'Gestora de Escalas & RH',
  };

  return (
    <aside
      aria-label="Navegação do Gestor"
      aria-expanded={!collapsed}
      style={{
        width: `${currentWidth}px`,
        minWidth: `${currentWidth}px`,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className={`flex flex-col select-none relative flex-shrink-0 self-stretch transition-colors duration-300 ${
        isLightTheme
          ? 'bg-white border-r border-slate-200 shadow-2xl shadow-slate-200/60'
          : 'bg-[#0F1117] border-r border-[#222634] shadow-2xl'
      }`}
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        className={`absolute -right-3 top-6 w-6 h-6 rounded-full border text-sm flex items-center justify-center shadow-lg z-50 cursor-pointer hover:scale-110 transition-all duration-200 ${
          isLightTheme
            ? 'bg-white border-slate-200 text-slate-500 hover:text-white hover:bg-[#96183C]'
            : 'bg-[#1E2230] border-[#222634] text-slate-400 hover:text-white hover:bg-[#96183C]'
        }`}
      >
        <ChevronLeft
          className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {/* Header: Logo */}
      <div
        className={`h-[70px] flex items-center border-b relative overflow-hidden flex-shrink-0 transition-colors duration-300 ${
          isLightTheme ? 'border-slate-200' : 'border-[#222634]'
        }`}
      >
        <div className="w-[60px] min-w-[60px] h-[70px] flex items-center justify-center flex-shrink-0">
          <img
            src={isLightTheme ? logoColaboradorLight : logoPainel}
            alt="Logo Pontual"
            className={`w-10 h-10 object-contain select-none transition-transform ${isLightTheme ? 'scale-[1.6]' : 'scale-100'}`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML =
                  '<div style="width:36px;height:36px;background:linear-gradient(135deg,#96183C,#F89847);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px;">P</div>';
              }
            }}
          />
        </div>

        <div
          className={`flex flex-col whitespace-nowrap overflow-hidden pl-2 pr-3 transition-all duration-300 ${
            collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'
          }`}
        >
          <span className={`font-extrabold text-sm tracking-tight leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
            Pontual
          </span>
          <span className="text-[9px] font-bold text-[#F89847] uppercase tracking-wider">
            Visão do Gestor
          </span>
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
                  ? isLightTheme
                    ? 'bg-gradient-to-r from-[#96183C]/30 via-[#96183C]/18 to-[#F89847]/22 text-[#96183C] font-bold'
                    : 'bg-gradient-to-r from-[#96183C]/30 via-[#96183C]/15 to-[#F89847]/12 text-white font-bold'
                  : isLightTheme
                  ? 'text-slate-600 hover:text-[#96183C] hover:bg-slate-100 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 font-semibold'
              }`}
            >
              {/* Active left bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                  style={{
                    background: 'linear-gradient(180deg, #96183C, #F89847)',
                    boxShadow: '0 0 10px #F89847aa',
                  }}
                />
              )}

              {/* Icon block */}
              <div className="w-[68px] min-w-[68px] h-12 flex items-center justify-center relative flex-shrink-0">
                <span
                  className={`transition-all duration-200 group-hover:scale-110 ${
                    isActive
                      ? 'text-[#F89847]'
                      : isLightTheme
                      ? 'text-slate-500 group-hover:text-[#96183C]'
                      : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>

                {/* Badge collapsed */}
                {collapsed && item.badge !== undefined && (
                  <span
                    className={`absolute top-2 right-3 min-w-[18px] h-[18px] px-1 bg-[#96183C] text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 shadow-sm ${
                      isLightTheme ? 'border-white' : 'border-[#0F1117]'
                    }`}
                  >
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
                <span className="mr-3 min-w-[20px] h-5 px-1.5 bg-[#96183C] text-white rounded-full text-[11px] font-extrabold flex items-center justify-center">
                  {item.badge}
                </span>
              )}

              {/* Tooltip when collapsed */}
              {collapsed && (
                <span
                  className={`pointer-events-none absolute left-[76px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50 ${
                    isLightTheme
                      ? 'bg-white border-slate-200 text-slate-700 shadow-slate-200/70'
                      : 'bg-[#1E2230] border-[#222634] text-white'
                  }`}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section: Notifications + User Profile + Theme Button */}
      <div
        className={`border-t flex-shrink-0 transition-colors duration-300 ${
          isLightTheme ? 'border-slate-200' : 'border-[#222634]'
        }`}
      >
        {/* Notifications Button */}
        <div className="px-2.5 py-2">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Abrir notificações"
            className={`group relative flex items-center h-11 w-full rounded-xl text-left cursor-pointer transition-all duration-200 outline-none font-semibold ${
              isLightTheme
                ? 'text-slate-600 hover:text-[#96183C] hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="w-[68px] min-w-[68px] h-11 flex items-center justify-center relative flex-shrink-0">
              <Bell className="w-5 h-5 transition-all duration-200 group-hover:scale-110" />

              {unreadCount > 0 && (
                <span
                  className={`absolute top-1.5 right-3 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-[#96183C] to-[#F89847] text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 ${
                    isLightTheme ? 'border-white' : 'border-[#0F1117]'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            <span
              className={`text-[13px] whitespace-nowrap overflow-hidden flex-1 pr-2 transition-all duration-300 ${
                collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'
              }`}
            >
              Notificações
            </span>

            {!collapsed && unreadCount > 0 && (
              <span className="mr-3 min-w-[20px] h-5 px-1.5 bg-gradient-to-br from-[#96183C] to-[#F89847] text-white rounded-full text-[11px] font-extrabold flex items-center justify-center">
                {unreadCount}
              </span>
            )}

            {collapsed && (
              <span
                className={`pointer-events-none absolute left-[76px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50 ${
                  isLightTheme
                    ? 'bg-white border-slate-200 text-slate-700 shadow-slate-200/70'
                    : 'bg-[#1E2230] border-[#222634] text-white'
                }`}
              >
                Notificações {unreadCount > 0 ? `(${unreadCount})` : ''}
              </span>
            )}
          </button>
        </div>

        {/* Manager Profile Card */}
        <div
          className={`px-2.5 py-2.5 border-t transition-colors duration-300 ${
            isLightTheme ? 'border-slate-200' : 'border-[#222634]'
          }`}
        >
          {collapsed ? (
            <div className="w-full flex items-center justify-center py-1">
              <div className="relative group">
                <img
                  src={displayUser.avatar}
                  alt={displayUser.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-[#96183C] shadow-md"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
                <span
                  className={`pointer-events-none absolute left-[76px] top-1 px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50 ${
                    isLightTheme
                      ? 'bg-white border-slate-200 text-slate-700 shadow-slate-200/70'
                      : 'bg-[#1E2230] border-[#222634] text-white'
                  }`}
                >
                  <p className="font-bold text-slate-900 dark:text-white">{displayUser.name}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">● Online • Gestor Master</p>
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 shadow-xs'
                  : 'bg-white/[0.03] border-white/5'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={displayUser.avatar}
                  alt={displayUser.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-[#96183C] shadow-sm"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {displayUser.name}
                </p>
                <p className="text-[10px] text-emerald-500 font-medium truncate mt-0.5">
                  ● Online • Gestor Master
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Optional Toggle Theme in Sidebar */}
        {onToggleTheme && (
          <div className="px-2.5 pb-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isLightTheme ? 'Ativar tema escuro' : 'Ativar tema claro'}
              title={collapsed ? (isLightTheme ? 'Modo Escuro' : 'Modo Claro') : undefined}
              className={`group relative flex items-center h-10 w-full rounded-xl text-left cursor-pointer transition-all duration-200 outline-none font-semibold ${
                isLightTheme
                  ? 'text-slate-600 hover:text-[#96183C] hover:bg-slate-100'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="w-[68px] min-w-[68px] h-10 flex items-center justify-center relative flex-shrink-0">
                {isLightTheme ? (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform duration-200 group-hover:scale-110" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 group-hover:scale-110" />
                )}
              </div>

              <span
                className={`text-xs whitespace-nowrap overflow-hidden flex-1 pr-2 transition-all duration-300 font-medium ${
                  isLightTheme ? 'text-slate-700' : 'text-slate-300'
                } ${collapsed ? 'opacity-0 -translate-x-2 pointer-events-none max-w-0' : 'opacity-100 translate-x-0'}`}
              >
                {isLightTheme ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
              </span>

              {collapsed && (
                <span
                  className={`pointer-events-none absolute left-[76px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-xl z-50 ${
                    isLightTheme
                      ? 'bg-white border-slate-200 text-slate-700 shadow-slate-200/70'
                      : 'bg-[#1E2230] border-[#222634] text-white'
                  }`}
                >
                  {isLightTheme ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
