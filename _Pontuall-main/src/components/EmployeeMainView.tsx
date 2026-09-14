import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays, 
  Video, 
  TrendingUp, 
  Sparkles, 
  FileCheck, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building
} from 'lucide-react';
import { Employee, Shift, ManagerReminder } from '../types';
import { getWeekDates, calculateShiftDurationHours, getTodayDateString } from '../utils/dateUtils';
import confetti from 'canvas-confetti';

interface EmployeeMainViewProps {
  employee: Employee;
  shifts: Shift[];
  reminders: ManagerReminder[];
  onCheckIn: (shiftId: string, locationData: { address: string; gpsValidated: boolean }) => void;
  onNavigateToCalendar: () => void;
  onNavigateToRequests: () => void;
  onNavigateToJustifications: () => void;
  onShiftClick: (shift: Shift) => void;
}

export const EmployeeMainView: React.FC<EmployeeMainViewProps> = ({
  employee,
  shifts,
  reminders,
  onCheckIn,
  onNavigateToCalendar,
  onNavigateToRequests,
  onNavigateToJustifications,
  onShiftClick,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayDateString();
  const weekDays = getWeekDates(new Date());
  const currentWeekDateStrings = weekDays.map(d => d.dateString);

  const empShifts = shifts.filter(s => s.employeeId === employee.id && s.status === 'published');
  const todayShift = empShifts.find(s => s.date === todayStr);

  const weeklyShifts = empShifts.filter(s => currentWeekDateStrings.includes(s.date));
  const presentShifts = weeklyShifts.filter(s => s.attendanceStatus === 'present');
  const absentShifts = weeklyShifts.filter(s => s.attendanceStatus === 'absent');
  const justifiedShifts = weeklyShifts.filter(s => s.attendanceStatus === 'justified');

  const hoursWorked = presentShifts.reduce((acc, s) => {
    return acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
  }, 0);

  const goalHours = employee.standardHoursPerWeek;
  const progressPercent = Math.min(100, Math.round((hoursWorked / goalHours) * 100));
  const hasMetGoal = hoursWorked >= goalHours;

  const handlePunchClock = () => {
    if (!todayShift) return;
    setIsSimulatingGps(true);

    setTimeout(() => {
      setIsSimulatingGps(false);
      setCheckInSuccess(true);
      onCheckIn(todayShift.id, {
        address: 'Sede Employer - Av. Paulista, 1000 - SP (GPS Validado)',
        gpsValidated: true,
      });

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {
        // ignore
      }

      setTimeout(() => setCheckInSuccess(false), 4000);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Top Welcome & Punch Clock Hero Card */}
      <div className="bg-[#1E1B4B] text-white rounded-2xl p-5 sm:p-6 shadow-xs border border-indigo-900/60 relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Left: Clock and Status */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-[#BBF7D0] text-[11px] font-bold tracking-wider uppercase font-mono">
              <span className="w-2 h-2 rounded-full bg-[#BBF7D0] animate-pulse"></span>
              <span>Ponto Digital GPS Ativo</span>
            </div>

            <div className="space-y-0.5">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-indigo-200 text-xs font-medium capitalize">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Today's Shift Card */}
            <div className="bg-[#0F0D2E]/80 rounded-xl p-3 border border-indigo-800/80 max-w-lg">
              {todayShift ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-[10px] text-indigo-300 uppercase font-mono font-bold tracking-wider">
                      Turno de Hoje
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#BBF7D0]" />
                      {todayShift.startTime} - {todayShift.endTime}
                      <span className="text-[10px] font-normal text-indigo-300">
                        ({calculateShiftDurationHours(todayShift.startTime, todayShift.endTime, todayShift.breakMinutes)}h)
                      </span>
                    </div>
                    <div className="text-xs text-indigo-200 mt-0.5 font-medium">
                      {todayShift.title || 'Turno Regular de Trabalho'}
                    </div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      todayShift.attendanceStatus === 'present'
                        ? 'bg-[#BBF7D0] text-[#166534]'
                        : 'bg-amber-100 text-amber-900'
                    }`}>
                      {todayShift.attendanceStatus === 'present' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#166534]" />
                          Presença Registrada ({todayShift.checkInTime || '08:00'})
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-700" />
                          Aguardando Ponto
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-indigo-200 flex items-center gap-2 py-0.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#BBF7D0]" />
                  <span>Você não possui turno escalado para hoje. Folga programada!</span>
                </div>
              )}
            </div>

            {/* GPS Proximity Badge */}
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-[#BBF7D0]" />
              <span>Validação GPS: Posto Sede SP (Dentro do raio de 100m)</span>
            </div>
          </div>

          {/* Right: Big Punch Button */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-3.5 bg-[#0F0D2E]/50 rounded-xl border border-indigo-800/80">
            {todayShift ? (
              todayShift.attendanceStatus === 'present' ? (
                <div className="text-center space-y-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-[#166534] border border-[#BBF7D0] flex items-center justify-center mx-auto text-[#BBF7D0]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Presença Registrada!</h3>
                    <p className="text-[11px] text-indigo-200 mt-0.5">
                      Check-in às {todayShift.checkInTime || '07:58'} via GPS.
                    </p>
                  </div>
                  <div className="text-[10px] text-[#BBF7D0] bg-[#166534]/50 px-2 py-0.5 rounded border border-emerald-500/30 inline-block font-mono">
                    Local: Sede Employer - SP
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2.5 w-full">
                  <button
                    type="button"
                    onClick={handlePunchClock}
                    disabled={isSimulatingGps}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#BBF7D0] hover:bg-emerald-200 text-[#166534] font-extrabold text-sm shadow-xs active:scale-98 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border border-emerald-300"
                  >
                    <span className="text-base">{isSimulatingGps ? '📡' : '⏱️'}</span>
                    <span className="font-extrabold">{isSimulatingGps ? 'Validando GPS...' : 'REGISTRAR PONTO AGORA'}</span>
                    <span className="text-[9px] font-bold text-emerald-800 tracking-wider uppercase font-mono">
                      Confirmar Entrada no Turno
                    </span>
                  </button>

                  <p className="text-[10px] text-indigo-300 font-mono">
                    Localização capturada e criptografada via GPS
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-4 text-indigo-300 text-xs font-mono">
                Sem turnos para bater ponto hoje.
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Frequency & Hours Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Hours Progress */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              <span>Carga Horária Semanal</span>
              <span className="text-[#166534] font-mono font-bold">{progressPercent}%</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900 font-mono">{hoursWorked}h</span>
              <span className="text-[11px] text-slate-500 font-mono">de {goalHours}h</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hasMetGoal ? 'bg-[#166534]' : 'bg-[#6D28D9]'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600 flex items-center justify-between">
            <span>Meta semanal:</span>
            <span className={`font-bold px-1.5 py-0.2 rounded font-mono ${
              hasMetGoal ? 'bg-[#BBF7D0] text-[#166534]' : 'bg-purple-100 text-[#6D28D9]'
            }`}>
              {hasMetGoal ? 'Meta Atingida ✓' : `Faltam ${Math.max(0, goalHours - hoursWorked)}h`}
            </span>
          </div>
        </div>

        {/* Presenças e Faltas */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Frequência da Semana
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-2 bg-[#BBF7D0]/30 rounded-lg border border-emerald-200">
                <div className="text-lg font-extrabold text-[#166534] font-mono">{presentShifts.length}</div>
                <div className="text-[9px] font-bold text-[#166534] uppercase">Presenças</div>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-200">
                <div className="text-lg font-extrabold text-rose-700 font-mono">{absentShifts.length}</div>
                <div className="text-[9px] font-bold text-rose-800 uppercase">Faltas</div>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-lg font-extrabold text-[#6D28D9] font-mono">{justifiedShifts.length}</div>
                <div className="text-[9px] font-bold text-[#6D28D9] uppercase">Atestados</div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
            Assiduidade: <strong className="text-slate-800">100%</strong>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Ações Rápidas
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onNavigateToRequests}
                className="w-full p-2 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-[#6D28D9] text-xs font-bold transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <span>🏖️</span> Pedir Folga ou Troca
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onNavigateToJustifications}
                className="w-full p-2 rounded-lg border border-emerald-200 bg-[#BBF7D0]/30 hover:bg-[#BBF7D0]/60 text-[#166534] text-xs font-bold transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <span>📄</span> Enviar Atestado / Justificativa
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
            Fluxo com aprovação do gestor
          </div>
        </div>
      </div>

      {/* Mini Weekly Schedule Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#166534]" />
              Minha Escala da Semana
            </h3>
            <p className="text-[11px] text-slate-500">
              Horários, reuniões e presenças confirmadas
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToCalendar}
            className="text-xs font-bold text-[#166534] hover:text-emerald-800 flex items-center gap-1"
          >
            Ver Calendário Completo <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 7 Days Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayShift = weeklyShifts.find(s => s.date === day.dateString);
            const isToday = day.isToday;

            return (
              <div
                key={day.dateString}
                onClick={() => dayShift && onShiftClick(dayShift)}
                className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[120px] ${
                  dayShift ? 'cursor-pointer hover:shadow-xs hover:border-emerald-300' : 'opacity-60 bg-slate-50'
                } ${
                  isToday
                    ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
                      {day.dayShort}
                    </span>
                    <span className={`text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center font-mono ${
                      isToday ? 'bg-[#166534] text-white' : 'text-slate-800 bg-slate-100'
                    }`}>
                      {day.date.getDate()}
                    </span>
                  </div>

                  {/* Shift Info */}
                  {dayShift ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5 text-[#166534]" />
                        {dayShift.startTime} - {dayShift.endTime}
                      </div>

                      <div className="text-[10px] text-slate-700 font-semibold line-clamp-2 leading-tight">
                        {dayShift.title || 'Turno Normal'}
                      </div>

                      {/* Meeting Tag if any */}
                      {dayShift.type === 'meeting' && (
                        <div className="text-[9px] text-[#166534] bg-[#BBF7D0] px-1 py-0.2 rounded font-bold inline-flex items-center gap-1">
                          <Video className="w-2.5 h-2.5" /> Reunião
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-slate-400 text-[11px] italic font-medium">
                      Folga
                    </div>
                  )}
                </div>

                {/* Bottom Status Icon */}
                {dayShift && (
                  <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                      dayShift.attendanceStatus === 'present' ? 'bg-[#BBF7D0] text-[#166534]' :
                      dayShift.attendanceStatus === 'absent' ? 'bg-rose-100 text-rose-800' :
                      dayShift.attendanceStatus === 'justified' ? 'bg-purple-100 text-[#6D28D9]' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {dayShift.attendanceStatus === 'present' ? '✓ Presente' :
                       dayShift.attendanceStatus === 'absent' ? '✗ Falta' :
                       dayShift.attendanceStatus === 'justified' ? '📄 Justificado' : '○ Pendente'}
                    </span>

                    {dayShift.meetingLink && (
                      <a
                        href={dayShift.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-600 hover:text-emerald-800 p-0.5"
                        title="Abrir Link da Reunião"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reminders / Activities from Manager for Employee */}
      {reminders.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#166534]" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Lembretes & Reuniões da Gestão
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{reminders.length} compromissos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {reminders.map(rem => (
              <div key={rem.id} className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 flex items-start justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{rem.title}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#BBF7D0] text-[#166534] font-bold">
                      {rem.date} {rem.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{rem.description}</p>
                </div>

                {rem.link && (
                  <a
                    href={rem.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-[#166534] hover:bg-emerald-800 text-[#BBF7D0] rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs"
                  >
                    <Video className="w-3 h-3" /> Entrar
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
