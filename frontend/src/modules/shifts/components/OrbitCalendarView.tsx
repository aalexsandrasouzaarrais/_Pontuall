import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  Building2,
  ChevronDown,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Clock,
  Users,
  UserCheck,
  Layers
} from 'lucide-react';
import { Employee, Shift, ShiftTemplate } from '@/types';
import { OrbitShiftModal, ORBIT_COLORS } from './OrbitShiftModal';
import { ShiftTemplatesModal } from './ShiftTemplatesModal';

interface OrbitCalendarViewProps {
  employees: Employee[];
  shifts: Shift[];
  onAddShift: (shift: Partial<Shift>) => void;
  onUpdateShift: (shift: Shift, notifyEmployee?: boolean, changeReason?: string) => void;
  onDeleteShift: (id: string) => void;
  onAddEmployee: () => void;
  theme?: 'light' | 'dark';
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  return addDays(d, -day);
}

function getMutedShiftColor(ev: Shift, isDark: boolean) {
  const hex = (ev.color?.bg || '').toLowerCase();

  // Violeta / Reunião
  if (hex.includes('7c3aed') || hex.includes('violet') || hex.includes('3a2250') || hex.includes('48285b') || ev.type === 'meeting') {
    return isDark 
      ? { bg: '#2b1a3d', border: '#482a68', accent: '#7c4da6', text: '#f3e8ff' }
      : { bg: '#faf5ff', border: '#e9d5ff', accent: '#9333ea', text: '#581c87' };
  }
  // Âmbar / Plantão
  if (hex.includes('d97706') || hex.includes('amber') || hex.includes('543015') || hex.includes('6b3c1a') || hex.includes('f59e0b') || ev.type === 'on_call') {
    return isDark 
      ? { bg: '#362111', border: '#5c391f', accent: '#9e6234', text: '#fef3c7' }
      : { bg: '#fffbf5', border: '#fed7aa', accent: '#ea580c', text: '#7c2d12' };
  }
  // Esmeralda / Treinamento
  if (hex.includes('059669') || hex.includes('10b981') || hex.includes('163a2a') || hex.includes('1d4734') || ev.type === 'training') {
    return isDark 
      ? { bg: '#132e22', border: '#214e3b', accent: '#368262', text: '#dcfce7' }
      : { bg: '#f4fbf7', border: '#bbf7d0', accent: '#16a34a', text: '#14532d' };
  }
  // Azul Oceano
  if (hex.includes('0284c7') || hex.includes('38bdf8') || hex.includes('18324a') || hex.includes('203a54')) {
    return isDark 
      ? { bg: '#15273b', border: '#244161', accent: '#376899', text: '#e0f2fe' }
      : { bg: '#f4f9fd', border: '#bae6fd', accent: '#0284c7', text: '#0c4a6e' };
  }
  // Rosa Magenta
  if (hex.includes('db2777') || hex.includes('f472b6') || hex.includes('501d33') || hex.includes('682542')) {
    return isDark 
      ? { bg: '#361726', border: '#57263e', accent: '#8c3f66', text: '#fce7f3' }
      : { bg: '#fdf6f9', border: '#fbcfe8', accent: '#db2777', text: '#831843' };
  }

  // Padrão: Coral / Vinho Operacional
  return isDark 
    ? { bg: '#381622', border: '#592638', accent: '#8f3b58', text: '#ffe4e6' }
    : { bg: '#fff5f7', border: '#fecdd3', accent: '#e11d48', text: '#881337' };
}

export const OrbitCalendarView: React.FC<OrbitCalendarViewProps> = ({
  employees,
  shifts,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onAddEmployee,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDate(today), [today]);

  const [view, setView] = useState<'Mês' | 'Semana' | 'Dia'>('Semana');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(today));

  // Filters
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Accordions state & Sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMiniCalendarOpen, setIsMiniCalendarOpen] = useState(true);
  const [calendarsOpen, setCalendarsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  // Checklist filters
  const [filterDaily, setFilterDaily] = useState(true);
  const [filterBirthdays, setFilterBirthdays] = useState(false);
  const [filterTasks, setFilterTasks] = useState(true);

  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(todayStr);

  // Modal de Templates de Horários & Replicar Semanas state
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Day Summary Panel (month view: show all collaborators for a day)
  const [dayPanelDate, setDayPanelDate] = useState<string | null>(null);

  // Mini Calendar Navigation
  const [miniMonthDate, setMiniMonthDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));

  // Departments list from employees
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Drafts count
  const draftShifts = useMemo(() => {
    return shifts.filter(s => s.status === 'draft');
  }, [shifts]);

  // Handler to publish all draft shifts
  const handlePublishAllDrafts = () => {
    draftShifts.forEach(shift => {
      onUpdateShift({
        ...shift,
        status: 'published',
      });
    });
  };

  // Navigation handlers
  const navPrev = () => {
    if (view === 'Mês') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === 'Semana') {
      setWeekStart(addDays(weekStart, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const navNext = () => {
    if (view === 'Mês') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === 'Semana') {
      setWeekStart(addDays(weekStart, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const navToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setWeekStart(startOfWeek(now));
    setMiniMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Main Header Title - Exibe apenas o mês
  const mainTitle = useMemo(() => {
    if (view === 'Semana') {
      const end = addDays(weekStart, 6);
      if (weekStart.getMonth() !== end.getMonth()) {
        return `${MONTHS_PT[weekStart.getMonth()]} / ${MONTHS_PT[end.getMonth()]}`;
      }
      return MONTHS_PT[end.getMonth()];
    }
    return MONTHS_PT[currentDate.getMonth()];
  }, [view, currentDate, weekStart]);

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      // Filter by Collaborator
      if (selectedCollaboratorId && s.employeeId !== selectedCollaboratorId) {
        return false;
      }

      const emp = employees.find(e => e.id === s.employeeId);

      // Filter by Department
      if (selectedDepartment !== 'all' && emp?.department !== selectedDepartment) {
        return false;
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = s.title?.toLowerCase().includes(query);
        const matchName = emp?.name.toLowerCase().includes(query);
        const matchRole = emp?.role.toLowerCase().includes(query);
        const matchTag = s.projectTag?.toLowerCase().includes(query);
        if (!matchTitle && !matchName && !matchRole && !matchTag) {
          return false;
        }
      }

      // Filter by Checklist Types
      if (!filterDaily && s.type === 'regular') return false;
      if (!filterTasks && (s.type === 'meeting' || s.type === 'on_call' || s.type === 'training')) return false;

      return true;
    });
  }, [shifts, employees, selectedCollaboratorId, selectedDepartment, searchQuery, filterDaily, filterTasks]);

  // Events lookup by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const ev of filteredShifts) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [filteredShifts]);

  // Open Modal for New Shift
  const handleOpenCreateShift = (dateStr?: string, timeStr?: string, initialStatus: 'draft' | 'published' = 'published') => {
    if (initialStatus === 'draft') {
      setEditingShift({
        id: '',
        employeeId: selectedCollaboratorId || employees[0]?.id || 'emp-1',
        date: dateStr || todayStr,
        startTime: timeStr || '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'draft',
        attendanceStatus: 'pending',
        type: 'regular',
        title: '',
      } as Shift);
    } else {
      setEditingShift(null);
    }
    setModalInitialDate(dateStr || todayStr);
    setIsShiftModalOpen(true);
  };

  // Open Modal for Edit Shift
  const handleOpenEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setModalInitialDate(shift.date);
    setIsShiftModalOpen(true);
  };

  // Save Shift handler
  const handleSaveShift = (shiftData: Partial<Shift> & { id?: string }, notifyEmployee?: boolean, changeReason?: string) => {
    if (editingShift || shiftData.id) {
      onUpdateShift({
        ...editingShift,
        ...shiftData,
        id: shiftData.id || editingShift?.id || `shift-${Date.now()}`,
      } as Shift, notifyEmployee, changeReason);
    } else {
      onAddShift(shiftData);
    }
    setIsShiftModalOpen(false);
  };

  // Handle applying template shifts to the current week
  const handleApplyTemplate = (template: ShiftTemplate, selectedEmployeeIds: string[]) => {
    // Map dayOfWeek (0=Dom, 1=Seg, ..., 6=Sab) to exact date string in current viewed week
    const dayOfWeekToDate = new Map<number, string>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      dayOfWeekToDate.set(d.getDay(), formatDate(d));
    }

    selectedEmployeeIds.forEach(empId => {
      template.days.forEach(dayCfg => {
        const targetDate = dayOfWeekToDate.get(dayCfg.dayOfWeek);
        if (targetDate) {
          onAddShift({
            employeeId: empId,
            date: targetDate,
            startTime: dayCfg.startTime,
            endTime: dayCfg.endTime,
            breakMinutes: dayCfg.breakMinutes ?? 60,
            status: 'published',
            attendanceStatus: 'pending',
            type: dayCfg.type,
            title: dayCfg.title || template.name,
            color: dayCfg.type === 'on_call' ? ORBIT_COLORS[1] : ORBIT_COLORS[0],
          });
        }
      });
    });
  };

  // Week days array
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Mini Calendar generation
  const miniCalendarCells = useMemo(() => {
    const y = miniMonthDate.getFullYear();
    const m = miniMonthDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();

    const cells: { date: Date; isCurrent: boolean; dateStr: string }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(y, m - 1, daysInPrev - i);
      cells.push({ date: d, isCurrent: false, dateStr: formatDate(d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, isCurrent: true, dateStr: formatDate(dt) });
    }
    const remaining = 35 - cells.length;
    for (let d = 1; d <= (remaining > 0 ? remaining : 7); d++) {
      const dt = new Date(y, m + 1, d);
      cells.push({ date: dt, isCurrent: false, dateStr: formatDate(dt) });
    }
    return cells.slice(0, 35);
  }, [miniMonthDate]);

  // Compute dynamic hours range tailored to the shifts and collaborator's schedule
  const hours = useMemo(() => {
    // If shifts exist in the current filtered set, find their earliest start and latest end
    let minH = 6;
    let maxH = 22;

    if (filteredShifts.length > 0) {
      let shiftMin = 24;
      let shiftMax = 0;
      for (const s of filteredShifts) {
        const sh = parseInt(s.startTime.split(':')[0], 10);
        const eh = parseInt(s.endTime.split(':')[0], 10);
        if (!isNaN(sh)) shiftMin = Math.min(shiftMin, sh);
        if (!isNaN(eh)) shiftMax = Math.max(shiftMax, eh + 1);
      }
      if (shiftMin < 24) minH = Math.max(0, Math.min(shiftMin - 1, 6));
      if (shiftMax > 0) maxH = Math.min(23, Math.max(shiftMax, 22));
    }

    const list: number[] = [];
    for (let h = minH; h <= maxH; h++) {
      list.push(h);
    }
    return list;
  }, [filteredShifts]);

  return (
    <div className={`orbit-calendar flex flex-1 w-full h-full text-slate-100 select-none overflow-hidden manager-scope ${theme} ${isDark ? 'bg-[#0F1117]' : 'bg-[#f4f5f8] text-slate-800'
      }`}>

      {/* 1. Left Vertical Dock (Mini Rail) — Visível no modo escuro e claro */}
      <div className={`orbit-rail w-16 border-r flex flex-col items-center py-4 gap-3 select-none flex-shrink-0 z-20 transition-colors ${
        isDark ? 'bg-[#0B0C10] border-[#222634]' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(prev => !prev)}
          title={isSidebarOpen ? "Recolher painel lateral" : "Expandir painel lateral"}
          className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
            isDark
              ? isSidebarOpen
                ? 'bg-[#1A1C24] border-[#f89847]/40 text-[#f89847] hover:bg-[#252834]'
                : 'bg-[#1A1C24] border-white/10 text-slate-400 hover:text-white hover:bg-[#252834]'
              : isSidebarOpen
                ? 'bg-slate-100 border-[#96183c]/30 text-[#96183c] hover:bg-slate-200'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Quick Action Button */}
        <button
          onClick={() => handleOpenCreateShift()}
          title="Novo Turno"
          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
            isDark
              ? 'bg-[#1A1C24] hover:bg-[#252834] border-white/5 text-slate-300 hover:text-white shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className={`w-8 h-px my-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Collaborator Avatars Column */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2.5 px-1 py-1 w-full">
          {/* Show All option button */}
          <button
            onClick={() => setSelectedCollaboratorId(null)}
            title="Todos os Colaboradores"
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border cursor-pointer ${
              selectedCollaboratorId === null
                ? isDark
                  ? 'border-[#f89847] text-[#faf0ac] shadow-[0_0_12px_rgba(248,152,71,0.4)]'
                  : 'border-[#96183c] text-white shadow-sm'
                : isDark
                  ? 'border-white/10 text-slate-400 hover:text-white bg-[#1A1C24]'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100'
            }`}
            style={selectedCollaboratorId === null ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
            } : undefined}
          >
            ALL
          </button>

          {employees.map((emp) => {
            const isSelected = selectedCollaboratorId === emp.id;
            return (
              <button
                key={emp.id}
                onClick={() => setSelectedCollaboratorId(isSelected ? null : emp.id)}
                title={`${emp.name} (${emp.role})`}
                className={`relative group rounded-full transition-all duration-200 cursor-pointer ${
                  isSelected ? 'ring-2 ring-[#f89847] scale-105 shadow-md' : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
              >
                <img
                  src={emp.avatar}
                  alt={emp.name}
                  className={`w-9 h-9 rounded-full object-cover border ${
                    isDark ? 'border-black/40' : 'border-slate-200'
                  }`}
                />
                {isSelected && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                      isDark ? 'border-[#0B0C10]' : 'border-white'
                    }`}
                    style={{ background: '#f89847' }}
                  />
                )}
              </button>
            );
          })}

          {/* Circular '+' button to open AddUserModal */}
          <button
            type="button"
            onClick={onAddEmployee}
            aria-label="Cadastrar Novo Colaborador (Add User)"
            title="Cadastrar Novo Colaborador (Add User)"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-xs mt-1 cursor-pointer border border-dashed hover:scale-110 active:scale-95 ${
              isDark
                ? 'border-[#f89847]/60 hover:border-[#f89847] text-[#faf0ac]'
                : 'border-[#96183c]/50 hover:border-[#96183c] text-[#96183c] bg-[#96183c]/5 hover:bg-[#96183c]/15'
            }`}
            style={isDark ? {
              background: 'rgba(248, 152, 71, 0.15)',
            } : undefined}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Secondary Left Sidebar (Panel with Mini Calendar & Accordions) */}
      <div
        className={`orbit-sidebar flex flex-col select-none flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen
          ? 'w-64 p-4 overflow-y-auto opacity-100'
          : 'w-0 p-0 border-r-0 overflow-hidden opacity-0 pointer-events-none'
        } ${isDark
          ? 'bg-[#14151C] border-r border-[#222634]'
          : 'bg-white border-r border-slate-200 shadow-2xs'
        }`}
      >

        {/* Mini Calendar Header */}
        <div className="flex items-center justify-between mb-3 min-w-[220px]">
          <button
            onClick={() => setIsMiniCalendarOpen(prev => !prev)}
            className={`flex items-center gap-1.5 text-sm font-bold tracking-tight group cursor-pointer text-left transition-colors ${isDark
              ? 'text-white hover:text-[#f89847]'
              : 'text-slate-800 hover:text-[#96183c]'
            }`}
            title={isMiniCalendarOpen ? "Recolher mini calendário" : "Expandir mini calendário"}
          >
            <span>{MONTHS_PT[miniMonthDate.getMonth()]} {miniMonthDate.getFullYear()}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-700'} ${isMiniCalendarOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>
          <div className="flex items-center gap-1">
            {isMiniCalendarOpen && (
              <>
                <button
                  onClick={() => setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() - 1, 1))}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() + 1, 1))}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Próximo mês"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ml-0.5 cursor-pointer ${isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Fechar painel lateral"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mini Calendar Day Grid */}
        {isMiniCalendarOpen && (
          <div className="min-w-[220px]">
            {/* Mini Calendar Day Headers */}
            <div className={`grid grid-cols-7 text-center text-[10px] font-bold mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {['Do', 'Sg', 'Te', 'Qa', 'Qi', 'Sx', 'Sb'].map((d, i) => (
                <div key={i} className="py-1">{d}</div>
              ))}
            </div>

            {/* Mini Calendar Day Cells */}
            <div className="grid grid-cols-7 gap-1 mb-6 text-center text-xs">
              {miniCalendarCells.map((cell, idx) => {
                const isTodayCell = cell.dateStr === todayStr;
                const isSelectedCell = cell.dateStr === formatDate(currentDate);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentDate(cell.date);
                      setWeekStart(startOfWeek(cell.date));
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium transition-all mx-auto cursor-pointer ${isSelectedCell
                      ? 'font-bold shadow-md'
                      : isTodayCell
                        ? isDark
                          ? 'border border-[#f89847] text-[#faf0ac] font-bold'
                          : 'border border-[#96183c] text-[#96183c] font-bold bg-[#96183c]/5'
                        : cell.isCurrent
                          ? isDark
                            ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          : isDark
                            ? 'text-slate-600 hover:text-slate-400'
                            : 'text-slate-300 hover:text-slate-400'
                    }`}
                    style={isSelectedCell ? {
                      background: 'linear-gradient(135deg, #96183c, #f89847)',
                      color: '#fff',
                    } : undefined}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Accordion 1: Minhas Agendas */}
        <div className={`border-t pt-3 mb-3 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <button
            onClick={() => setCalendarsOpen(!calendarsOpen)}
            className={`w-full flex items-center justify-between text-xs font-bold py-1 transition-colors cursor-pointer ${isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <span>Minhas Agendas</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${calendarsOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {calendarsOpen && (
            <div className={`mt-2 space-y-1.5 pl-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                <input
                  type="checkbox"
                  checked={filterDaily}
                  onChange={(e) => setFilterDaily(e.target.checked)}
                  className={`w-3.5 h-3.5 rounded cursor-pointer ${isDark ? 'accent-[#f89847]' : 'accent-[#96183c]'}`}
                />
                <span>Turnos Regulares</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                <input
                  type="checkbox"
                  checked={filterBirthdays}
                  onChange={(e) => setFilterBirthdays(e.target.checked)}
                  className={`w-3.5 h-3.5 rounded cursor-pointer ${isDark ? 'accent-[#f89847]' : 'accent-[#96183c]'}`}
                />
                <span>Aniversários da Equipe</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                <input
                  type="checkbox"
                  checked={filterTasks}
                  onChange={(e) => setFilterTasks(e.target.checked)}
                  className={`w-3.5 h-3.5 rounded cursor-pointer ${isDark ? 'accent-[#f89847]' : 'accent-[#96183c]'}`}
                />
                <span>Plantões & Tarefas</span>
              </label>
            </div>
          )}
        </div>

        {/* Accordion 2: Favoritos */}
        <div className={`border-t pt-3 mb-3 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <button
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className={`w-full flex items-center justify-between text-xs font-bold py-1 transition-colors cursor-pointer ${isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <span>Favoritos</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${favoritesOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {favoritesOpen && (
            <div className={`mt-2 space-y-1.5 pl-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <button
                onClick={() => setSelectedCollaboratorId(null)}
                className={`w-full text-left transition-colors py-1 px-1.5 rounded-lg cursor-pointer ${
                  isDark ? 'hover:text-[#faf0ac] hover:bg-white/5' : 'hover:text-[#96183c] hover:bg-slate-100'
                }`}
              >
                ★ Todos os Colaboradores
              </button>
              <button
                onClick={() => handleOpenCreateShift()}
                className={`w-full text-left transition-colors py-1 px-1.5 rounded-lg cursor-pointer ${
                  isDark ? 'hover:text-[#faf0ac] hover:bg-white/5' : 'hover:text-[#96183c] hover:bg-slate-100'
                }`}
              >
                + Agendar Reunião de Equipe
              </button>
            </div>
          )}
        </div>

        {/* Accordion 3: Categorias */}
        <div className={`border-t pt-3 mb-3 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <button
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            className={`w-full flex items-center justify-between text-xs font-bold py-1 transition-colors cursor-pointer ${isDark
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <span>Categorias & Legenda</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${categoriesOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {categoriesOpen && (
            <div className={`mt-2 space-y-2 pl-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#96183c] inline-block shadow-[0_0_8px_#96183c]" />
                <span>Operacional / Presencial</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block shadow-[0_0_8px_#d97706]" />
                <span>Plantão / Sobreaviso</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] inline-block shadow-[0_0_8px_#7c3aed]" />
                <span>Reunião / Alinhamento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#059669] inline-block shadow-[0_0_8px_#059669]" />
                <span>Home Office</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] inline-block shadow-[0_0_8px_#0284c7]" />
                <span>Treinamento / Evento</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Team Footer */}
        <div className={`mt-auto pt-3 border-t flex items-center justify-between ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
          <div className="flex -space-x-1.5 overflow-hidden items-center">
            {employees.slice(0, 5).map((emp) => {
              const isSel = selectedCollaboratorId === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedCollaboratorId(isSel ? null : emp.id)}
                  className={`inline-block rounded-full transition-transform hover:scale-110 cursor-pointer ${isSel
                    ? `ring-2 ring-[#f89847] z-10 scale-110`
                    : isDark ? 'ring-2 ring-[#14151C]' : 'ring-2 ring-white shadow-2xs'
                  }`}
                  title={`${emp.name} (${emp.role}) - Clique para filtrar`}
                >
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                </button>
              );
            })}
          </div>
          <button
            onClick={onAddEmployee}
            className={`text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/5'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Adicionar colaborador"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Main Calendar Canvas Area */}
      <div className={`orbit-canvas flex-1 flex flex-col min-w-0 overflow-y-auto relative ${isDark ? 'bg-[#0F1117]' : 'bg-white'
        }`}>

        {/* ================================================================
            HEADER / TOOLBAR
            ================================================================ */}

        {/* ================================================================
            HEADER / FILTROS & AÇÕES — Visíveis e bonitos no modo claro e escuro
            ================================================================ */}
        <div className={`orbit-toolbar sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isDark ? 'bg-[#12131A]/95 border-[#222634]' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}>
          {/* Linha 1 — Busca + filtro por setor | ações principais */}
          <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-2xl">

              {/* Busca por colaborador, turno ou atividade */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-400' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por colaborador, turno ou atividade..."
                  className={`w-full h-9 pl-9 pr-9 rounded-xl border text-xs outline-none transition-all ${
                    isDark
                      ? 'bg-[#1A1C24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#F59242]'
                      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs transition-colors ${
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    aria-label="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro por Setor */}
              <div className="relative flex-shrink-0">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className={`h-9 pl-3.5 pr-9 rounded-xl text-xs font-semibold outline-none appearance-none cursor-pointer transition-all border ${
                    isDark
                      ? 'bg-[#1A1C24] border-white/10 text-slate-200 hover:border-[#F59242]/40 focus:border-[#F59242]'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-[#96183c]'
                  }`}
                >
                  <option value="all" className="text-slate-800">Todos os Setores</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept} className="text-slate-800">
                      {dept}
                    </option>
                  ))}
                </select>
                <Building2 className={`w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`} />
              </div>
            </div>

            {/* Ações superiores: Publicar, Templates de Escalas e Novo Turno */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {draftShifts.length > 0 && (
                <button
                  onClick={handlePublishAllDrafts}
                  className="h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:-translate-y-0.5 shadow-sm cursor-pointer"
                  style={{
                    background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(150,24,60,0.1)',
                    color: isDark ? '#fff' : '#96183c',
                    border: isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(150,24,60,0.3)',
                  }}
                  title="Publicar todas as alterações salvas como rascunho"
                >
                  <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Publicar escala</span>
                  <span className="opacity-80">({draftShifts.length})</span>
                </button>
              )}

              {/* Templates de Escalas */}
              <button
                onClick={() => setIsTemplatesModalOpen(true)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-[#15161b] border border-white/10 text-slate-200 hover:text-[#F9DE97] hover:border-[#F59242]/60 hover:bg-[#F59242]/10'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs'
                }`}
                title="Templates de Horários & Replicar Semanas"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-[#9F243C]/30 text-[#F59242]' : 'bg-[#96183c]/10 text-[#96183c]'
                }`}>
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>Templates de Escalas</span>
              </button>

              {/* Novo turno */}
              <button
                onClick={() => handleOpenCreateShift(undefined, undefined, 'published')}
                className="h-9 px-4 rounded-xl text-xs font-extrabold transition-all hover:-translate-y-0.5 shadow-md flex items-center gap-1.5 cursor-pointer text-white"
                style={{
                  background: 'linear-gradient(135deg, #96183C 0%, #F89847 100%)',
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Novo turno</span>
              </button>
            </div>
          </div>

          {/* Barra de Filtros Ativos (Chips) */}
          {(selectedCollaboratorId || selectedDepartment !== 'all' || searchQuery) && (
            <div className={`px-4 sm:px-6 py-2 border-t flex items-center justify-between gap-3 text-xs ${
              isDark ? 'bg-[#1A1C24]/80 border-[#222634]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Filtros ativos:</span>

                {selectedCollaboratorId && (
                  <span className={`px-2.5 py-1 rounded-full border shadow-2xs ${
                    isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    Colaborador: <strong className={!isDark ? 'text-[#96183c]' : 'text-[#f89642]'}>{employees.find((e) => e.id === selectedCollaboratorId)?.name}</strong>
                  </span>
                )}

                {selectedDepartment !== 'all' && (
                  <span className={`px-2.5 py-1 rounded-full border shadow-2xs ${
                    isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    Setor: <strong className={!isDark ? 'text-[#96183c]' : 'text-[#f89642]'}>{selectedDepartment}</strong>
                  </span>
                )}

                {searchQuery && (
                  <span className={`px-2.5 py-1 rounded-full border shadow-2xs ${
                    isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    Busca: <strong>"{searchQuery}"</strong>
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedCollaboratorId(null);
                  setSelectedDepartment('all');
                  setSearchQuery('');
                }}
                className={`text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  isDark ? 'text-[#F59242] hover:text-[#F9DE97]' : 'text-[#96183c] hover:underline'
                }`}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Calendar Content Area */}
        <div className="orbit-content p-4 sm:p-6 flex-1">

          {/* ─── WEEK VIEW (DEFAULT) ─── */}
          {view === 'Semana' && (
            <div className={`rounded-[32px] overflow-hidden font-sans transition-all duration-300 relative border ${
              isDark ? 'bg-[#0f1115] border-white/5 shadow-2xl text-white' : 'bg-white border-slate-200/80 shadow-xl text-slate-800'
            }`}>

              {/* Top Header & Days Bar with Employee Calendar Gradient Style */}
              <div
                className="p-5 sm:p-6 pb-5 transition-all duration-300"
                style={
                  isDark
                    ? { background: '#15181e' }
                    : {
                        background:
                          'linear-gradient(90deg, #96183c 0%, #b23a41 20%, #cd5f45 42%, #e27d49 65%, #eda05a 82%, #f3c47a 100%)',
                      }
                }
              >
                {/* Linha superior: Título (Mês), Botão 'Hoje', Setas de navegação e Switcher Mês/Semana/Dia */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black capitalize tracking-tight text-white drop-shadow-xs calendar-month-title" style={{ color: '#ffffff' }}>
                      {MONTHS_PT[weekStart.getMonth()]}
                    </h2>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={navToday}
                        className={`px-4 py-1.5 rounded-full font-bold text-xs text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
                          !isDark ? 'bg-[#5b0d23] hover:bg-[#4a091b]' : 'bg-[#96183C] hover:bg-[#801433]'
                        }`}
                      >
                        Hoje
                      </button>

                      <div className={`flex items-center gap-0.5 p-1 rounded-full border transition-colors ${
                        !isDark
                          ? 'bg-white/40 border-white/20 text-[#5b0d23] backdrop-blur-xs'
                          : 'bg-[#1a1d24] border-white/5 text-white/70'
                      }`}>
                        <button
                          onClick={navPrev}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            !isDark
                              ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                              : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                          }`}
                          title="Semana anterior"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          onClick={navNext}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            !isDark
                              ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                              : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                          }`}
                          title="Próxima semana"
                        >
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Seletor Mês | Semana | Dia */}
                  <div className="flex items-center justify-end">
                    <div className={`flex items-center p-1 rounded-full border transition-colors ${
                      !isDark
                        ? 'bg-white/25 border-white/30 backdrop-blur-xs'
                        : 'bg-[#1a1d24] border-white/5'
                    }`}>
                      {(['Mês', 'Semana', 'Dia'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setView(mode)}
                          className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                            view === mode
                              ? 'bg-white text-slate-800 font-bold shadow-sm'
                              : !isDark
                                ? 'text-white/85 hover:text-white hover:bg-white/10'
                                : 'text-white/70 hover:text-white hover:bg-[#96183c]'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 7 Cartões Flutuantes dos Dias da Semana (alinhados com a grade de horas abaixo) */}
                <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[56px_1fr] gap-3">
                  {/* Espaçador transparente para alinhar perfeitamente com a coluna de horas */}
                  <div className="w-12 sm:w-14 shrink-0" aria-hidden="true" />

                  <div className="grid grid-cols-7 gap-2.5">
                    {weekDays.map((d) => {
                      const dateStr = formatDate(d);
                      const isSelected = dateStr === formatDate(currentDate);
                      const dayNameShort = DAYS_SHORT[d.getDay()];

                      return (
                        <div
                          key={dateStr}
                          onClick={() => {
                            setCurrentDate(d);
                          }}
                          className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all cursor-pointer ${
                            isSelected
                              ? !isDark
                                ? 'bg-white text-slate-900 shadow-sm border-2 border-[#e65a37] scale-[1.01]'
                                : 'bg-[#96183c] text-white shadow-lg shadow-[#96183c]/30 border border-white/20 scale-[1.01]'
                              : !isDark
                                ? 'bg-[#fce5dc]/95 hover:bg-[#fff0e8] border border-white/40 text-slate-800 shadow-2xs hover:scale-[1.01]'
                                : 'bg-[#1a1d24] text-white/70 border border-white/5 hover:border-[#96183c] hover:bg-[#96183c]/25 hover:text-white'
                          }`}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            isSelected
                              ? !isDark ? 'text-[#e65a37]' : 'opacity-90'
                              : !isDark ? 'text-slate-500' : 'opacity-80'
                          }`}>
                            {dayNameShort}
                          </span>
                          <span className={`text-2xl font-black tracking-tight ${
                            isSelected
                              ? !isDark ? 'text-black' : 'text-white'
                              : !isDark ? 'text-slate-900' : 'text-white'
                          }`}>
                            {d.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Timetable Grid — Fundo Branco Puro conforme Imagem */}
              <div className={`w-full p-5 sm:p-6 transition-all relative ${
                isDark ? 'bg-[#0f1115] border-t border-white/5' : 'bg-white border-t border-slate-100'
              }`}>
                <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[56px_1fr] gap-3">

                  {/* Hour labels column */}
                  <div className="space-y-11 pt-2 text-right pr-2">
                    {hours.map((h) => {
                      const label = h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h}:00`;
                      return (
                        <div key={h} className={`text-xs font-mono font-medium h-5 ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  {/* 7 Days Columns with Events */}
                  <div className="grid grid-cols-7 gap-2.5 relative" style={{ minHeight: `${hours.length * 64}px` }}>

                    {/* Linhas sutis de fundo */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-40">
                      {hours.map((h) => (
                        <div
                          key={h}
                          className={`border-b h-16 ${isDark ? 'border-white/5' : 'border-slate-100'}`}
                        />
                      ))}
                    </div>

                    {weekDays.map((date, dayIdx) => {
                      const dateStr = formatDate(date);
                      const dayEvents = eventsByDate[dateStr] || [];

                      return (
                        <div
                          key={dayIdx}
                          className="flex flex-col relative z-10"
                          style={{ minHeight: `${hours.length * 64}px` }}
                        >
                          {/* Hour slot background lines for click to create */}
                          <div className="absolute inset-0 flex flex-col pointer-events-auto">
                            {hours.map((h) => {
                              return (
                                <div
                                  key={h}
                                  onClick={() => {
                                    setCurrentDate(date);
                                    setDayPanelDate(dateStr);
                                  }}
                                  className={`h-16 cursor-pointer transition-colors ${
                                    isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-[#fff8f6]/60'
                                  }`}
                                  title={`Abrir resumo do dia ${dateStr}`}
                                />
                              );
                            })}
                          </div>

                          {/* Placed Event Cards — Absolute positioned with guaranteed minimum height */}
                          <div className="absolute inset-0 p-1 pointer-events-none">
                            {(() => {
                              const baseH = hours[0] ?? 0;
                              const CARD_HEIGHT = 84;

                              // Calculate vertical position for each event
                              const eventsWithPos = dayEvents.map((ev) => {
                                const [sH, sM] = ev.startTime.split(':').map(Number);
                                const startH = isNaN(sH) ? baseH : sH;
                                const startM = isNaN(sM) ? 0 : sM;
                                const topOffset = Math.max(0, ((startH - baseH) + (startM / 60)) * 64);
                                return { ev, topOffset };
                              }).sort((a, b) => a.topOffset - b.topOffset);

                              // Group into overlap clusters where two events overlap if topOffset difference < CARD_HEIGHT
                              const clusters: Array<typeof eventsWithPos> = [];
                              for (const item of eventsWithPos) {
                                let placed = false;
                                for (const cluster of clusters) {
                                  const last = cluster[cluster.length - 1];
                                  if (item.topOffset < last.topOffset + CARD_HEIGHT) {
                                    cluster.push(item);
                                    placed = true;
                                    break;
                                  }
                                }
                                if (!placed) {
                                  clusters.push([item]);
                                }
                              }

                              return clusters.flatMap((cluster) => {
                                const count = cluster.length;
                                return cluster.map((item, idx) => {
                                  const { ev, topOffset } = item;
                                  const emp = employees.find((e) => e.id === ev.employeeId);
                                  const isDraft = ev.status === 'draft';
                                  const mutedStyle = getMutedShiftColor(ev, isDark);

                                  let leftStyle = '4px';
                                  let widthStyle = 'calc(100% - 8px)';
                                  let zIndex = 10 + idx;

                                  if (count === 2) {
                                    if (idx === 0) {
                                      leftStyle = '4px';
                                      widthStyle = 'calc(50% - 6px)';
                                    } else {
                                      leftStyle = 'calc(50% + 2px)';
                                      widthStyle = 'calc(50% - 6px)';
                                    }
                                  } else if (count > 2) {
                                    const step = Math.min(18, 60 / count);
                                    leftStyle = `${4 + idx * step}px`;
                                    widthStyle = `calc(100% - ${4 + idx * step + 4}px)`;
                                  }

                                  return (
                                    <div
                                      key={ev.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditShift(ev);
                                      }}
                                      className="pointer-events-auto rounded-xl p-2.5 cursor-pointer shadow-md transition-all duration-150 hover:scale-[1.02] hover:z-30 hover:shadow-xl text-left absolute overflow-hidden group/shift flex flex-col justify-between shrink-0"
                                      style={{
                                        top: `${topOffset}px`,
                                        left: leftStyle,
                                        width: widthStyle,
                                        minHeight: `${CARD_HEIGHT}px`,
                                        background: isDraft ? (isDark ? 'rgba(217, 119, 6, 0.18)' : 'rgba(217, 119, 6, 0.12)') : mutedStyle.bg,
                                        border: isDraft ? '2px dashed #f59e0b' : `1px solid ${mutedStyle.border}`,
                                        borderLeft: isDraft ? '2px dashed #f59e0b' : `3.5px solid ${mutedStyle.accent}`,
                                        backdropFilter: 'blur(6px)',
                                        boxShadow: isDraft
                                          ? '0 0 14px rgba(245, 158, 11, 0.18)'
                                          : isDark ? '0 4px 14px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
                                        zIndex,
                                      }}
                                    >
                                      {/* Draft background stripes */}
                                      {isDraft && (
                                        <div
                                          className="absolute inset-0 pointer-events-none opacity-20"
                                          style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0, #f59e0b 8px, transparent 8px, transparent 16px)',
                                          }}
                                        />
                                      )}

                                      {/* Top row: Title and Badge (Publicado / Rascunho) */}
                                      <div className="flex items-center justify-between gap-1 mb-1 relative z-10">
                                        <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                          {ev.title || 'Turno'}
                                        </span>

                                        {isDraft ? (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-dashed border-amber-500/50 font-mono tracking-wider shrink-0">
                                            📝 Rascunho
                                          </span>
                                        ) : (
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium border shrink-0 ${
                                            isDark 
                                              ? 'bg-white/10 text-slate-200 border-white/15' 
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }`}>
                                            ✓ Publicado
                                          </span>
                                        )}
                                      </div>

                                      {/* Time Row */}
                                      <div className={`text-[11px] font-mono font-medium mb-1 relative z-10 ${
                                        isDark ? 'text-slate-300 opacity-90' : 'text-slate-600'
                                      }`}>
                                        {ev.startTime} - {ev.endTime}
                                      </div>

                                      {/* Assigned Collaborator Avatar + Name */}
                                      <div className="flex items-center gap-1.5 mt-auto relative z-10">
                                        {emp && (
                                          <img
                                            src={emp.avatar}
                                            alt={emp.name}
                                            title={emp.name}
                                            className={`w-5 h-5 rounded-full object-cover ring-1 ${
                                              isDark ? 'ring-white/20' : 'ring-slate-300'
                                            }`}
                                          />
                                        )}
                                        <span className={`text-[10px] font-medium truncate ${
                                          isDark ? 'text-slate-300' : 'text-slate-700'
                                        }`}>
                                          {emp?.name.split(' ')[0]}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                });
                              });
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── MONTH VIEW ─── */}
          {view === 'Mês' && (
            <div className="flex flex-col">
              {/* Header do Mês com estilo degradê */}
              <div
                className="p-5 sm:p-6 pb-4 sm:pb-5 transition-all duration-300 rounded-3xl mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={
                  isDark
                    ? { background: '#15181e' }
                    : {
                        background:
                          'linear-gradient(90deg, #96183c 0%, #b23a41 20%, #cd5f45 42%, #e27d49 65%, #eda05a 82%, #f3c47a 100%)',
                      }
                }
              >
                <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black capitalize tracking-tight text-white drop-shadow-xs calendar-month-title" style={{ color: '#ffffff' }}>
                    {MONTHS_PT[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={navToday}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
                        !isDark ? 'bg-[#5b0d23] hover:bg-[#4a091b]' : 'bg-[#96183C] hover:bg-[#801433]'
                      }`}
                    >
                      Hoje
                    </button>

                    <div className={`flex items-center gap-0.5 p-1 rounded-full border transition-colors ${
                      !isDark
                        ? 'bg-white/40 border-white/20 text-[#5b0d23] backdrop-blur-xs'
                        : 'bg-[#1a1d24] border-white/5 text-white/70'
                    }`}>
                      <button
                        onClick={navPrev}
                        className={`p-1 rounded-full transition-colors cursor-pointer ${
                          !isDark
                            ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                            : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                        }`}
                        title="Mês anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={navNext}
                        className={`p-1 rounded-full transition-colors cursor-pointer ${
                          !isDark
                            ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                            : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                        }`}
                        title="Próximo mês"
                      >
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seletor Mês | Semana | Dia */}
                <div className="flex items-center justify-end">
                  <div className={`flex items-center p-1 rounded-full border transition-colors ${
                    !isDark
                      ? 'bg-white/25 border-white/30 backdrop-blur-xs'
                      : 'bg-[#1a1d24] border-white/5'
                  }`}>
                    {(['Mês', 'Semana', 'Dia'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setView(mode)}
                        className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                          view === mode
                            ? 'bg-white text-slate-800 font-bold shadow-sm'
                            : !isDark
                              ? 'text-white/85 hover:text-white hover:bg-white/10'
                              : 'text-white/70 hover:text-white hover:bg-[#96183c]'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400">
                {DAYS_SHORT.map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {miniCalendarCells.map((cell, idx) => {
                  const dateStr = cell.dateStr;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isTodayCell = dateStr === todayStr;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!cell.isCurrent) return;
                        setCurrentDate(cell.date);
                        setDayPanelDate(dateStr);
                      }}
                      className={`orbit-month-cell min-h-[100px] rounded-2xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between ${
                        isTodayCell
                          ? isDark
                            ? 'bg-[#1E202B] border-[#f89847]'
                            : 'bg-[#fff5f2] border-2 border-[#e65a37] shadow-sm'
                          : cell.isCurrent
                            ? isDark
                              ? 'bg-[#14151C] border-white/5 hover:bg-[#1A1C24]'
                              : 'bg-white border-slate-200/80 hover:bg-slate-50 shadow-2xs'
                            : 'bg-transparent border-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isTodayCell
                              ? 'text-white font-black shadow-xs'
                              : isDark
                                ? 'text-slate-300'
                                : 'text-slate-800'
                          }`}
                          style={isTodayCell ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : undefined}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Shift chips */}
                      <div className="flex flex-col gap-1 mt-1">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const isDraft = ev.status === 'draft';
                          const mutedStyle = getMutedShiftColor(ev, isDark);
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentDate(cell.date);
                                handleOpenEditShift(ev);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate transition-all ${isDraft
                                ? 'border-2 border-dashed border-amber-400 bg-amber-500/20 text-amber-200'
                                : 'border shadow-2xs'
                                }`}
                              style={!isDraft ? { 
                                background: mutedStyle.bg,
                                borderColor: mutedStyle.border,
                                borderLeft: `3px solid ${mutedStyle.accent}`,
                                color: isDark ? '#f1f5f9' : '#1e293b'
                              } : undefined}
                            >
                              {isDraft ? '📝 ' : '✓ '} {ev.startTime} {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className={`text-[9px] pl-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            +{dayEvents.length - 2} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── DAY VIEW ─── */}
          {view === 'Dia' && (
            <div className="flex flex-col">
              {/* Header do Dia com estilo degradê */}
              <div
                className="p-5 sm:p-6 pb-4 sm:pb-5 transition-all duration-300 rounded-3xl mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={
                  isDark
                    ? { background: '#15181e' }
                    : {
                        background:
                          'linear-gradient(90deg, #96183c 0%, #b23a41 20%, #cd5f45 42%, #e27d49 65%, #eda05a 82%, #f3c47a 100%)',
                      }
                }
              >
                <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black capitalize tracking-tight text-white drop-shadow-xs calendar-month-title" style={{ color: '#ffffff' }}>
                    {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={navToday}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
                        !isDark ? 'bg-[#5b0d23] hover:bg-[#4a091b]' : 'bg-[#96183C] hover:bg-[#801433]'
                      }`}
                    >
                      Hoje
                    </button>

                    <div className={`flex items-center gap-0.5 p-1 rounded-full border transition-colors ${
                      !isDark
                        ? 'bg-white/40 border-white/20 text-[#5b0d23] backdrop-blur-xs'
                        : 'bg-[#1a1d24] border-white/5 text-white/70'
                    }`}>
                      <button
                        onClick={navPrev}
                        className={`p-1 rounded-full transition-colors cursor-pointer ${
                          !isDark
                            ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                            : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                        }`}
                        title="Dia anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={navNext}
                        className={`p-1 rounded-full transition-colors cursor-pointer ${
                          !isDark
                            ? 'hover:bg-white/30 text-[#5b0d23] hover:text-black'
                            : 'hover:bg-[#96183c] text-white/70 hover:text-white'
                        }`}
                        title="Próximo dia"
                      >
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seletor Mês | Semana | Dia */}
                <div className="flex items-center justify-end">
                  <div className={`flex items-center p-1 rounded-full border transition-colors ${
                    !isDark
                      ? 'bg-white/25 border-white/30 backdrop-blur-xs'
                      : 'bg-[#1a1d24] border-white/5'
                  }`}>
                    {(['Mês', 'Semana', 'Dia'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setView(mode)}
                        className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                          view === mode
                            ? 'bg-white text-slate-800 font-bold shadow-sm'
                            : !isDark
                              ? 'text-white/85 hover:text-white hover:bg-white/10'
                              : 'text-white/70 hover:text-white hover:bg-[#96183c]'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Painel de Horas do Dia */}
              <div className={`orbit-day-panel w-full flex flex-col rounded-3xl border p-5 sm:p-6 ${
                isDark ? 'bg-[#14151C] border-white/5' : 'bg-white border-slate-200/90 shadow-sm'
              }`}>
                <div className="flex flex-col gap-2">
                  {hours.map((h) => {
                    const dateStr = formatDate(currentDate);
                    const timeStr = `${String(h).padStart(2, '0')}:00`;
                    const dayEvents = (eventsByDate[dateStr] || []).filter((ev) => {
                      const sh = parseInt(ev.startTime.split(':')[0]);
                      return sh === h;
                    });

                    return (
                      <div key={h} className={`flex gap-4 border-b py-2 group ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                      }`}>
                        <div className={`w-16 font-mono text-xs pt-1 text-right ${
                          isDark ? 'text-slate-500' : 'text-slate-400 font-semibold'
                        }`}>
                          {timeStr}
                        </div>
                        <div
                          className={`flex-1 min-h-[50px] rounded-xl p-2 transition-colors cursor-pointer flex flex-col gap-2 ${
                            isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => handleOpenCreateShift(dateStr, timeStr)}
                        >
                          {dayEvents.map((ev) => {
                            const emp = employees.find((e) => e.id === ev.employeeId);
                            const isDraft = ev.status === 'draft';
                            const mutedStyle = getMutedShiftColor(ev, isDark);

                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditShift(ev);
                                }}
                                className={`p-3 rounded-2xl flex items-center justify-between shadow-md transition-all ${isDraft
                                  ? 'border-2 border-dashed border-amber-400 bg-amber-500/20 text-amber-200'
                                  : 'border'
                                  }`}
                                style={!isDraft ? {
                                  background: mutedStyle.bg,
                                  borderColor: mutedStyle.border,
                                  borderLeft: `4px solid ${mutedStyle.accent}`,
                                  color: isDark ? '#f1f5f9' : '#1e293b'
                                } : undefined}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ev.title}</h4>
                                    {isDraft ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-dashed border-amber-500/50 font-mono">
                                        📝 RASCUNHO
                                      </span>
                                    ) : (
                                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                                        isDark ? 'bg-white/10 text-slate-200 border-white/15' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        ✓ PUBLICADO
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs mt-0.5 font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{ev.startTime} às {ev.endTime}</p>
                                </div>
                                {emp && (
                                  <div className="flex items-center gap-2">
                                    <img src={emp.avatar} alt={emp.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/30" />
                                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{emp.name}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── DAY SUMMARY PANEL ─── */}
      {dayPanelDate && (() => {
        const panelDate = new Date(dayPanelDate + 'T00:00:00');
        const panelEvents = eventsByDate[dayPanelDate] || [];
        const formattedDay = panelDate.toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(10,11,18,0.80)', backdropFilter: 'blur(6px)' }}
            onClick={() => setDayPanelDate(null)}
          >
            <div
              className={`relative w-full max-w-lg mx-4 rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
                isDark ? 'bg-[#14151C] border-white/10' : 'bg-white border-slate-200'
              }`}
              style={{ maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-start justify-between p-6 pb-4 border-b ${
                isDark ? 'border-white/8' : 'border-slate-100'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(135deg,#96183c,#f89847)' }}>
                      <Users size={14} className="text-white" />
                    </span>
                    <h2 className={`font-bold text-base capitalize ${isDark ? 'text-white' : 'text-slate-900'}`}>{formattedDay}</h2>
                  </div>
                  <p className={`text-xs ml-9 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {panelEvents.length === 0
                      ? 'Nenhum colaborador escalado'
                      : `${panelEvents.length} colaborador${panelEvents.length > 1 ? 'es' : ''} escalado${panelEvents.length > 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => setDayPanelDate(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Collaborator list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                {panelEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                      <Users size={26} className={isDark ? "text-slate-500" : "text-slate-400"} />
                    </div>
                    <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma escala para este dia</p>
                  </div>
                ) : (
                  panelEvents.map((ev) => {
                    const emp = employees.find(e => e.id === ev.employeeId);
                    const isDraft = ev.status === 'draft';
                    const orbitColor = ev.color;

                    return (
                      <button
                        key={ev.id}
                        onClick={() => {
                          setDayPanelDate(null);
                          handleOpenEditShift(ev);
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group cursor-pointer ${
                          isDark
                            ? 'border-white/8 bg-[#1A1C24] hover:bg-[#1E202B] hover:border-[#f89847]/40'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-[#96183c]/30 shadow-2xs'
                        }`}
                      >
                        {/* Avatar */}
                        {emp ? (
                          <div className="relative flex-shrink-0">
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className={`w-11 h-11 rounded-full object-cover ring-2 transition-all ${
                                isDark ? 'ring-white/10 group-hover:ring-[#f89847]/60' : 'ring-slate-200 group-hover:ring-[#96183c]/60'
                              }`}
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                                isDark ? 'border-[#1A1C24]' : 'border-white'
                              } ${isDraft ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            />
                          </div>
                        ) : (
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                            <Users size={18} className={isDark ? "text-slate-400" : "text-slate-600"} />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {emp?.name ?? 'Colaborador'}
                            </span>
                            {isDraft ? (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                RASCUNHO
                              </span>
                            ) : (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                                PUBLICADO
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{emp?.role ?? ''}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {orbitColor && (
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: orbitColor.bg }}
                              />
                            )}
                            <span className={`text-[11px] font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {ev.title || 'Turno Regular'}
                            </span>
                          </div>
                        </div>

                        {/* Time badge */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 ${
                            isDark ? 'bg-white/5' : 'bg-white border border-slate-200 shadow-2xs'
                          }`}>
                            <Clock size={11} className={isDark ? "text-[#f89847]" : "text-[#96183c]"} />
                            <span className={`text-[11px] font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
                              {ev.startTime}–{ev.endTime}
                            </span>
                          </div>
                          <span className={`text-[10px] pr-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ver detalhes →</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer: add new shift */}
              <div className={`p-4 pt-3 border-t mt-1 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <button
                  onClick={() => {
                    setDayPanelDate(null);
                    handleOpenCreateShift(dayPanelDate);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 cursor-pointer shadow-md text-white"
                  style={{ background: 'linear-gradient(135deg,#96183c,#f89847)' }}
                >
                  <Plus size={16} />
                  Adicionar turno para este dia
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Shift Modal: OrbitShiftModal (exact design and styles requested in Item 6) */}
      <OrbitShiftModal
        isOpen={isShiftModalOpen}
        initialDate={modalInitialDate}
        editingShift={editingShift}
        employees={employees}
        onSave={handleSaveShift}
        onDelete={(id) => {
          onDeleteShift(id);
          setIsShiftModalOpen(false);
        }}
        onClose={() => setIsShiftModalOpen(false)}
      />

      {/* 5. Shift Templates Modal: Templates de Horários & Replicar Semanas */}
      <ShiftTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        employees={employees}
        currentWeekStart={weekStart}
        currentWeekShifts={filteredShifts}
        onApplyTemplate={handleApplyTemplate}
        theme={theme}
      />

    </div>
  );
};
