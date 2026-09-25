import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  CheckCircle2, 
  FileCheck, 
  Sparkles,
  ExternalLink,
  Plus,
  X
} from 'lucide-react';
import { Employee, Shift } from '../types';
import { calculateShiftDurationHours } from '../utils/dateUtils';

interface EmployeeCalendarViewProps {
  employee: Employee;
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onRequestTimeOff?: () => void;
  onSendJustification?: () => void;
  isLightTheme?: boolean;
}

type ViewMode = 'Diário' | 'Semanal' | 'Mensal';

// Funções auxiliares de data
function formatDateToYYYYMMDD(d: Date): string {
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

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export const EmployeeCalendarView: React.FC<EmployeeCalendarViewProps> = ({
  employee,
  shifts,
  onShiftClick,
  onRequestTimeOff,
  onSendJustification,
  isLightTheme = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('Semanal');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 21)); // Default 21 Sep 2026

  const empShifts = useMemo(() => {
    return shifts.filter(s => s.employeeId === employee.id && s.status === 'published');
  }, [shifts, employee.id]);

  const todayStr = formatDateToYYYYMMDD(new Date(2026, 8, 21));

  // Navegação
  const handlePrev = () => {
    if (viewMode === 'Mensal') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'Semanal') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'Mensal') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'Semanal') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 8, 21));
  };

  // Título dinâmico do cabeçalho - exibe sempre apenas o nome do mês
  const titleText = useMemo(() => {
    const month = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  }, [currentDate]);

  // Células do calendário mensal
  const monthCells = useMemo(() => {
    if (viewMode !== 'Mensal') return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const totalDays = lastDayOfMonth.getDate();
    const cells = [];

    for (let i = 0; i < startDay; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateString: dayStr,
        shifts: empShifts.filter(s => s.date === dayStr),
      });
    }

    return cells;
  }, [viewMode, currentDate, empShifts]);

  // Dias da semana atual
  const weekDays = useMemo(() => {
    if (viewMode !== 'Semanal') return [];
    const start = startOfWeekMonday(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const dayStr = formatDateToYYYYMMDD(day);
      return {
        date: day,
        dateString: dayStr,
        dayNumber: day.getDate(),
        dayNameShort: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i],
        shifts: empShifts.filter(s => s.date === dayStr),
      };
    });
  }, [viewMode, currentDate, empShifts]);

  // Turnos do dia na visualização diária
  const dayShifts = useMemo(() => {
    if (viewMode !== 'Diário') return [];
    const dayStr = formatDateToYYYYMMDD(currentDate);
    return empShifts.filter(s => s.date === dayStr);
  }, [viewMode, currentDate, empShifts]);

  // Paleta pastel refinada para os blocos de eventos no estilo da imagem de referência
  const getEventCardStyle = (shift: Shift, idx: number) => {
    if (!isLightTheme) {
      if (shift.type === 'meeting') {
        return 'bg-[#4A1525] border border-[#96183C]/40 text-white shadow-lg hover:bg-[#5C192E]';
      }
      return 'bg-[#2D1B14] border border-[#F89847]/20 text-white shadow-lg hover:bg-[#3D251C]';
    }

    if (shift.type === 'meeting') {
      return 'bg-[#ffe4e6] hover:bg-[#ffd1d7] border border-rose-200/80 text-slate-900 shadow-xs';
    }
    return 'bg-[#faf0ac]/90 hover:bg-[#faf0ac] border border-amber-200/80 text-slate-900 shadow-xs';
  };

  const renderHeader = (inSemanalGradient = false) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
      {/* Title, Hoje and Date Navigator */}
      <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
        <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black capitalize tracking-tight drop-shadow-xs ${
          isLightTheme && (viewMode === 'Diário' && !inSemanalGradient) ? 'text-slate-900' : 'text-white'
        }`}>
          {titleText}
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className={`px-4 py-1.5 rounded-full font-bold text-xs text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
              isLightTheme
                ? viewMode === 'Diário' && !inSemanalGradient
                  ? 'bg-[#96183C] hover:bg-[#801433]'
                  : 'bg-[#5b0d23] hover:bg-[#4a091b]'
                : 'bg-[#96183C] hover:bg-[#801433]'
            }`}
          >
            Hoje
          </button>
          <div className={`flex items-center gap-0.5 p-1 rounded-full border transition-colors ${
            isLightTheme 
              ? viewMode === 'Diário' && !inSemanalGradient
                ? 'bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-white/40 border-white/20 text-[#5b0d23] backdrop-blur-xs' 
              : 'bg-[#1a1d24] border-white/5 text-white/70'
          }`}>
            <button 
              onClick={handlePrev} 
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isLightTheme 
                  ? viewMode === 'Diário' && !inSemanalGradient
                    ? 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    : 'hover:bg-white/30 text-[#5b0d23] hover:text-black' 
                  : 'hover:bg-[#96183c] text-white/70 hover:text-white'
              }`}
              title="Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <button 
              onClick={handleNext} 
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isLightTheme 
                  ? viewMode === 'Diário' && !inSemanalGradient
                    ? 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    : 'hover:bg-white/30 text-[#5b0d23] hover:text-black' 
                  : 'hover:bg-[#96183c] text-white/70 hover:text-white'
              }`}
              title="Próximo"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* View Switcher Pill */}
      <div className="flex items-center justify-end">
        <div className={`flex items-center p-1 rounded-full border transition-colors ${
          isLightTheme 
            ? viewMode === 'Diário' && !inSemanalGradient
              ? 'bg-slate-100 border-slate-200'
              : 'bg-white/25 border-white/30 backdrop-blur-xs' 
            : 'bg-[#1a1d24] border-white/5'
        }`}>
          {(['Mensal', 'Semanal', 'Diário'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                viewMode === mode
                  ? isLightTheme
                    ? 'bg-white text-slate-800 font-bold shadow-sm'
                    : 'bg-white text-[#0f1115] font-bold shadow-sm'
                  : isLightTheme
                    ? viewMode === 'Diário' && !inSemanalGradient
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-800/80 hover:text-slate-900'
                    : 'text-white/70 hover:text-white hover:bg-[#96183c]'
              }`}
            >
              {mode === 'Mensal' ? 'Mês' : mode === 'Semanal' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`rounded-[32px] overflow-hidden min-h-[840px] font-sans transition-all duration-300 relative border ${
        isLightTheme
          ? viewMode === 'Semanal'
            ? 'bg-white text-slate-800 shadow-2xl border-slate-200/90'
            : viewMode === 'Diário'
              ? 'bg-white text-slate-800 shadow-xl border border-slate-200/80 p-5 sm:p-6'
              : 'text-slate-800 shadow-2xl border border-rose-950/20 p-5 sm:p-6'
          : viewMode === 'Semanal'
            ? 'bg-[#0f1115] text-white border-white/5 shadow-2xl'
            : 'bg-[#0f1115] text-white border border-white/5 shadow-2xl p-5 sm:p-6'
      }`}
      style={
        isLightTheme && viewMode === 'Mensal'
          ? {
              background:
                'linear-gradient(90deg, #96183c 0%, #b23a41 20%, #cd5f45 42%, #e27d49 65%, #eda05a 82%, #f3c47a 100%)',
            }
          : {}
      }
    >
      {viewMode === 'Semanal' ? (
        <>
          {/* Top Header & Days Bar with Gradient */}
          <div
            className="p-5 sm:p-6 pb-4 sm:pb-5 transition-all duration-300"
            style={
              isLightTheme
                ? {
                    background:
                      'linear-gradient(90deg, #96183c 0%, #b23a41 20%, #cd5f45 42%, #e27d49 65%, #eda05a 82%, #f3c47a 100%)',
                  }
                : {
                    background: '#15181e',
                  }
            }
          >
            {renderHeader(true)}

            {/* Days of the Week Bar (aligned with shifts below) */}
            <div className="grid grid-cols-[48px_1fr] gap-3">
              {/* Empty Spacer replacing GMT-3 to perfectly align days with the shift columns */}
              <div className="w-12 shrink-0" aria-hidden="true" />

              {/* 7 Floating Day Cards */}
              <div className="grid grid-cols-7 gap-2.5">
                {weekDays.map((d) => {
                  const isSelected = formatDateToYYYYMMDD(currentDate) === d.dateString;
                  return (
                    <div
                      key={d.dateString}
                      onClick={() => {
                        setCurrentDate(d.date);
                      }}
                      className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all cursor-pointer ${
                        isSelected
                          ? isLightTheme
                            ? 'bg-white text-slate-900 shadow-sm border-2 border-[#e65a37]'
                            : 'bg-[#96183c] text-white shadow-lg shadow-[#96183c]/30 border border-white/20'
                          : isLightTheme
                            ? 'bg-[#fce5dc]/95 hover:bg-[#fff0e8] border border-white/40 text-slate-800 shadow-2xs hover:scale-[1.01]'
                            : 'bg-[#1a1d24] text-white/70 border border-white/5 hover:border-[#96183c] hover:bg-[#96183c]/25 hover:text-white'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected
                          ? isLightTheme ? 'text-[#e65a37]' : 'opacity-90'
                          : isLightTheme ? 'text-slate-500' : 'opacity-80'
                      }`}>
                        {d.dayNameShort}
                      </span>
                      <span className={`text-2xl font-black tracking-tight ${
                        isSelected
                          ? isLightTheme ? 'text-black' : 'text-white'
                          : isLightTheme ? 'text-slate-900' : 'text-white'
                      }`}>
                        {d.dayNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Main Time Grid Area (Semanal) - Branco e reto nas laterais */}
          <div
            className={`w-full p-5 sm:p-6 transition-all relative border-t ${
              isLightTheme
                ? 'bg-white border-slate-200/80 text-slate-800'
                : 'bg-[#0f1115] border-white/5 text-white'
            }`}
          >
            <div className="grid grid-cols-[48px_1fr] gap-3">
              
              {/* Timeline Left Column */}
              <div className="space-y-12 pt-2 text-right pr-2">
                {['8 am', '9 am', '10 am', '11 am', '12 am', '14:00', '16:00'].map((t) => (
                  <div key={t} className={`text-[11px] font-mono font-medium h-5 ${
                    isLightTheme ? 'text-slate-400' : 'text-white/30'
                  }`}>
                    {t}
                  </div>
                ))}
              </div>

              {/* 7 Days Grid with Event Cards */}
              <div className="grid grid-cols-7 gap-2.5 relative">
                {/* Subtle Horizontal Divider Lines in Background */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-40">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={`border-b h-[68px] ${
                        isLightTheme ? 'border-slate-100' : 'border-white/5'
                      }`}
                    />
                  ))}
                </div>

                {weekDays.map((d) => (
                  <div key={d.dateString} className="flex flex-col gap-2.5 pt-1 relative z-10 min-h-[460px]">
                    {d.shifts.map((s, idx) => {
                      const isMeeting = s.type === 'meeting';
                      const cardStyle = getEventCardStyle(s, idx);

                      return (
                        <div
                          key={s.id}
                          onClick={() => onShiftClick(s)}
                          className={`relative p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] ${cardStyle}`}
                        >
                          {/* Title */}
                          <div className="font-extrabold text-xs leading-tight mb-1 truncate">
                            {s.title || 'Atendimento Geral'}
                          </div>

                          {/* Time & Meeting Icon */}
                          <div className={`text-[10px] font-mono mb-3 flex items-center justify-between font-semibold ${
                            isLightTheme ? 'text-slate-600' : 'text-white/70'
                          }`}>
                            <span>{s.startTime} - {s.endTime}</span>
                            {isMeeting && <Video className={`w-3.5 h-3.5 ${isLightTheme ? 'text-rose-600' : 'text-[#F89847]'}`} />}
                          </div>

                          {/* Avatars Stack (matching reference image) */}
                          <div className="flex items-center gap-1.5 mt-auto pt-1">
                            <div className="flex -space-x-1.5 overflow-hidden">
                              <img
                                src={employee.avatar}
                                alt={employee.name}
                                className={`inline-block h-5 w-5 rounded-full object-cover ring-2 ${
                                  isLightTheme ? 'ring-white/80' : 'ring-black/40'
                                }`}
                              />
                              {isMeeting && (
                                <img
                                  src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
                                  alt="Beatriz"
                                  className={`inline-block h-5 w-5 rounded-full object-cover ring-2 ${
                                    isLightTheme ? 'ring-white/80' : 'ring-black/40'
                                  }`}
                                />
                              )}
                            </div>
                            <span className={`text-[10px] font-bold ${
                              isLightTheme ? 'text-slate-800' : 'text-white/90'
                            }`}>
                              {employee.name.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </>
      ) : (
        <>
          {renderHeader(false)}
        </>
      )}

      {/* --- VISÃO MENSAL --- */}
      {viewMode === 'Mensal' && (
        <div
          className={`rounded-3xl p-5 border transition-all ${
            isLightTheme
              ? 'bg-[#fffdfa] border-white/60 shadow-md'
              : 'bg-[#111318]/90 border-white/5'
          }`}
        >
          <div className="grid grid-cols-7 gap-2.5">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day, i) => (
              <div
                key={i}
                className={`text-center text-[10px] font-extrabold mb-2 font-mono uppercase tracking-wider ${
                  isLightTheme ? 'text-slate-500' : 'text-white/40'
                }`}
              >
                {day}
              </div>
            ))}
            
            {monthCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div 
                    key={`empty-${idx}`} 
                    className={`min-h-[105px] rounded-2xl ${
                      isLightTheme ? 'bg-slate-50/40 border border-dashed border-slate-200/50' : 'bg-white/[0.02]'
                    }`} 
                  />
                );
              }
              const isToday = cell.dateString === todayStr;
              return (
                <div
                  key={cell.dateString}
                  className={`min-h-[105px] p-2.5 rounded-2xl flex flex-col gap-1.5 transition-all ${
                    isToday
                      ? isLightTheme
                        ? 'bg-gradient-to-br from-rose-50 to-orange-50/90 border border-orange-300 ring-1 ring-orange-200 shadow-sm'
                        : 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/20 border border-[#F89847]/30'
                      : isLightTheme
                        ? 'bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                        : 'bg-[#1a1d24] border border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className={`text-xs font-black px-1 ${
                    isToday 
                      ? isLightTheme ? 'text-orange-600' : 'text-[#F89847]' 
                      : isLightTheme ? 'text-slate-700' : 'text-white/60'
                  }`}>
                    {cell.dayNumber}
                  </div>
                  <div className="space-y-1">
                    {cell.shifts.map((s, sIdx) => {
                      const cardStyle = getEventCardStyle(s, sIdx);
                      return (
                        <div
                          key={s.id}
                          onClick={() => onShiftClick(s)}
                          className={`px-2 py-1.5 rounded-xl border cursor-pointer text-left transition-all ${cardStyle}`}
                        >
                          <div className="text-[9px] font-mono font-bold opacity-90">
                            {s.startTime}
                          </div>
                          <div className="text-[10px] font-bold truncate">
                            {s.title || 'Turno'}
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

      {/* --- VISÃO DIÁRIA --- */}
      {viewMode === 'Diário' && (
        <div
          className={`max-w-3xl mx-auto rounded-3xl p-6 border space-y-6 ${
            isLightTheme
              ? 'bg-[#fffdfa] border-slate-200 shadow-md'
              : 'bg-[#111318]/90 border-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-2xl font-black ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
              {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <span className={`px-3.5 py-1 rounded-full text-xs font-bold border ${
              isLightTheme 
                ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-2xs' 
                : 'bg-[#2D1B14] text-[#F89847] border border-[#F89847]/20'
            }`}>
              {dayShifts.length} turno(s)
            </span>
          </div>

          <div className="space-y-3">
            {dayShifts.length === 0 ? (
              <div className={`text-center py-12 italic font-mono rounded-2xl border ${
                isLightTheme 
                  ? 'text-slate-400 bg-slate-50/50 border-slate-200' 
                  : 'text-white/40 bg-[#1a1d24] border-white/5'
              }`}>
                Nenhum turno agendado para este dia.
              </div>
            ) : (
              dayShifts.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => onShiftClick(s)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isLightTheme
                      ? 'bg-[#faf0ac]/30 hover:bg-[#faf0ac]/60 border-amber-200/60 shadow-sm'
                      : 'bg-[#2D1B14] hover:bg-[#3D251C] border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      isLightTheme 
                        ? 'bg-white border-amber-200 text-orange-600 shadow-2xs' 
                        : 'bg-black/40 border-white/10 text-[#F89847]'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-extrabold mb-0.5 ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                        {s.title || 'Turno'}
                      </h4>
                      <div className={`text-xs font-mono font-bold ${isLightTheme ? 'text-orange-600' : 'text-[#F89847]'}`}>
                        {s.startTime} às {s.endTime}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                       isLightTheme ? 'bg-white border-amber-200' : 'bg-black/40 border-white/5'
                     }`}>
                        <img src={employee.avatar} className="w-5 h-5 rounded-full" alt="Avatar"/>
                        <span className={`text-xs font-bold ${isLightTheme ? 'text-slate-700' : 'text-white/80'}`}>
                          {employee.name.split(' ')[0]}
                        </span>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};


