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
  Radio
} from 'lucide-react';
import { Employee, Shift } from '../types';
import { OrbitShiftModal, ORBIT_COLORS } from './OrbitShiftModal';

interface OrbitCalendarViewProps {
  employees: Employee[];
  shifts: Shift[];
  onAddShift: (shift: Partial<Shift>) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  onAddEmployee: () => void;
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

export const OrbitCalendarView: React.FC<OrbitCalendarViewProps> = ({
  employees,
  shifts,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onAddEmployee,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDate(today), [today]);

  const [view, setView] = useState<'Mês' | 'Semana' | 'Dia'>('Semana');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(today));
  
  // Filters
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Accordions state
  const [calendarsOpen, setCalendarsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  // Checklist filters
  const [filterDaily, setFilterDaily] = useState(true);
  const [filterBirthdays, setFilterBirthdays] = useState(false);
  const [filterTasks, setFilterTasks] = useState(true);

  // Modal de Turno (OrbitShiftModal) state
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(todayStr);

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

  // Main Header Title
  const mainTitle = useMemo(() => {
    if (view === 'Mês') {
      return `${MONTHS_PT[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === 'Semana') {
      const end = addDays(weekStart, 6);
      return `${weekStart.getDate()} - ${end.getDate()} de ${MONTHS_PT[end.getMonth()]}, ${end.getFullYear()}`;
    }
    return `${currentDate.getDate()} de ${MONTHS_PT[currentDate.getMonth()]}, ${currentDate.getFullYear()}`;
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
  const handleSaveShift = (shiftData: Partial<Shift> & { id?: string }) => {
    if (editingShift || shiftData.id) {
      onUpdateShift({
        ...editingShift,
        ...shiftData,
        id: shiftData.id || editingShift?.id || `shift-${Date.now()}`,
      } as Shift);
    } else {
      onAddShift(shiftData);
    }
    setIsShiftModalOpen(false);
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

  // Hours list for week/day view (08:00 to 20:00)
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  return (
    <div className="flex flex-1 w-full h-full bg-[#0F1117] text-slate-100 select-none overflow-hidden">
      
      {/* 1. Left Vertical Dock (Mini Rail) */}
      <div className="w-16 bg-[#0B0C10] border-r border-[#222634] flex flex-col items-center py-4 gap-3 select-none flex-shrink-0 z-20">
        {/* Top Squircle Logo Icon */}
        <div 
          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #96183c, #f89847)',
          }}
          title="Pontual Orbit"
        >
          <Sparkles className="w-5 h-5 text-[#faf0ac]" />
        </div>

        {/* Quick Action Button */}
        <button
          onClick={() => handleOpenCreateShift()}
          title="Novo Turno"
          className="w-9 h-9 rounded-xl bg-[#1A1C24] hover:bg-[#252834] border border-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-8 h-px bg-white/10 my-1" />

        {/* Collaborator Avatars Column */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2.5 px-1 py-1 w-full">
          {/* Show All option button */}
          <button
            onClick={() => setSelectedCollaboratorId(null)}
            title="Todos os Colaboradores"
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border ${
              selectedCollaboratorId === null
                ? 'border-[#f89847] text-[#faf0ac] shadow-[0_0_12px_rgba(248,152,71,0.4)]'
                : 'border-white/10 text-slate-400 hover:text-white bg-[#1A1C24]'
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
                className={`relative group rounded-full transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-[#f89847] scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
              >
                <img
                  src={emp.avatar}
                  alt={emp.name}
                  className="w-9 h-9 rounded-full object-cover border border-black/40"
                />
                {isSelected && (
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B0C10]"
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
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md mt-1 cursor-pointer border border-dashed border-[#f89847]/60 hover:border-[#f89847] hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(248, 152, 71, 0.15)',
            }}
          >
            <Plus className="w-4 h-4 text-[#faf0ac]" />
          </button>
        </div>
      </div>

      {/* 2. Secondary Left Sidebar (Dark Panel with Mini Calendar & Accordions) */}
      <div className="w-64 bg-[#14151C] border-r border-[#222634] flex flex-col p-4 overflow-y-auto select-none flex-shrink-0">
        
        {/* Mini Calendar Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white tracking-tight">
            {MONTHS_PT[miniMonthDate.getMonth()]} {miniMonthDate.getFullYear()}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() - 1, 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() + 1, 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mini Calendar Day Headers */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 mb-1">
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium transition-all mx-auto ${
                  isSelectedCell
                    ? 'font-bold shadow-md'
                    : isTodayCell
                    ? 'border border-[#f89847] text-[#faf0ac] font-bold'
                    : cell.isCurrent
                    ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
                style={isSelectedCell ? {
                  background: 'linear-gradient(135deg, #96183c, #f89847)',
                  color: '#faf0ac',
                } : undefined}
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Accordion 1: Minhas Agendas */}
        <div className="border-t border-white/5 pt-3 mb-3">
          <button
            onClick={() => setCalendarsOpen(!calendarsOpen)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white py-1 transition-colors"
          >
            <span>Minhas Agendas</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${calendarsOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {calendarsOpen && (
            <div className="mt-2 space-y-1.5 pl-1 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={filterDaily}
                  onChange={(e) => setFilterDaily(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f89847] cursor-pointer"
                />
                <span>Turnos Regulares</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={filterBirthdays}
                  onChange={(e) => setFilterBirthdays(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f89847] cursor-pointer"
                />
                <span>Aniversários da Equipe</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={filterTasks}
                  onChange={(e) => setFilterTasks(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f89847] cursor-pointer"
                />
                <span>Plantões & Tarefas</span>
              </label>
            </div>
          )}
        </div>

        {/* Accordion 2: Favoritos */}
        <div className="border-t border-white/5 pt-3 mb-3">
          <button
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white py-1 transition-colors"
          >
            <span>Favoritos</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${favoritesOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {favoritesOpen && (
            <div className="mt-2 space-y-1.5 pl-1 text-xs text-slate-400">
              <button 
                onClick={() => setSelectedCollaboratorId(null)}
                className="w-full text-left hover:text-[#faf0ac] transition-colors py-0.5"
              >
                ★ Todos os Colaboradores
              </button>
              <button 
                onClick={() => handleOpenCreateShift()}
                className="w-full text-left hover:text-[#faf0ac] transition-colors py-0.5"
              >
                + Agendar Reunião de Equipe
              </button>
            </div>
          )}
        </div>

        {/* Accordion 3: Categorias */}
        <div className="border-t border-white/5 pt-3 mb-3">
          <button
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white py-1 transition-colors"
          >
            <span>Categorias & Legenda</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${categoriesOpen ? 'rotate-0' : '-rotate-90'}`} />
          </button>

          {categoriesOpen && (
            <div className="mt-2 space-y-2 pl-1 text-xs text-slate-300">
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
        <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex -space-x-1.5 overflow-hidden">
            {employees.slice(0, 4).map((emp) => (
              <img
                key={emp.id}
                src={emp.avatar}
                alt={emp.name}
                className="inline-block h-6 w-6 rounded-full ring-2 ring-[#14151C]"
              />
            ))}
          </div>
          <button 
            onClick={onAddEmployee}
            className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
            title="Adicionar colaborador"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Main Calendar Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0F1117] overflow-y-auto relative">
        
        {/* Toolbar: Features from Grade de Escalas (Item 3) */}
        <div className="p-3 sm:px-6 bg-[#12131A] border-b border-[#222634] flex flex-wrap items-center justify-between gap-3">
          
          {/* Left Toolbar: Search & Department Filter */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por colaborador, turno ou atividade..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#f89847] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-[#1A1C24] border border-white/10 rounded-xl text-xs font-semibold text-slate-200 outline-none focus:border-[#f89847] transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Todos os Setores</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <Building2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Right Toolbar: Publicar Escala / Rascunhos & Legenda Rápida */}
          <div className="flex items-center gap-3">
            {/* Publicar Escala Button */}
            {draftShifts.length > 0 ? (
              <button
                onClick={handlePublishAllDrafts}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #96183c, #f89847)',
                  color: '#faf0ac',
                }}
                title="Publicar todas as alterações salvas como rascunho"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Publicar Escala ({draftShifts.length} rascunhos)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Escala 100% Publicada</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Top Header Bar */}
        <div className="p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#222634] bg-[#12131A]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {mainTitle}
            </h2>

            <button
              onClick={navToday}
              className="px-3.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #96183c, #f89847)',
                color: '#faf0ac',
              }}
            >
              Hoje
            </button>

            <div className="flex items-center gap-1 bg-[#1A1C24] p-0.5 rounded-lg border border-white/5">
              <button
                onClick={navPrev}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={navNext}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Próximo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Controls: View Switcher & Action Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#181922] p-1 rounded-xl border border-white/10 text-xs">
              {(['Mês', 'Semana', 'Dia'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    view === mode
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenCreateShift(undefined, undefined, 'draft')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:bg-amber-500/15 border border-dashed border-amber-500/50 text-amber-300 flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
              title="Criar um novo turno salvo diretamente como rascunho"
            >
              <span>📝</span>
              <span>Criar Rascunho</span>
            </button>

            <button
              onClick={() => handleOpenCreateShift(undefined, undefined, 'published')}
              className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 shadow-md flex items-center gap-1.5 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #96183c, #f89847)',
                color: '#faf0ac',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Novo Turno</span>
            </button>
          </div>
        </div>

        {/* Active Filter Pill */}
        {(selectedCollaboratorId || selectedDepartment !== 'all' || searchQuery) && (
          <div className="px-6 py-2 bg-[#1A1C24]/80 border-b border-[#222634] flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              {selectedCollaboratorId && (
                <span className="text-slate-300">
                  Colaborador:{' '}
                  <strong className="text-[#faf0ac]">
                    {employees.find((e) => e.id === selectedCollaboratorId)?.name}
                  </strong>
                </span>
              )}
              {selectedDepartment !== 'all' && (
                <span className="text-slate-300">
                  Setor: <strong className="text-[#faf0ac]">{selectedDepartment}</strong>
                </span>
              )}
              {searchQuery && (
                <span className="text-slate-300">
                  Busca: <strong className="text-[#faf0ac]">"{searchQuery}"</strong>
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedCollaboratorId(null);
                setSelectedDepartment('all');
                setSearchQuery('');
              }}
              className="text-xs text-[#f89847] hover:underline font-semibold"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}

        {/* Calendar Content Area */}
        <div className="p-4 sm:p-6 flex-1">
          
          {/* ─── WEEK VIEW (DEFAULT) ─── */}
          {view === 'Semana' && (
            <div className="flex flex-col">
              
              {/* Week Day Header Cards */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 mb-3">
                {/* Timezone pill */}
                <div className="flex items-center justify-center rounded-xl p-2 bg-[#1A1C24] border border-white/5 text-[11px] font-mono font-bold text-slate-400">
                  GMT-3
                </div>

                {weekDays.map((date, idx) => {
                  const dateStr = formatDate(date);
                  const isTodayDate = dateStr === todayStr;
                  const isSelected = dateStr === formatDate(currentDate);

                  return (
                    <div
                      key={idx}
                      onClick={() => setCurrentDate(date)}
                      className={`rounded-2xl p-2.5 text-center cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'shadow-lg scale-[1.02]'
                          : isTodayDate
                          ? 'bg-[#1E202B] border-2 border-[#f89847] text-white'
                          : 'bg-[#14151C] border border-white/5 hover:bg-[#1A1C24] text-slate-300'
                      }`}
                      style={isSelected ? {
                        background: 'linear-gradient(135deg, #96183c, #f89847)',
                        color: '#faf0ac',
                      } : undefined}
                    >
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? 'text-[#faf0ac]/80' : 'text-slate-400'}`}>
                        {DAYS_SHORT[date.getDay()]}
                      </p>
                      <p className="text-xl font-black mt-0.5">
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Timetable Grid */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 relative border-t border-[#222634] pt-2">
                
                {/* Hour labels column */}
                <div className="flex flex-col">
                  {hours.map((h) => (
                    <div key={h} className="h-16 flex items-start justify-end pr-2 text-xs font-mono text-slate-500">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* 7 Days columns */}
                {weekDays.map((date, dayIdx) => {
                  const dateStr = formatDate(date);
                  const dayEvents = eventsByDate[dateStr] || [];

                  return (
                    <div 
                      key={dayIdx} 
                      className="flex flex-col relative border-l border-white/5 bg-[#12131A]/30 rounded-xl overflow-hidden min-h-[832px]"
                    >
                      {/* Hour slot background lines */}
                      {hours.map((h) => {
                        const timeStr = `${String(h).padStart(2, '0')}:00`;
                        return (
                          <div
                            key={h}
                            onClick={() => handleOpenCreateShift(dateStr, timeStr)}
                            className="h-16 border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                            title={`Clique para agendar às ${timeStr} em ${dateStr}`}
                          />
                        );
                      })}

                      {/* Placed Event Cards */}
                      <div className="absolute inset-0 p-1 pointer-events-none flex flex-col gap-1.5">
                        {dayEvents.map((ev) => {
                          const emp = employees.find((e) => e.id === ev.employeeId);
                          const startH = parseInt(ev.startTime.split(':')[0]) || 8;
                          const topOffset = Math.max(0, (startH - 8) * 64);
                          const isDraft = ev.status === 'draft';

                          // Color styles
                          const isMeeting = ev.type === 'meeting';
                          const cardBg = ev.color?.bg || (isMeeting ? '#7c3aed' : '#96183c');
                          const cardBorder = ev.color?.border || (isMeeting ? '#a78bfa' : '#f89847');

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditShift(ev);
                              }}
                              className="pointer-events-auto rounded-xl p-2.5 cursor-pointer shadow-md transition-all duration-150 hover:scale-[1.02] hover:shadow-xl text-left relative overflow-hidden"
                              style={{
                                background: isDraft
                                  ? 'rgba(245, 158, 11, 0.14)'
                                  : `${cardBg}50`,
                                border: isDraft
                                  ? '2px dashed #f59e0b'
                                  : `1px solid ${cardBorder}90`,
                                backdropFilter: 'blur(6px)',
                                marginTop: `${topOffset}px`,
                                boxShadow: isDraft ? '0 0 14px rgba(245, 158, 11, 0.18)' : undefined,
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

                              <div className="flex items-center justify-between gap-1 mb-1 relative z-10">
                                <span className="font-bold text-xs text-white truncate">
                                  {ev.title || 'Turno'}
                                </span>
                                {isDraft ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 font-extrabold border border-dashed border-amber-500/60 font-mono tracking-wider">
                                    📝 Rascunho
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 font-mono">
                                    ✓ Publicado
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] font-mono text-[#faf0ac] opacity-90 mb-2 relative z-10">
                                {ev.startTime} - {ev.endTime}
                              </div>

                              {/* Assigned Collaborator Avatar */}
                              <div className="flex items-center gap-1.5 mt-auto relative z-10">
                                {emp && (
                                  <img
                                    src={emp.avatar}
                                    alt={emp.name}
                                    title={emp.name}
                                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white/50"
                                  />
                                )}
                                <span className="text-[10px] text-slate-300 truncate">
                                  {emp?.name.split(' ')[0]}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── MONTH VIEW ─── */}
          {view === 'Mês' && (
            <div className="flex flex-col">
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
                      onClick={() => handleOpenCreateShift(dateStr)}
                      className={`min-h-[100px] rounded-2xl p-2 border transition-all cursor-pointer flex flex-col justify-between ${
                        isTodayCell
                          ? 'bg-[#1E202B] border-[#f89847]'
                          : cell.isCurrent
                          ? 'bg-[#14151C] border-white/5 hover:bg-[#1A1C24]'
                          : 'bg-transparent border-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isTodayCell ? 'text-[#faf0ac]' : 'text-slate-300'
                          }`}
                          style={isTodayCell ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : undefined}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono font-bold">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Shift chips */}
                      <div className="flex flex-col gap-1 mt-1">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const isDraft = ev.status === 'draft';
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditShift(ev);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate transition-all ${
                                isDraft
                                  ? 'border-2 border-dashed border-amber-400 bg-amber-500/25 text-amber-200'
                                  : 'text-white border border-transparent'
                              }`}
                              style={!isDraft ? { background: 'linear-gradient(135deg, rgba(150,24,60,0.7), rgba(248,152,71,0.7))' } : undefined}
                            >
                              {isDraft ? '📝 [Rascunho] ' : '✓ '} {ev.startTime} {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] text-slate-400 pl-1 font-mono">
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
            <div className="max-w-4xl mx-auto flex flex-col bg-[#14151C] rounded-2xl border border-white/5 p-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Agenda diária com alocações e horários de turnos
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenCreateShift(formatDate(currentDate), undefined, 'draft')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-dashed border-amber-500/50 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📝</span>
                    <span>Criar Rascunho</span>
                  </button>
                  <button
                    onClick={() => handleOpenCreateShift(formatDate(currentDate), undefined, 'published')}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #96183c, #f89847)',
                      color: '#faf0ac',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Horário</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {hours.map((h) => {
                  const dateStr = formatDate(currentDate);
                  const timeStr = `${String(h).padStart(2, '0')}:00`;
                  const dayEvents = (eventsByDate[dateStr] || []).filter((ev) => {
                    const sh = parseInt(ev.startTime.split(':')[0]);
                    return sh === h;
                  });

                  return (
                    <div key={h} className="flex gap-4 border-b border-white/5 py-2 group">
                      <div className="w-16 font-mono text-xs text-slate-500 pt-1 text-right">
                        {timeStr}
                      </div>
                      <div 
                        className="flex-1 min-h-[50px] rounded-xl p-2 transition-colors cursor-pointer hover:bg-white/[0.02] flex flex-col gap-2"
                        onClick={() => handleOpenCreateShift(dateStr, timeStr)}
                      >
                        {dayEvents.map((ev) => {
                          const emp = employees.find((e) => e.id === ev.employeeId);
                          const isDraft = ev.status === 'draft';

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditShift(ev);
                              }}
                              className={`p-3 rounded-xl flex items-center justify-between shadow-md transition-all ${
                                isDraft
                                  ? 'border-2 border-dashed border-amber-400 bg-amber-500/15'
                                  : 'border border-orange-500/40'
                              }`}
                              style={!isDraft ? {
                                background: 'linear-gradient(135deg, rgba(150,24,60,0.6), rgba(248,152,71,0.5))',
                              } : undefined}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                                  {isDraft ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 font-extrabold border border-dashed border-amber-500/60 font-mono">
                                      📝 RASCUNHO
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 font-mono">
                                      ✓ PUBLICADO
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#faf0ac] mt-0.5">{ev.startTime} às {ev.endTime}</p>
                              </div>
                              {emp && (
                                <div className="flex items-center gap-2">
                                  <img src={emp.avatar} alt={emp.name} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/50" />
                                  <span className="text-xs font-bold text-white">{emp.name}</span>
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
          )}
        </div>
      </div>

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

    </div>
  );
};
