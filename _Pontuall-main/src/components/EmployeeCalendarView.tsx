import React, { useState } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  CheckCircle2, 
  FileCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Employee, Shift } from '../types';
import { calculateShiftDurationHours } from '../utils/dateUtils';

interface EmployeeCalendarViewProps {
  employee: Employee;
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
  onRequestTimeOff: () => void;
  onSendJustification: () => void;
}

export const EmployeeCalendarView: React.FC<EmployeeCalendarViewProps> = ({
  employee,
  shifts,
  onShiftClick,
  onRequestTimeOff,
  onSendJustification,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const empShifts = shifts.filter(s => s.employeeId === employee.id && s.status === 'published');

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();

  const monthName = currentMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  
  let startDay = firstDayOfMonth.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const calendarCells = [];

  for (let i = 0; i < startDay; i++) {
    calendarCells.push(null);
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      dayNumber: d,
      dateString: dayStr,
      shifts: empShifts.filter(s => s.date === dayStr),
    });
  }

  return (
    <div className="space-y-3">
      {/* Header & Quick Action Buttons */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="font-extrabold text-sm text-slate-900 leading-tight flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#166534]" />
            Calendário Detalhado da Escala
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">
            Visualize seus turnos do mês, atividades, reuniões e solicite alterações
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onRequestTimeOff}
            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#6D28D9] border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
          >
            <span>🏖️</span> Pedir Folga / Troca
          </button>

          <button
            type="button"
            onClick={onSendJustification}
            className="px-2.5 py-1.5 bg-[#BBF7D0]/40 hover:bg-[#BBF7D0]/70 text-[#166534] border border-emerald-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
          >
            <span>📄</span> Justificar Falta
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold text-slate-900 capitalize font-mono">
              {monthName}
            </h3>
            <span className="text-[10px] text-[#166534] bg-emerald-50 px-2 py-0.2 rounded font-bold font-mono border border-emerald-200">
              {empShifts.length} TURNOS PROGRAMADOS
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-white text-slate-700 hover:text-emerald-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentMonthDate(new Date())}
              className="px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-white rounded font-mono"
            >
              Hoje
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-white text-slate-700 hover:text-emerald-700"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 font-mono">
          <div>Seg</div>
          <div>Ter</div>
          <div>Qua</div>
          <div>Qui</div>
          <div>Sex</div>
          <div className="text-emerald-700">Sáb</div>
          <div className="text-emerald-700">Dom</div>
        </div>

        {/* Month Calendar Matrix */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="min-h-[75px] bg-slate-50/50 rounded-lg border border-dashed border-slate-100"></div>;
            }

            const isToday = cell.dateString === new Date().toISOString().split('T')[0];
            const hasShifts = cell.shifts.length > 0;

            return (
              <div
                key={cell.dateString}
                className={`min-h-[75px] p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
                  isToday ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-500/20' :
                  hasShifts ? 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs' : 'bg-slate-50/30 border-slate-200/60'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[11px] font-bold font-mono ${isToday ? 'text-[#166534]' : 'text-slate-700'}`}>
                    {cell.dayNumber}
                  </span>
                  {hasShifts && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  )}
                </div>

                {/* Shift Items inside cell */}
                <div className="space-y-0.5 overflow-y-auto max-h-[60px]">
                  {cell.shifts.map(s => (
                    <div
                      key={s.id}
                      onClick={() => onShiftClick(s)}
                      className={`p-1 rounded border text-left cursor-pointer transition-transform hover:scale-101 ${
                        s.type === 'meeting'
                          ? 'bg-[#BBF7D0]/40 border-emerald-300 text-[#166534]'
                          : 'bg-purple-50 border-purple-200 text-purple-950'
                      }`}
                    >
                      <div className="text-[9px] font-mono font-bold flex items-center justify-between">
                        <span>{s.startTime}</span>
                        {s.type === 'meeting' && <Video className="w-2.5 h-2.5 text-[#166534]" />}
                      </div>
                      <div className="text-[9px] font-medium truncate leading-tight">
                        {s.title || 'Turno'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {!hasShifts && (
                  <div className="text-[9px] text-slate-400 italic text-center py-1 font-mono">
                    Folga
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
