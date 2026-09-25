import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  CalendarDays, 
  Video, 
  TrendingUp, 
  FileCheck, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building,
  Check,
  ArrowUpRight
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
  isLightTheme: boolean;
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
  isLightTheme,
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

  const empShifts = shifts.filter(
    s => s.employeeId === employee.id && s.status === 'published'
  );

  const todayShift = empShifts.find(s => s.date === todayStr);

  const weeklyShifts = empShifts.filter(
    s => currentWeekDateStrings.includes(s.date)
  );

  const presentShifts = weeklyShifts.filter(
    s => s.attendanceStatus === 'present'
  );

  const absentShifts = weeklyShifts.filter(
    s => s.attendanceStatus === 'absent'
  );

  const justifiedShifts = weeklyShifts.filter(
    s => s.attendanceStatus === 'justified'
  );

  const hoursWorked = presentShifts.reduce((acc, s) => {
    return acc + calculateShiftDurationHours(
      s.startTime,
      s.endTime,
      s.breakMinutes
    );
  }, 0);

  const goalHours = employee.standardHoursPerWeek;
  const progressPercent = Math.min(
    100,
    Math.round((hoursWorked / goalHours) * 100)
  );

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
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }

      setTimeout(() => setCheckInSuccess(false), 4000);
    }, 1000);
  };

  return (
    <div
      className={`space-y-5 font-sans transition-all duration-300 relative ${
        isLightTheme ? 'text-[#0F172A]' : 'text-white'
      }`}
    >
      {/* 1. TOP SECTION: HERO WITH DIGITAL CLOCK & FLOATING PROOF WIDGET */}
      <div
        className={`rounded-[32px] p-6 sm:p-8 relative overflow-hidden transition-all duration-300 border ${
          isLightTheme
            ? 'border-slate-200 shadow-sm'
            : 'bg-gradient-to-br from-[#1a0010] via-[#0d0008] to-[#0a0308] border-[rgba(150,24,60,0.4)] shadow-2xl'
        }`}
        style={
          isLightTheme
            ? {
                background:
                  'radial-gradient(ellipse 70% 120% at 100% 30%, rgba(248, 150, 66, 0.18) 0%, rgba(150, 24, 60, 0.08) 40%, rgba(255, 255, 255, 0) 75%), #ffffff',
              }
            : {}
        }
      >
        {/* Abstract continuous background art / doodles */}
        {isLightTheme && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-65">
            <svg
              className="absolute right-8 top-1 w-[400px] h-[200px] text-[#96183c] stroke-current"
              viewBox="0 0 360 180"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 90 Q 55 15, 105 55 T 190 35 T 270 75 T 350 25" stroke="#f89642" strokeWidth="2.8" />
              <path d="M130 130 C 170 95, 220 170, 280 135 C 320 110, 345 150, 355 165" stroke="#96183c" strokeWidth="2.4" />
              <circle cx="110" cy="55" r="5" fill="#faf0ac" stroke="#f89642" strokeWidth="1.5" />
              <circle cx="230" cy="45" r="4" fill="#f89642" stroke="none" />
              <circle cx="310" cy="85" r="4.5" fill="#96183c" stroke="none" />
            </svg>
          </div>
        )}

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left Column: Big Digital Clock, Date & Shift Box */}
          <div className="flex-1 space-y-4">
            {/* Big Clean Digital Clock & Date */}
            <div>
              <div
                className={`text-4xl sm:text-5xl font-black tracking-tight font-sans ${
                  isLightTheme ? 'text-[#0F172A]' : 'text-white'
                }`}
              >
                {currentTime.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>

              <div
                className={`text-xs sm:text-sm font-bold capitalize mt-1.5 ${
                  isLightTheme ? 'text-slate-600' : 'text-white/70'
                }`}
              >
                {currentTime.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>

            {/* Today's Shift Card */}
            <div
              className={`rounded-xl p-3 sm:p-3.5 border transition-all duration-300 max-w-md ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 shadow-2xs'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {todayShift ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[9.5px] font-black tracking-wider uppercase font-mono ${
                        isLightTheme ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      TURNO DE HOJE
                    </span>

                    {/* Attendance Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        todayShift.attendanceStatus === 'present'
                          ? 'bg-gradient-to-r from-[#96183c] to-[#b32047] text-white shadow-2xs'
                          : isLightTheme
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : 'bg-[#96183C]/30 text-[#FCEABB] border border-[#F89847]/30'
                      }`}
                    >
                      {todayShift.attendanceStatus === 'present' ? (
                        <>
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          Presença Registrada ({todayShift.checkInTime || '07:58'})
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          Aguardando Ponto
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <Clock
                      className={`w-3.5 h-3.5 ${
                        isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'
                      }`}
                    />
                    <span
                      className={`text-sm font-black font-mono ${
                        isLightTheme ? 'text-[#0F172A]' : 'text-white'
                      }`}
                    >
                      {todayShift.startTime} - {todayShift.endTime}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        isLightTheme ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      ({calculateShiftDurationHours(
                        todayShift.startTime,
                        todayShift.endTime,
                        todayShift.breakMinutes
                      )}h)
                    </span>
                  </div>

                  <div
                    className={`text-[11px] font-bold ${
                      isLightTheme ? 'text-slate-700' : 'text-white/80'
                    }`}
                  >
                    {todayShift.title || 'Atendimento Geral - Turno Manhã'}
                  </div>

                  {/* GPS Proximity status */}
                  <div
                    className={`pt-1.5 border-t flex items-center gap-1.5 text-[10.5px] font-semibold ${
                      isLightTheme
                        ? 'border-slate-200 text-slate-600'
                        : 'border-white/10 text-white/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLightTheme ? 'bg-[#96183c]' : 'bg-[#F89847]'
                      }`}
                    />
                    <span>Validação GPS: Posto Sede SP (Dentro do raio de 100m)</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`text-xs py-1 flex items-center gap-2 font-bold ${
                    isLightTheme ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  <CalendarDays
                    className={`w-4 h-4 ${
                      isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'
                    }`}
                  />
                  <span>Você não possui turno escalado para hoje. Folga programada!</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Floating Proof / Check-In Widget */}
          <div className="shrink-0 lg:w-72">
            <div
              className={`rounded-3xl p-5 border transition-all duration-300 ${
                isLightTheme
                  ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {todayShift?.attendanceStatus === 'present' ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#96183c] to-[#b32047] text-white flex items-center justify-center font-black shadow-sm shrink-0">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                    <div>
                      <h4
                        className={`text-sm font-black leading-tight ${
                          isLightTheme ? 'text-[#0F172A]' : 'text-white'
                        }`}
                      >
                        Presença Registrada!
                      </h4>
                      <p
                        className={`text-[11px] font-semibold mt-0.5 ${
                          isLightTheme ? 'text-slate-600' : 'text-white/70'
                        }`}
                      >
                        Check-in às {todayShift.checkInTime || '07:58'} via GPS.
                      </p>
                    </div>
                  </div>

                  <div
                    className={`pt-2 border-t ${
                      isLightTheme ? 'border-slate-100' : 'border-white/10'
                    }`}
                  >
                    <div
                      className={`rounded-xl px-3 py-1.5 text-[11px] font-black font-mono text-center shadow-2xs ${
                        isLightTheme
                          ? 'bg-[#faf0ac]/80 border border-[#f89642]/60 text-[#96183c]'
                          : 'bg-[#96183c]/30 border border-[#f89642]/40 text-white'
                      }`}
                    >
                      Local: Sede Employer - SP
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <button
                    type="button"
                    onClick={handlePunchClock}
                    disabled={isSimulatingGps}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#96183c] via-[#b32047] to-[#f89642] hover:opacity-95 text-white font-black text-xs shadow-md shadow-[#96183c]/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{isSimulatingGps ? '📡' : '⏱️'}</span>
                    <span>{isSimulatingGps ? 'VALIDANDO GPS...' : 'REGISTRAR PONTO AGORA'}</span>
                  </button>
                  <p
                    className={`text-[10px] font-mono font-bold ${
                      isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Localização capturada via GPS criptografado
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CENTRAL WIDGETS: CARGA HORÁRIA, FREQUÊNCIA & AÇÕES RÁPIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Carga Horária Semanal */}
        <div
          className={`rounded-[28px] p-5 sm:p-6 border flex flex-col justify-between transition-all duration-300 ${
            isLightTheme
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#111318] border-white/10'
          }`}
        >
          <div>
            <div
              className={`text-[10px] font-black uppercase tracking-wider font-mono mb-2 ${
                isLightTheme ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              CARGA HORÁRIA SEMANAL
            </div>

            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-black font-sans ${
                  isLightTheme ? 'text-[#0F172A]' : 'text-white'
                }`}
              >
                {hoursWorked}h
              </span>
              <span
                className={`text-xs font-bold ${
                  isLightTheme ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                de {goalHours}h
              </span>
            </div>

            {/* Progress Bar with Bordô & Laranja Accent */}
            <div
              className={`w-full h-3 rounded-full mt-3 overflow-hidden p-0.5 border ${
                isLightTheme
                  ? 'bg-slate-100 border-slate-200'
                  : 'bg-white/10 border-white/5'
              }`}
            >
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isLightTheme ? 'border-slate-100' : 'border-white/10'
            }`}
          >
            <span
              className={`font-bold ${
                isLightTheme ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Meta semanal:
            </span>
            <span
              className={`font-black px-3 py-1 rounded-full text-xs ${
                hasMetGoal
                  ? 'bg-[#96183c] text-white shadow-2xs'
                  : isLightTheme
                  ? 'bg-[#faf0ac] border border-[#f89642]/50 text-[#96183c]'
                  : 'bg-[#96183c]/40 text-white'
              }`}
            >
              {hasMetGoal ? 'Meta Atingida ✓' : `Faltam ${Math.max(0, goalHours - hoursWorked)}h`}
            </span>
          </div>
        </div>

        {/* Card 2: Frequência da Semana */}
        <div
          className={`rounded-[28px] p-5 sm:p-6 border flex flex-col justify-between transition-all duration-300 ${
            isLightTheme
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#111318] border-white/10'
          }`}
        >
          <div>
            <div
              className={`text-[10px] font-black uppercase tracking-wider font-mono mb-3 ${
                isLightTheme ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              FREQUÊNCIA DA SEMANA
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              {/* Presenças (Bordô) */}
              <div
                className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center ${
                  isLightTheme
                    ? 'bg-[#96183c]/10 border-[#96183c]/30'
                    : 'bg-[#96183c]/30 border-[#96183c]/50'
                }`}
              >
                <div
                  className={`text-2xl font-black font-sans ${
                    isLightTheme ? 'text-[#96183c]' : 'text-white'
                  }`}
                >
                  {presentShifts.length}
                </div>
                <div
                  className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                    isLightTheme ? 'text-[#96183c]' : 'text-rose-300'
                  }`}
                >
                  PRESENÇAS
                </div>
              </div>

              {/* Faltas (Laranja) */}
              <div
                className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center ${
                  isLightTheme
                    ? 'bg-[#f89642]/15 border-[#f89642]/40'
                    : 'bg-orange-500/10 border-orange-500/30'
                }`}
              >
                <div
                  className={`text-2xl font-black font-sans ${
                    isLightTheme ? 'text-[#c2410c]' : 'text-white'
                  }`}
                >
                  {absentShifts.length}
                </div>
                <div
                  className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                    isLightTheme ? 'text-[#c2410c]' : 'text-orange-300'
                  }`}
                >
                  FALTAS
                </div>
              </div>

              {/* Atestados (Amarelo) */}
              <div
                className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center ${
                  isLightTheme
                    ? 'bg-[#faf0ac]/60 border-[#f89642]/40'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div
                  className={`text-2xl font-black font-sans ${
                    isLightTheme ? 'text-[#854d0e]' : 'text-white'
                  }`}
                >
                  {justifiedShifts.length}
                </div>
                <div
                  className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                    isLightTheme ? 'text-[#854d0e]' : 'text-amber-300'
                  }`}
                >
                  ATESTADOS
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isLightTheme ? 'border-slate-100' : 'border-white/10'
            }`}
          >
            <span
              className={`font-bold ${
                isLightTheme ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Assiduidade:
            </span>
            <span
              className={`font-black ${
                isLightTheme ? 'text-[#0F172A]' : 'text-white'
              }`}
            >
              100%
            </span>
          </div>
        </div>

        {/* Card 3: Ações Rápidas */}
        <div
          className={`rounded-[28px] p-5 sm:p-6 border flex flex-col justify-between transition-all duration-300 ${
            isLightTheme
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#111318] border-white/10'
          }`}
        >
          <div>
            <div
              className={`text-[10px] font-black uppercase tracking-wider font-mono mb-3 ${
                isLightTheme ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              AÇÕES RÁPIDAS
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onNavigateToRequests}
                className={`w-full py-2.5 px-4 rounded-full border text-xs font-black transition-all flex items-center justify-between shadow-2xs active:scale-98 cursor-pointer ${
                  isLightTheme
                    ? 'bg-gradient-to-r from-[#faf0ac]/60 via-[#f89642]/20 to-[#faf0ac]/40 hover:from-[#faf0ac] hover:to-[#f89642]/30 border-[#f89642]/50 text-[#96183c]'
                    : 'bg-white/5 hover:bg-[#96183c] hover:border-[#96183c] border-white/10 text-white'
                }`}
              >
                <span>Pedir Folga ou Troca</span>
                <ArrowRight
                  className={`w-3.5 h-3.5 opacity-80 ${
                    isLightTheme ? 'text-[#96183c]' : 'text-white'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={onNavigateToJustifications}
                className={`w-full py-2.5 px-4 rounded-full border text-xs font-black transition-all flex items-center justify-between shadow-2xs active:scale-98 cursor-pointer ${
                  isLightTheme
                    ? 'bg-gradient-to-r from-[#faf0ac]/60 via-[#f89642]/20 to-[#faf0ac]/40 hover:from-[#faf0ac] hover:to-[#f89642]/30 border-[#f89642]/50 text-[#96183c]'
                    : 'bg-white/5 hover:bg-[#96183c] hover:border-[#96183c] border-white/10 text-white'
                }`}
              >
                <span>Enviar Atestado / Justif.</span>
                <ArrowRight
                  className={`w-3.5 h-3.5 opacity-80 ${
                    isLightTheme ? 'text-[#96183c]' : 'text-white'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MINHA ESCALA DA SEMANA */}
      <div
        className={`rounded-[28px] p-5 sm:p-6 border transition-all duration-300 ${
          isLightTheme
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#111318] border-white/10'
        }`}
      >
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-4 ${
            isLightTheme ? 'border-slate-100' : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#96183c] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3
                className={`font-black text-sm leading-tight ${
                  isLightTheme ? 'text-[#0F172A]' : 'text-white'
                }`}
              >
                Minha Escala da Semana
              </h3>
              <p
                className={`text-[11px] font-bold ${
                  isLightTheme ? 'text-slate-500' : 'text-white/60'
                }`}
              >
                Horários, reuniões e presenças confirmadas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToCalendar}
            className={`text-xs font-black hover:underline flex items-center gap-1 cursor-pointer ${
              isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'
            }`}
          >
            <span>Ver Calendário Completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 7 Days Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDays.map(day => {
            const dayShift = weeklyShifts.find(s => s.date === day.dateString);
            const isToday = day.isToday;

            return (
              <div
                key={day.dateString}
                onClick={() => dayShift && onShiftClick(dayShift)}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between min-h-[145px] ${
                  dayShift ? 'cursor-pointer hover:shadow-md' : 'opacity-70'
                } ${
                  isToday
                    ? isLightTheme
                      ? 'bg-gradient-to-b from-[#faf0ac]/35 to-[#f89642]/10 border-2 border-[#96183c] shadow-sm'
                      : 'bg-[#96183c]/20 border-2 border-[#f89642]'
                    : isLightTheme
                    ? 'bg-slate-50/70 hover:bg-white border-slate-200'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider ${
                        isLightTheme ? 'text-slate-600' : 'text-white/60'
                      }`}
                    >
                      {day.dayShort}
                    </span>
                    <span
                      className={`text-xs font-black ${
                        isToday
                          ? isLightTheme
                            ? 'text-[#96183c] text-sm'
                            : 'text-[#f89642] text-sm'
                          : isLightTheme
                          ? 'text-[#0F172A]'
                          : 'text-white'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                  </div>

                  {/* Shift Information */}
                  {dayShift ? (
                    <div className="space-y-1">
                      <div
                        className={`text-[11px] font-black font-mono flex items-center gap-1 ${
                          isLightTheme ? 'text-[#0F172A]' : 'text-white'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLightTheme ? 'bg-[#96183c]' : 'bg-[#f89642]'
                          }`}
                        />
                        <span>{dayShift.startTime} - {dayShift.endTime}</span>
                      </div>
                      <div
                        className={`text-[11px] font-bold line-clamp-2 leading-snug ${
                          isLightTheme ? 'text-slate-700' : 'text-white/80'
                        }`}
                      >
                        {dayShift.title || 'Turno Normal'}
                      </div>
                      {dayShift.type === 'meeting' && (
                        <span
                          className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full mt-1 ${
                            isLightTheme
                              ? 'bg-[#faf0ac] text-[#96183c] border border-[#f89642]/40'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          Reunião
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`text-center py-6 text-[11px] font-bold ${
                        isLightTheme ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Folga
                    </div>
                  )}
                </div>

                {/* Bottom Status Pill */}
                {dayShift && (
                  <div
                    className={`pt-2 border-t mt-2 flex items-center justify-between ${
                      isLightTheme ? 'border-slate-200' : 'border-white/10'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                        dayShift.attendanceStatus === 'present'
                          ? 'bg-[#96183c] text-white shadow-2xs'
                          : isLightTheme
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {dayShift.attendanceStatus === 'present' ? 'Presente' : 'Pendente'}
                    </span>

                    {dayShift.meetingLink && (
                      <a
                        href={dayShift.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 ${
                          isLightTheme
                            ? 'text-[#96183c] hover:text-[#750e2c]'
                            : 'text-white/80 hover:text-white'
                        }`}
                        title="Abrir Reunião"
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

      {/* 4. LEMBRETES & REUNIÕES DA GESTÃO */}
      {reminders.length > 0 && (
        <div
          className={`rounded-[28px] p-5 border transition-all duration-300 ${
            isLightTheme
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#111318] border-white/10'
          }`}
        >
          <div
            className={`flex items-center justify-between pb-3 border-b mb-3 ${
              isLightTheme ? 'border-slate-100' : 'border-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <h3
                className={`font-black text-sm ${
                  isLightTheme ? 'text-[#0F172A]' : 'text-white'
                }`}
              >
                Lembretes & Reuniões da Gestão
              </h3>
            </div>

            <span
              className={`text-xs font-bold flex items-center gap-1 ${
                isLightTheme ? 'text-slate-600' : 'text-white/70'
              }`}
            >
              <Check
                className={`w-3.5 h-3.5 stroke-[3] ${
                  isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'
                }`}
              />
              {reminders.length} compromissos
            </span>
          </div>

          <div className="space-y-2">
            {reminders.map(rem => (
              <div
                key={rem.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isLightTheme
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLightTheme ? 'bg-[#96183c]' : 'bg-[#f89642]'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      isLightTheme ? 'text-[#0F172A]' : 'text-white'
                    }`}
                  >
                    {rem.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full ${
                      isLightTheme
                        ? 'bg-[#faf0ac] text-[#96183c] border border-[#f89642]/40'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {rem.date} {rem.time}
                  </span>
                </div>

                {rem.link && (
                  <a
                    href={rem.link}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-1.5 bg-gradient-to-r from-[#96183c] to-[#b32047] hover:opacity-95 text-white rounded-full text-xs font-black shrink-0 flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Entrar
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