import React, { useState, useMemo, useEffect } from 'react';
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
  X,
  MapPin,
  Coffee,
  Calendar as CalendarIcon,
  AlertCircle,
  Lock,
  Trash2
} from 'lucide-react';
import { Employee, Shift } from '@/types';
import { calculateShiftDurationHours } from '@/shared/utils/dateUtils';
import { getMutedShiftColor } from './OrbitCalendarView';
import {
  PjPrivateScheduleBlock,
  getPjPrivateScheduleLocal,
  syncPjPrivateScheduleFromSupabase,
  addPjPrivateScheduleBlock,
  deletePjPrivateScheduleBlock
} from '@/modules/attendance/services/pjNotesService';

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

function getShiftDuration(startTime: string, endTime: string, breakMinutes?: number): number {
  try {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) {
      endMin += 24 * 60; // turnos noturnos
    }
    const diffMin = endMin - startMin - (breakMinutes || 0);
    return Math.max(0, Math.round((diffMin / 60) * 10) / 10);
  } catch {
    return 8;
  }
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
  const [currentDate, setCurrentDate] = useState(new Date());

  const isPj = employee.contractType === 'PJ';

  // Escala Pessoal Privada exclusiva para Colaboradores PJ (Gestor não tem acesso)
  const [privateBlocks, setPrivateBlocks] = useState<PjPrivateScheduleBlock[]>(() =>
    isPj ? getPjPrivateScheduleLocal(employee.id) : []
  );
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);
  const [selectedPrivateBlock, setSelectedPrivateBlock] = useState<PjPrivateScheduleBlock | null>(null);
  const [formDate, setFormDate] = useState(() => formatDateToYYYYMMDD(new Date()));
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('18:00');
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!isPj) return;
    setPrivateBlocks(getPjPrivateScheduleLocal(employee.id));
    syncPjPrivateScheduleFromSupabase(employee.id).then(synced => {
      setPrivateBlocks(synced);
    });
  }, [employee.id, isPj]);

  const handleOpenNewPrivateModal = (dateStr?: string) => {
    setSelectedPrivateBlock(null);
    setFormDate(dateStr || formatDateToYYYYMMDD(currentDate));
    setFormStart('09:00');
    setFormEnd('18:00');
    setFormTitle('');
    setFormNotes('');
    setIsPrivateModalOpen(true);
  };

  const handleSavePrivateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formStart || !formEnd) return;
    const updated = await addPjPrivateScheduleBlock(employee.id, {
      date: formDate,
      startTime: formStart,
      endTime: formEnd,
      title: formTitle.trim() || 'Minha Escala Pessoal',
      notes: formNotes.trim() || undefined,
    });
    setPrivateBlocks(updated);
    setIsPrivateModalOpen(false);
  };

  const handleDeletePrivateBlock = async (blockId: string) => {
    const updated = await deletePjPrivateScheduleBlock(employee.id, blockId);
    setPrivateBlocks(updated);
    setSelectedPrivateBlock(null);
    setIsPrivateModalOpen(false);
  };

  // Combina reuniões/turnos publicados com os blocos privados do PJ
  const empShifts = useMemo(() => {
    const official = shifts.filter(s => s.employeeId === employee.id && s.status === 'published');
    if (!isPj) return official;

    const privateAsShifts: Shift[] = privateBlocks.map(b => ({
      id: b.id,
      employeeId: employee.id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      status: 'published',
      attendanceStatus: 'pending',
      type: 'regular',
      title: `🔒 ${b.title}`,
      notes: b.notes || 'Escala pessoal privada (visível apenas para você)',
      workplace: 'Escala Pessoal Privada (PJ)',
      breakMinutes: 0,
    }));

    return [...official, ...privateAsShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [shifts, employee.id, isPj, privateBlocks]);

  const handleCalendarShiftClick = (s: Shift) => {
    if (isPj) {
      const priv = privateBlocks.find(b => b.id === s.id);
      if (priv) {
        setSelectedPrivateBlock(priv);
        setIsPrivateModalOpen(true);
        return;
      }
    }
    onShiftClick(s);
  };

  const todayStr = formatDateToYYYYMMDD(new Date());
  const selectedDateStr = formatDateToYYYYMMDD(currentDate);

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
    setCurrentDate(new Date());
  };

  // Título dinâmico do cabeçalho
  const titleText = useMemo(() => {
    const month = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  }, [currentDate]);

  const yearText = useMemo(() => {
    return currentDate.getFullYear();
  }, [currentDate]);

  // Células do calendário mensal
  const monthCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDay = firstDayOfMonth.getDay(); // 0 = Domingo
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
  }, [currentDate, empShifts]);

  // Dias da semana atual
  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const dayStr = formatDateToYYYYMMDD(day);
      return {
        date: day,
        dateString: dayStr,
        dayNumber: day.getDate(),
        dayNameShort: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i],
        dayNameFull: ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'][i],
        shifts: empShifts.filter(s => s.date === dayStr),
      };
    });
  }, [currentDate, empShifts]);

  // Turnos da data atualmente selecionada
  const selectedDayShifts = useMemo(() => {
    return empShifts.filter(s => s.date === selectedDateStr);
  }, [selectedDateStr, empShifts]);

  // Formatação amigável do dia selecionado
  const selectedDayLabel = useMemo(() => {
    const d = currentDate;
    const weekDay = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'long' });
    return `${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)}, ${day} de ${month}`;
  }, [currentDate]);

  // Horário atual no formato HH:MM
  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isSelectedToday = todayStr === selectedDateStr;

  // Render do Header do Desktop
  const renderDesktopHeader = (inSemanalGradient = false) => (
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

      {/* View Switcher Pill + Botão Escala Pessoal PJ */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {isPj && (
          <button
            type="button"
            onClick={() => handleOpenNewPrivateModal(selectedDateStr)}
            className="px-4 py-2 rounded-full text-xs font-extrabold text-white shadow-lg flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: 'linear-gradient(135deg, #640C1E, #9F243C, #F59242)' }}
            title="Adicionar horário na sua escala pessoal privada (o gestor não tem acesso)"
          >
            <Lock className="w-3.5 h-3.5" />
            <Plus className="w-3.5 h-3.5" />
            <span>Minha Escala Pessoal</span>
          </button>
        )}

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
    <div className="w-full">
      {/* Banner Informativo de Privacidade para PJ */}
      {isPj && (
        <div
          className={`mb-4 px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isLightTheme
              ? 'bg-orange-50/90 border-orange-200 text-slate-800'
              : 'bg-[#151822] border-[#F59242]/30 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#96183c]/20 text-[#f89847] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <strong className="font-extrabold block">
                Escala Pessoal Privada PJ (Sem acesso do Gestor)
              </strong>
              <span className="opacity-80">
                Organize seus próprios horários e blocos de trabalho neste calendário. Tudo o que você adicionar aqui é 100% privado e invisível para a gestão.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenNewPrivateModal(selectedDateStr)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Horário Pessoal</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          1. EXPERIÊNCIA MOBILE DEDICADA (< 768px)
          ========================================================================= */}
      <div className="block md:hidden w-full font-sans pb-10">
        
        {/* Cabeçalho & Barra da Semana Mobile com Degradê no Modo Claro */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border mb-3.5 transition-all shadow-lg ${
            isLightTheme
              ? 'border-rose-950/20 text-white'
              : 'bg-[#13161f] border-white/10 text-white'
          }`}
          style={
            isLightTheme
              ? {
                  background:
                    'linear-gradient(90deg, #8A1538 0%, #a82b3d 22%, #c95240 45%, #de7647 68%, #e89858 85%, #f1bd74 100%)',
                }
              : undefined
          }
        >
          {/* Topo: Mês & Ano + Ações */}
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black capitalize tracking-tight text-white drop-shadow-xs">
                  {titleText}
                </span>
                <span className="text-sm sm:text-base font-bold opacity-75 font-mono text-white">
                  {yearText}
                </span>
              </div>
              <p className="text-[11px] font-medium mt-0.5 text-white/80">
                {selectedDayShifts.length === 0
                  ? 'Nenhum turno no dia selecionado'
                  : `${selectedDayShifts.length} turno(s) agendado(s)`}
              </p>
            </div>

            {/* Controles de Navegação Compactos */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToday}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                  isLightTheme
                    ? 'bg-[#5b0d23] hover:bg-[#4a091b] text-white shadow-sm'
                    : isSelectedToday
                      ? 'bg-[#96183c] text-white shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Hoje
              </button>

              <div className={`flex items-center p-0.5 rounded-full border ${
                isLightTheme ? 'bg-white/30 border-white/25 text-white backdrop-blur-xs' : 'bg-black/30 border-white/10 text-white/80'
              }`}>
                <button
                  onClick={handlePrev}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${
                    isLightTheme ? 'text-white hover:bg-white/25' : 'text-white/80 hover:bg-white/10'
                  }`}
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button
                  onClick={handleNext}
                  className={`p-1 rounded-full transition-colors cursor-pointer ${
                    isLightTheme ? 'text-white hover:bg-white/25' : 'text-white/80 hover:bg-white/10'
                  }`}
                  aria-label="Próximo"
                >
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* ── MODO SEMANAL MOBILE: BARRA DE DIAS HORIZONTAL ── */}
          {(viewMode === 'Semanal' || viewMode === 'Diário') && (
            <div>
              <div className="flex items-center mb-2 px-1">
                <span className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  isLightTheme ? 'text-white/80' : 'text-zinc-400'
                }`}>
                  Dias da Semana
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {weekDays.map((d) => {
                  const isSelected = selectedDateStr === d.dateString;
                  const isDayToday = todayStr === d.dateString;
                  const hasShifts = d.shifts.length > 0;

                  return (
                    <button
                      key={d.dateString}
                      onClick={() => setCurrentDate(d.date)}
                      type="button"
                      className={`relative flex flex-col items-center justify-between py-2 sm:py-2.5 px-0.5 sm:px-1 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
                        isSelected
                          ? isLightTheme
                            ? 'bg-white text-slate-900 shadow-md ring-2 ring-white/90 border-2 border-[#e65a37]'
                            : 'bg-gradient-to-b from-[#96183c] via-[#801433] to-[#640c1e] text-white shadow-lg shadow-[#96183c]/40 ring-2 ring-[#f89847]/40'
                          : isLightTheme
                            ? 'bg-[#fce5dc]/90 hover:bg-[#fff0e8] text-slate-800 border border-white/50 shadow-2xs'
                            : 'bg-[#1a1d26] hover:bg-[#232734] text-zinc-300 border border-white/5'
                      }`}
                      style={{ minHeight: '66px' }}
                    >
                      <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-tight ${
                        isSelected
                          ? isLightTheme ? 'text-[#e65a37]' : 'text-white/90'
                          : isLightTheme ? 'text-slate-600' : 'text-zinc-400'
                      }`}>
                        {d.dayNameShort}
                      </span>

                      <span className={`text-base sm:text-lg font-black tracking-tight leading-none my-0.5 ${
                        isSelected
                          ? isLightTheme ? 'text-black' : 'text-white'
                          : isLightTheme ? 'text-slate-900' : 'text-zinc-100'
                      }`}>
                        {d.dayNumber}
                      </span>

                      <div className="h-3 flex items-center justify-center">
                        {isDayToday ? (
                          <span className={`px-1 py-0.2 rounded-full text-[7px] font-black tracking-tighter uppercase leading-none ${
                            isSelected
                              ? isLightTheme ? 'bg-[#e65a37] text-white' : 'bg-white text-[#96183c]'
                              : isLightTheme ? 'bg-[#e65a37]/20 text-[#c93f1d] font-black' : 'bg-[#f89847] text-black font-extrabold'
                          }`}>
                            Hoje
                          </span>
                        ) : hasShifts ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected
                                ? isLightTheme ? 'bg-[#e65a37]' : 'bg-amber-300'
                                : isLightTheme ? 'bg-[#de7647]' : 'bg-[#f89847]'
                            }`}
                            title={`${d.shifts.length} turno(s)`}
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full opacity-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Switcher de Visualização Mobile */}
        <div className={`flex items-center p-1 rounded-2xl border mb-3.5 ${
          isLightTheme ? 'bg-slate-100 border-slate-200' : 'bg-[#181a24] border-white/10'
        }`}>
          <button
            onClick={() => setViewMode('Semanal')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              viewMode === 'Semanal' || viewMode === 'Diário'
                ? isLightTheme
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-[#96183c] text-white shadow-md shadow-[#96183c]/30'
                : isLightTheme
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-zinc-400 hover:text-white'
            }`}
          >
            Semana & Agenda
          </button>
          <button
            onClick={() => setViewMode('Mensal')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              viewMode === 'Mensal'
                ? isLightTheme
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-[#96183c] text-white shadow-md shadow-[#96183c]/30'
                : isLightTheme
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mês Completo
          </button>
        </div>

        {/* ── MODO MENSAL MOBILE ── */}
        {viewMode === 'Mensal' && (
          <div className={`p-4 rounded-3xl border mb-3.5 ${
            isLightTheme ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#13161f] border-white/10 shadow-lg'
          }`}>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d) => (
                <span
                  key={d}
                  className={`text-[9px] font-mono font-extrabold uppercase ${
                    isLightTheme ? 'text-slate-400' : 'text-zinc-500'
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`mb-empty-${idx}`} className="h-9 rounded-xl opacity-0" />;
                }

                const isSelected = selectedDateStr === cell.dateString;
                const isDayToday = todayStr === cell.dateString;
                const hasShifts = cell.shifts.length > 0;

                return (
                  <button
                    key={cell.dateString}
                    onClick={() => {
                      const [y, m, d] = cell.dateString.split('-').map(Number);
                      setCurrentDate(new Date(y, m - 1, d));
                    }}
                    type="button"
                    className={`h-9 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      isSelected
                        ? isLightTheme
                          ? 'bg-[#96183c] text-white font-black shadow-xs'
                          : 'bg-[#96183c] text-white font-black shadow-md'
                        : isDayToday
                          ? isLightTheme
                            ? 'bg-rose-50 text-[#96183c] border border-[#96183c]/30 font-bold'
                            : 'bg-white/10 text-[#f89847] border border-[#f89847]/40 font-bold'
                          : isLightTheme
                            ? 'text-slate-800 hover:bg-slate-100 font-semibold'
                            : 'text-zinc-200 hover:bg-white/5 font-semibold'
                    }`}
                  >
                    <span className="text-xs leading-none">{cell.dayNumber}</span>
                    {hasShifts && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${
                        isSelected ? 'bg-white' : 'bg-[#f89847]'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SEÇÃO DA AGENDA & LINHA DO TEMPO MOBILE ── */}
        <div className={`p-4 sm:p-5 rounded-3xl border ${
          isLightTheme ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#13161f] border-white/10 shadow-lg'
        }`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
            <div>
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider block ${
                isLightTheme ? 'text-slate-400' : 'text-zinc-400'
              }`}>
                {isSelectedToday ? 'Escala de Hoje' : 'Escala Selecionada'}
              </span>
              <h3 className={`text-sm sm:text-base font-black ${
                isLightTheme ? 'text-slate-900' : 'text-white'
              }`}>
                {selectedDayLabel}
              </h3>
            </div>
          </div>

          {selectedDayShifts.length === 0 ? (
            <div className={`py-10 px-4 rounded-2xl border text-center flex flex-col items-center justify-center ${
              isLightTheme
                ? 'bg-slate-50 border-slate-200/80 text-slate-600'
                : 'bg-[#181a24] border-white/5 text-zinc-400'
            }`}>
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#f89847] mb-3 shadow-inner">
                <Coffee className="w-6 h-6" />
              </div>
              <h4 className={`text-sm font-extrabold mb-1 ${
                isLightTheme ? 'text-slate-800' : 'text-zinc-100'
              }`}>
                Nenhum turno agendado
              </h4>
              <p className="text-xs max-w-xs leading-relaxed opacity-80">
                {isPj
                  ? 'Clique em "Adicionar Horário Pessoal" para planejar sua escala neste dia.'
                  : 'Você não possui escalas ou plantões cadastrados para este dia. Aproveite sua folga!'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-7 space-y-4">
              <div
                className="absolute left-2.5 top-2 bottom-4 w-0.5 rounded-full pointer-events-none"
                style={{
                  background: isLightTheme
                    ? 'linear-gradient(to bottom, #96183c, #cbd5e1)'
                    : 'linear-gradient(to bottom, #f89847, #334155)',
                }}
              />

              {isSelectedToday && (
                <div className="relative flex items-center gap-2 -ml-6 mb-2">
                  <div className="w-5 h-5 rounded-full bg-[#f89847] text-black flex items-center justify-center text-[8px] font-black shadow-md ring-2 ring-black">
                    ●
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-[#f89847] text-black">
                    Agora: {currentTimeStr}
                  </span>
                  <div className="flex-1 border-b border-[#f89847]/40 border-dashed" />
                </div>
              )}

              {selectedDayShifts.map((s) => {
                const isOnCall = s.type === 'on_call';
                const mutedStyle = getMutedShiftColor(s, !isLightTheme);

                return (
                  <div key={s.id} className="relative group">
                    <div
                      className="absolute -left-6 sm:-left-7 top-4 w-3.5 h-3.5 rounded-full border-2 border-[#13161f] shadow-sm"
                      style={{
                        backgroundColor: mutedStyle.accent || '#f89847',
                      }}
                    />

                    <div
                      onClick={() => handleCalendarShiftClick(s)}
                      className="p-4 rounded-2xl border transition-all cursor-pointer shadow-md active:scale-[0.98] select-none"
                      style={{
                        background: mutedStyle.bg,
                        borderColor: mutedStyle.border,
                        borderLeftWidth: '4px',
                        borderLeftColor: mutedStyle.accent,
                        color: mutedStyle.text,
                      }}
                    >
                      <h4
                        className="text-base font-black leading-snug mb-1"
                        style={{ color: mutedStyle.text }}
                      >
                        {s.title || (isOnCall ? 'Plantão 12x36' : 'Atendimento Geral')}
                      </h4>

                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="text-sm font-mono font-black flex items-center gap-1.5"
                          style={{ color: mutedStyle.accent }}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{s.startTime} às {s.endTime}</span>
                        </div>

                        {s.breakMinutes && s.breakMinutes > 0 ? (
                          <span className="text-[11px] opacity-75 font-medium">
                            • Intervalo: {s.breakMinutes} min
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-black/10 text-xs">
                        <div className="flex items-center gap-1.5 opacity-90 truncate max-w-[220px]">
                          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate text-[11px]">
                            {s.workplace || 'Sede Employer - Matriz'}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold underline opacity-80 hover:opacity-100 shrink-0">
                          Ver detalhes →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. EXPERIÊNCIA DESKTOP COMPLETA (≥ 768px)
          ========================================================================= */}
      <div
        className={`hidden md:block rounded-[32px] overflow-hidden min-h-[840px] font-sans transition-all duration-300 relative border ${
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
              {renderDesktopHeader(true)}

              <div className="grid grid-cols-[48px_1fr] gap-3">
                <div className="w-12 shrink-0" aria-hidden="true" />

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

            {/* Main Time Grid Area (Semanal Desktop) */}
            <div
              className={`w-full p-5 sm:p-6 transition-all relative border-t ${
                isLightTheme
                  ? 'bg-white border-slate-200/80 text-slate-800'
                  : 'bg-[#0f1115] border-white/5 text-white'
              }`}
            >
              <div className="grid grid-cols-[48px_1fr] gap-3">
                <div className="space-y-12 pt-2 text-right pr-2">
                  {['8 am', '9 am', '10 am', '11 am', '12 am', '14:00', '16:00'].map((t) => (
                    <div key={t} className={`text-[11px] font-mono font-medium h-5 ${
                      isLightTheme ? 'text-slate-400' : 'text-white/30'
                    }`}>
                      {t}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2.5 relative">
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
                      {d.shifts.map((s) => {
                        const isMeeting = s.type === 'meeting';
                        const mutedStyle = getMutedShiftColor(s, !isLightTheme);

                        return (
                          <div
                            key={s.id}
                            onClick={() => handleCalendarShiftClick(s)}
                            className="relative p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] shadow-md border overflow-hidden"
                            style={{
                              background: mutedStyle.bg,
                              borderColor: mutedStyle.border,
                              borderLeftColor: mutedStyle.accent,
                              borderLeftWidth: '3.5px',
                              color: mutedStyle.text,
                            }}
                          >
                            <div className="font-extrabold text-xs leading-tight mb-1 truncate" style={{ color: mutedStyle.text }}>
                              {s.title || 'Atendimento Geral'}
                            </div>

                            <div className="text-[10px] font-mono mb-3 flex items-center justify-between font-semibold opacity-90" style={{ color: mutedStyle.text }}>
                              <span>{s.startTime} - {s.endTime}</span>
                              {isMeeting && <Video className="w-3.5 h-3.5" style={{ color: mutedStyle.accent }} />}
                            </div>

                            <div className="flex items-center gap-1.5 mt-auto pt-1">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                <img
                                  src={employee.avatar}
                                  alt={employee.name}
                                  className="inline-block h-5 w-5 rounded-full object-cover ring-2 ring-black/20"
                                />
                              </div>
                              <span className="text-[10px] font-bold opacity-90" style={{ color: mutedStyle.text }}>
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
          renderDesktopHeader(false)
        )}

        {/* --- VISÃO MENSAL DESKTOP --- */}
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
                    <div className={`text-xs font-black px-1 flex items-center justify-between ${
                      isToday 
                        ? isLightTheme ? 'text-orange-600' : 'text-[#F89847]' 
                        : isLightTheme ? 'text-slate-700' : 'text-white/60'
                    }`}>
                      <span>{cell.dayNumber}</span>
                      {isPj && (
                        <button
                          type="button"
                          onClick={() => handleOpenNewPrivateModal(cell.dateString)}
                          className="w-5 h-5 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-[#96183c]/20 text-[#f89847] transition-all cursor-pointer"
                          title="Adicionar horário pessoal neste dia"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {cell.shifts.map((s) => {
                        const mutedStyle = getMutedShiftColor(s, !isLightTheme);
                        return (
                          <div
                            key={s.id}
                            onClick={() => handleCalendarShiftClick(s)}
                            className="px-2 py-1.5 rounded-xl border cursor-pointer text-left transition-all hover:scale-[1.02]"
                            style={{
                              background: mutedStyle.bg,
                              borderColor: mutedStyle.border,
                              borderLeftColor: mutedStyle.accent,
                              borderLeftWidth: '3px',
                              color: mutedStyle.text,
                            }}
                          >
                            <div className="text-[9px] font-mono font-bold opacity-90" style={{ color: mutedStyle.text }}>
                              {s.startTime}
                            </div>
                            <div className="text-[10px] font-bold truncate" style={{ color: mutedStyle.text }}>
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

        {/* --- VISÃO DIÁRIA DESKTOP --- */}
        {viewMode === 'Diário' && (
          <div
            className={`max-w-3xl mx-auto rounded-3xl p-6 border space-y-6 ${
              isLightTheme
                ? 'bg-white border-slate-200 shadow-md'
                : 'bg-[#111318]/90 border-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl font-black ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                {selectedDayLabel}
              </h3>
              <span className={`px-3.5 py-1 rounded-full text-xs font-bold border ${
                isLightTheme 
                  ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-2xs' 
                  : 'bg-[#2D1B14] text-[#F89847] border border-[#F89847]/20'
              }`}>
                {selectedDayShifts.length} turno(s)
              </span>
            </div>

            <div className="space-y-3">
              {selectedDayShifts.length === 0 ? (
                <div className={`text-center py-12 italic font-mono rounded-2xl border ${
                  isLightTheme 
                    ? 'text-slate-400 bg-slate-50/50 border-slate-200' 
                    : 'text-white/40 bg-[#1a1d24] border-white/5'
                }`}>
                  Nenhum turno agendado para este dia.
                </div>
              ) : (
                selectedDayShifts.map((s) => {
                  const mutedStyle = getMutedShiftColor(s, !isLightTheme);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleCalendarShiftClick(s)}
                      className="p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between hover:scale-[1.01]"
                      style={{
                        background: mutedStyle.bg,
                        borderColor: mutedStyle.border,
                        borderLeftColor: mutedStyle.accent,
                        borderLeftWidth: '4px',
                        color: mutedStyle.text,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0"
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderColor: mutedStyle.border,
                            color: mutedStyle.accent,
                          }}
                        >
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold mb-0.5" style={{ color: mutedStyle.text }}>
                            {s.title || 'Turno'}
                          </h4>
                          <div className="text-xs font-mono font-bold opacity-90" style={{ color: mutedStyle.text }}>
                            {s.startTime} às {s.endTime}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                         <div 
                           className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                           style={{
                             background: 'rgba(0,0,0,0.2)',
                             borderColor: mutedStyle.border,
                             color: mutedStyle.text,
                           }}
                         >
                            <img src={employee.avatar} className="w-5 h-5 rounded-full object-cover" alt="Avatar"/>
                            <span className="text-xs font-bold" style={{ color: mutedStyle.text }}>
                              {employee.name.split(' ')[0]}
                            </span>
                         </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE ESCALA PESSOAL PRIVADA DO COLABORADOR PJ */}
      {isPj && isPrivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 ${
              isLightTheme ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#10121A] border-[#252A3A] text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {selectedPrivateBlock ? 'Detalhes da Minha Escala Pessoal' : 'Adicionar à Minha Escala Pessoal'}
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-bold block">
                    🔒 Visível somente para você (sem acesso do gestor)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedPrivateBlock ? (
              <div className="space-y-4 text-xs">
                <div
                  className={`p-4 rounded-2xl border space-y-2 ${
                    isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#151822] border-white/10'
                  }`}
                >
                  <div className="font-black text-sm">{selectedPrivateBlock.title}</div>
                  <div className="font-mono font-bold text-[#f89847]">
                    📅 {selectedPrivateBlock.date.split('-').reverse().join('/')} • ⏰ {selectedPrivateBlock.startTime} às {selectedPrivateBlock.endTime}
                  </div>
                  {selectedPrivateBlock.notes && (
                    <p className="opacity-80 pt-1">{selectedPrivateBlock.notes}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeletePrivateBlock(selectedPrivateBlock.id)}
                    className="px-4 py-2.5 rounded-xl font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir Horário</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivateModalOpen(false)}
                    className={`px-5 py-2.5 rounded-xl font-bold cursor-pointer ${
                      isLightTheme ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePrivateBlock} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <label className="opacity-80 block">Título / Atividade da Escala*</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Desenvolvimento Front-end, Plantão Pessoal..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border outline-none ${
                      isLightTheme ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0b0c10] border-[#252A3A] text-white'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="opacity-80 block">Data*</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-xl border outline-none ${
                        isLightTheme ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0b0c10] border-[#252A3A] text-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="opacity-80 block">Início*</label>
                    <input
                      type="time"
                      required
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-xl border outline-none ${
                        isLightTheme ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0b0c10] border-[#252A3A] text-white'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="opacity-80 block">Término*</label>
                    <input
                      type="time"
                      required
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-xl border outline-none ${
                        isLightTheme ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0b0c10] border-[#252A3A] text-white'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="opacity-80 block">Observações Pessoais (Opcional)</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Anotações sobre este bloco de horário..."
                    className={`w-full px-3.5 py-2 rounded-xl border outline-none ${
                      isLightTheme ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0b0c10] border-[#252A3A] text-white'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsPrivateModalOpen(false)}
                    className={`px-4 py-2 rounded-xl cursor-pointer ${
                      isLightTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-white font-bold shadow-md cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                  >
                    Salvar na Minha Escala
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
