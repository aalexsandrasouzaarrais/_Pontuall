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
  ArrowUpRight,
  RotateCcw,
  History,
  FileText,
  X
} from 'lucide-react';
import { Employee, Shift, ManagerReminder } from '@/types';
import { getWeekDates, calculateShiftDurationHours, getTodayDateString } from '@/shared/utils/dateUtils';
import { ReminderDetailModal } from './ReminderDetailModal';
import { getCurrentCoordinates, reverseGeocode, validateGeofence, calculateHaversineDistance } from '@/shared/utils/geolocation';
import { findWorkplaceByName, getStoredWorkplaces } from '@/shared/services/workplaceService';
import { supabase } from '@/shared/services/supabase';

const formatDistance = (meters?: number) => {
  if (meters === undefined || meters === null) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

interface EmployeeMainViewProps {
  employee: Employee;
  shifts: Shift[];
  reminders: ManagerReminder[];
  onCheckIn: (
    shiftId: string,
    locationData: {
      address: string;
      gpsValidated: boolean;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      distanceMeters?: number;
      reportedWorkplace?: string;
    },
    punchType?: 'entrada' | 'saida'
  ) => void;
  onNavigateToCalendar: () => void;
  onNavigateToRequests: () => void;
  onNavigateToJustifications: () => void;
  onShiftClick: (shift: Shift) => void;
  isLightTheme: boolean;
  employees?: Employee[];
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
  employees = [],
}) => {
  const [selectedReminder, setSelectedReminder] = useState<ManagerReminder | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [temporaryWorkplaceName, setTemporaryWorkplaceName] = useState('');
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [isResettingPunch, setIsResettingPunch] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const directManager = employees.find(e => employee.managerIds?.includes(e.id)) ||
    employees.find(e => e.id !== employee.id && e.department?.toLowerCase() === employee.department?.toLowerCase() && (e.roleType === 'gestor' || e.role.toLowerCase().includes('gestor') || e.role.toLowerCase().includes('gerente'))) ||
    (employee.roleType === 'colaborador' ? employees.find(e => e.id !== employee.id && (e.roleType === 'gestor' || e.isMasterManager || e.isRh)) : null);

  const isTemporaryWorker =
    employee.contractType === 'TEMPORARIO' ||
    todayShift?.workplace?.toLowerCase().includes('temporario') ||
    todayShift?.workplace?.toLowerCase().includes('externo');

  const currentShiftWorkplace =
    todayShift?.workplaceLocation ||
    findWorkplaceByName(todayShift?.workplace) ||
    findWorkplaceByName(todayShift?.department) ||
    findWorkplaceByName(employee.workplace) ||
    getStoredWorkplaces()[0];

  const hasCheckedIn = Boolean(todayShift?.checkInTime);
  const hasCheckedOut = Boolean(todayShift?.checkOutTime);

  const workplaceMapsUrl = currentShiftWorkplace?.latitude && currentShiftWorkplace?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${currentShiftWorkplace.latitude},${currentShiftWorkplace.longitude}`
    : currentShiftWorkplace?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentShiftWorkplace.address)}`
    : null;

  const punchLat = todayShift?.checkInLocation?.latitude;
  const punchLng = todayShift?.checkInLocation?.longitude;
  const punchOutLat = todayShift?.checkOutLocation?.latitude;
  const punchOutLng = todayShift?.checkOutLocation?.longitude;
  const targetLat = currentShiftWorkplace?.latitude;
  const targetLng = currentShiftWorkplace?.longitude;
  const targetRadius = currentShiftWorkplace?.radiusMeters || 200;

  let dynamicDistance = todayShift?.checkInLocation?.distanceMeters;
  let isGpsValidDynamic = todayShift?.checkInLocation?.gpsValidated;

  if (
    punchLat !== undefined &&
    punchLng !== undefined &&
    punchLat !== 0 &&
    punchLng !== 0 &&
    targetLat !== undefined &&
    targetLng !== undefined &&
    targetLat !== 0 &&
    targetLng !== 0
  ) {
    dynamicDistance = calculateHaversineDistance(punchLat, punchLng, targetLat, targetLng);
    isGpsValidDynamic = dynamicDistance <= targetRadius;
  }

  let dynamicOutDistance = todayShift?.checkOutLocation?.distanceMeters;
  let isGpsOutValidDynamic = todayShift?.checkOutLocation?.gpsValidated;

  if (
    punchOutLat !== undefined &&
    punchOutLng !== undefined &&
    punchOutLat !== 0 &&
    punchOutLng !== 0 &&
    targetLat !== undefined &&
    targetLng !== undefined &&
    targetLat !== 0 &&
    targetLng !== 0
  ) {
    dynamicOutDistance = calculateHaversineDistance(punchOutLat, punchOutLng, targetLat, targetLng);
    isGpsOutValidDynamic = dynamicOutDistance <= targetRadius;
  }

  const calculateTodayWorkedHours = () => {
    if (!todayShift?.checkInTime || !todayShift?.checkOutTime) return null;
    const [inH, inM] = todayShift.checkInTime.split(':').map(Number);
    const [outH, outM] = todayShift.checkOutTime.split(':').map(Number);
    let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  };

  const handleResetTodayPunch = async () => {
    if (!todayShift) return;
    setIsResettingPunch(true);
    try {
      if (todayShift.id) {
        await supabase.from('TAB_Registro_Ponto').delete().eq('Idf_Turno', todayShift.id);
      }
      if (employee.id) {
        await supabase
          .from('TAB_Registro_Ponto')
          .delete()
          .eq('Idf_Colaborador', employee.id)
          .gte('Dat_Registro', `${todayStr}T00:00:00`);
      }
    } catch (err) {
      console.warn('Erro ao limpar ponto:', err);
    } finally {
      setIsResettingPunch(false);
    }
    todayShift.attendanceStatus = 'pending';
    todayShift.checkInTime = undefined;
    todayShift.checkInLocation = undefined;
    todayShift.checkOutTime = undefined;
    todayShift.checkOutLocation = undefined;
    onCheckIn(todayShift.id, {
      address: '',
      gpsValidated: false,
    }, 'entrada');
  };

  const handlePunchClock = async (forceType?: 'entrada' | 'saida') => {
    if (!todayShift) return;
    const punchType: 'entrada' | 'saida' = forceType || (hasCheckedIn ? 'saida' : 'entrada');
    setGpsError(null);
    setIsCapturingGps(true);

    try {
      // 1. Obtém coordenadas reais do GPS do navegador/aparelho via HTML5 Geolocation
      const coords = await getCurrentCoordinates();

      // 2. Geocodificação reversa gratuita via OpenStreetMap Nominatim (com fallback BigDataCloud)
      const geoAddress = await reverseGeocode(coords.latitude, coords.longitude);
      const formattedAddress = geoAddress.formattedAddress;

      // 3. Validação de Geofence contra o local alocado para o turno/colaborador
      let gpsValidated = true;
      let distanceMeters = 0;
      let reportedWorkplace: string | undefined = undefined;

      if (isTemporaryWorker) {
        // Se for temporário ou turno externo, registra o posto informado
        reportedWorkplace = temporaryWorkplaceName.trim() || 'Posto Externo / Temporário';
        gpsValidated = true;
      } else {
        // Busca o posto de trabalho configurado no turno ou no cadastro do colaborador
        const targetWorkplace = currentShiftWorkplace;

        if (targetWorkplace && !targetWorkplace.isRemote && targetWorkplace.latitude !== 0) {
          const geofenceResult = validateGeofence(
            coords.latitude,
            coords.longitude,
            targetWorkplace.latitude,
            targetWorkplace.longitude,
            targetWorkplace.radiusMeters || 200
          );
          gpsValidated = geofenceResult.isValid;
          distanceMeters = geofenceResult.distanceMeters;
        } else {
          gpsValidated = true;
        }
      }

      // 4. Executa o check-in com dados reais e tipo (entrada ou saida)
      onCheckIn(todayShift.id, {
        address: formattedAddress,
        gpsValidated,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        distanceMeters,
        reportedWorkplace,
      }, punchType);

      setCheckInSuccess(true);
      setTimeout(() => setCheckInSuccess(false), 5000);
    } catch (err: any) {
      console.error('Erro na captura de ponto GPS:', err);
      setGpsError(err.message || 'Não foi possível capturar sua localização. Verifique as permissões de GPS.');
    } finally {
      setIsCapturingGps(false);
    }
  };

  return (
    <div
      className={`space-y-5 font-sans transition-all duration-300 relative ${
        isLightTheme ? 'text-[#0F172A]' : 'text-white'
      }`}
    >
      {/* 1. TOP SECTION: HERO WITH DIGITAL CLOCK & FLOATING PROOF WIDGET */}
      <div
        className={`rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-300 border ${
          isLightTheme
            ? 'bg-white border-slate-200/90 shadow-sm'
            : 'bg-[#13161f] border-white/10 shadow-xl'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left Column: Big Digital Clock, Date & Shift Box */}
          <div className="flex-1 space-y-4">
            {/* Big Clean Digital Clock & Date */}
            <div>
              {/* Badge de Gestor Direto */}
              {directManager && employee.roleType !== 'gestor' && !employee.isRh && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2.5 border transition-all ${
                  isLightTheme 
                    ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-2xs' 
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#f89847] shrink-0" />
                  <span>Gestor Direto: <strong className="font-extrabold">{directManager.name}</strong> ({directManager.role})</span>
                </div>
              )}

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

                  {/* Informações do Posto de Trabalho e Endereço */}
                  <div
                    className={`pt-2 border-t space-y-1 text-xs ${
                      isLightTheme
                        ? 'border-slate-200 text-slate-600'
                        : 'border-white/10 text-white/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'
                        }`}
                      />
                      <span className="font-bold text-xs truncate">
                        {currentShiftWorkplace?.name || todayShift.workplace || 'Posto Presencial'}
                      </span>
                      {currentShiftWorkplace?.isRemote ? (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 shrink-0">
                          Remoto
                        </span>
                      ) : (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 shrink-0">
                          Presencial ({currentShiftWorkplace?.radiusMeters || 200}m)
                        </span>
                      )}
                    </div>
                    {currentShiftWorkplace?.address && !currentShiftWorkplace.isRemote && (
                      <div className="pl-5 pt-0.5 space-y-1">
                        <p className="text-[10.5px] text-slate-400 line-clamp-1">
                          {currentShiftWorkplace.address}
                        </p>
                        {workplaceMapsUrl && (
                          <a
                            href={workplaceMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 transition-all shadow-2xs cursor-pointer"
                            title="Abrir rota no Google Maps"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>🗺️ Como Chegar (Google Maps)</span>
                          </a>
                        )}
                      </div>
                    )}
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

          {/* Right Column: Floating Proof / Check-In Widget (Entrada e Saída) */}
          <div className="shrink-0 lg:w-80">
            <div
              className={`rounded-3xl p-5 border transition-all duration-300 ${
                isLightTheme
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-[#151821] border-white/10 shadow-lg'
              }`}
            >
              {/* Feedback de Confirmação Digital */}
              {checkInSuccess && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-[11px]">Ponto Registrado com Sucesso</p>
                    <p className="text-[10px] font-mono opacity-80">Protocolo #{Date.now().toString().slice(-6)} • Horário Oficial de Brasília</p>
                  </div>
                </div>
              )}

              {hasCheckedIn && hasCheckedOut ? (
                /* ESTADO 1: JORNADA COMPLETA (ENTRADA + SAÍDA BATIDAS) */
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h4
                        className={`text-sm font-bold leading-tight ${
                          isLightTheme ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        Jornada Concluída
                      </h4>
                      <p
                        className={`text-[11px] font-medium mt-0.5 ${
                          isLightTheme ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Total trabalhado hoje: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{calculateTodayWorkedHours() || '8h'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Detalhes de Entrada e Saída */}
                  <div
                    className={`pt-2 border-t space-y-2 ${
                      isLightTheme ? 'border-slate-100' : 'border-white/10'
                    }`}
                  >
                    {/* Entrada */}
                    <div
                      className={`rounded-xl p-2.5 text-[10px] space-y-1 ${
                        isLightTheme ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white/5 border border-white/10 text-white/90'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">🟢 Entrada: {todayShift.checkInTime}</span>
                        {isGpsValidDynamic ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-mono font-semibold">GPS OK ({formatDistance(dynamicDistance)})</span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono font-semibold">Fora ({formatDistance(dynamicDistance)})</span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-slate-400 truncate">{todayShift.checkInLocation?.address || 'Localização Registrada'}</p>
                    </div>

                    {/* Saída */}
                    <div
                      className={`rounded-xl p-2.5 text-[10px] space-y-1 ${
                        isLightTheme ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white/5 border border-white/10 text-white/90'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">🛑 Saída: {todayShift.checkOutTime}</span>
                        {isGpsOutValidDynamic ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-mono font-semibold">GPS OK ({formatDistance(dynamicOutDistance)})</span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono font-semibold">Fora ({formatDistance(dynamicOutDistance)})</span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-slate-400 truncate">{todayShift.checkOutLocation?.address || 'Localização Registrada'}</p>
                    </div>

                    {/* Botão de Histórico */}
                    <button
                      type="button"
                      onClick={() => setIsHistoryOpen(true)}
                      className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Meu Histórico de Batidas</span>
                    </button>

                    {/* Botão para limpar ponto e testar novamente */}
                    <button
                      type="button"
                      onClick={handleResetTodayPunch}
                      disabled={isResettingPunch}
                      className="w-full py-1.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-[10px] font-semibold text-slate-500 dark:text-white/60 hover:text-amber-500 hover:border-amber-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className={`w-3 h-3 ${isResettingPunch ? 'animate-spin' : ''}`} />
                      {isResettingPunch ? 'Limpando...' : 'Limpar Ponto de Teste'}
                    </button>
                  </div>
                </div>
              ) : hasCheckedIn ? (
                /* ESTADO 2: ENTRADA JÁ REGISTRADA, SAÍDA PENDENTE */
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 dark:bg-white/10 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4
                        className={`text-sm font-bold leading-tight ${
                          isLightTheme ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        Expediente em Andamento
                      </h4>
                      <p
                        className={`text-[11px] font-medium mt-0.5 ${
                          isLightTheme ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Entrada às <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{todayShift.checkInTime}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Resumo da Entrada */}
                  <div
                    className={`rounded-xl p-2.5 text-[10px] space-y-1 ${
                      isLightTheme ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-white/5 border border-white/10 text-white/90'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">🟢 Entrada: {todayShift.checkInTime}</span>
                      {isGpsValidDynamic ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-mono font-semibold">GPS OK ({formatDistance(dynamicDistance)})</span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono font-semibold">Fora ({formatDistance(dynamicDistance)})</span>
                      )}
                    </div>
                    <p className="text-[9.5px] text-slate-400 truncate">{todayShift.checkInLocation?.address || 'Localização Registrada'}</p>
                  </div>

                  {/* Botão de Bater Saída */}
                  <button
                    type="button"
                    onClick={() => handlePunchClock('saida')}
                    disabled={isCapturingGps}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Saída'}</span>
                  </button>

                  {/* Mensagem de Erro de GPS amigável se a permissão for negada */}
                  {gpsError && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] font-semibold text-left">
                      ⚠️ {gpsError}
                    </div>
                  )}

                  {/* Botão de Histórico */}
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="w-full mt-2 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Meu Histórico de Batidas</span>
                  </button>

                  {/* Botão para limpar ponto e testar novamente */}
                  <button
                    type="button"
                    onClick={handleResetTodayPunch}
                    disabled={isResettingPunch}
                    className="w-full py-1.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-[10px] font-semibold text-slate-500 dark:text-white/60 hover:text-amber-500 hover:border-amber-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className={`w-3 h-3 ${isResettingPunch ? 'animate-spin' : ''}`} />
                    {isResettingPunch ? 'Limpando...' : 'Limpar Ponto de Teste'}
                  </button>
                </div>
              ) : (
                /* ESTADO 3: ENTRADA PENDENTE (NENHUM PONTO BATIDO AINDA) */
                <div className="space-y-3">
                  {/* Se for colaborador temporário, exibe campo para declarar o posto/cliente */}
                  {isTemporaryWorker && (
                    <div className="text-left space-y-1 mb-2">
                      <label
                        className={`text-[10px] font-bold uppercase tracking-wider block ${
                          isLightTheme ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        Posto / Cliente Atendido:
                      </label>
                      <input
                        type="text"
                        value={temporaryWorkplaceName}
                        onChange={(e) => setTemporaryWorkplaceName(e.target.value)}
                        placeholder="Ex: Stand Feira Anhembi, Obra Torre B..."
                        className={`w-full px-3 py-2 text-xs rounded-xl border font-medium outline-hidden transition-all ${
                          isLightTheme
                            ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-slate-600'
                            : 'bg-white/10 border-white/20 text-white focus:border-white/40'
                        }`}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handlePunchClock('entrada')}
                    disabled={isCapturingGps}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Entrada'}</span>
                  </button>

                  {/* Mensagem de Erro de GPS amigável se a permissão for negada */}
                  {gpsError && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] font-semibold text-left">
                      ⚠️ {gpsError}
                    </div>
                  )}

                  <p
                    className={`text-[10.5px] font-medium text-center ${
                      isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Início da jornada com geolocalização auditável
                  </p>

                  {/* Botão de Histórico */}
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="w-full pt-1 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Ver Histórico de Batidas</span>
                  </button>
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
                onClick={() => setSelectedReminder(rem)}
                className={`group p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.008] ${
                  isLightTheme
                    ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 hover:border-[#96183c]/30 hover:shadow-xs'
                    : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-[#f89642]/30 hover:shadow-md'
                }`}
                title="Toque para ver a descrição completa e detalhes do compromisso"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isLightTheme ? 'bg-[#96183c]' : 'bg-[#f89642]'
                    }`}
                  />
                  <span
                    className={`text-xs font-bold truncate group-hover:text-[#96183c] dark:group-hover:text-[#f89642] transition-colors ${
                      isLightTheme ? 'text-[#0F172A]' : 'text-white'
                    }`}
                  >
                    {rem.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                      isLightTheme
                        ? 'bg-[#faf0ac] text-[#96183c] border border-[#f89642]/40'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {rem.date} {rem.time}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rem.link && (
                    <a
                      href={rem.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="px-4 py-1.5 bg-gradient-to-r from-[#96183c] to-[#b32047] hover:opacity-95 text-white rounded-full text-xs font-black shrink-0 flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Entrar
                    </a>
                  )}

                  <span
                    className={`p-1 rounded-lg text-xs transition-colors opacity-60 group-hover:opacity-100 ${
                      isLightTheme ? 'text-slate-400 group-hover:text-slate-800' : 'text-white/40 group-hover:text-white'
                    }`}
                    title="Ver detalhes"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO LEMBRETE */}
      <ReminderDetailModal
        isOpen={!!selectedReminder}
        onClose={() => setSelectedReminder(null)}
        reminder={selectedReminder}
        employees={employees}
        currentEmployee={employee}
        isLightTheme={isLightTheme}
      />

      {/* MODAL DE HISTÓRICO DE BATIDAS / FOLHA DE PONTO DO COLABORADOR */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#151821] border-white/10 text-white'
            }`}
          >
            {/* Header */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Meu Histórico de Batidas</h3>
                  <p className="text-[11px] text-slate-400">Extrato de presenças e jornadas registradas via GPS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Table */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {empShifts.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  Nenhum registro de turno localizado para o período.
                </div>
              ) : (
                empShifts.map((shift) => {
                  const hasIn = Boolean(shift.checkInTime);
                  const hasOut = Boolean(shift.checkOutTime);
                  return (
                    <div
                      key={shift.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isLightTheme ? 'bg-slate-50/70 border-slate-200' : 'bg-white/[0.03] border-white/10'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[12px]">{shift.date.split('-').reverse().join('/')}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            shift.attendanceStatus === 'present'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/70'
                          }`}>
                            {shift.attendanceStatus === 'present' ? 'Presente' : 'Pendente'}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400">
                          Turno: {shift.startTime} – {shift.endTime} • {shift.workplace || 'Posto Presencial'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Entrada */}
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Entrada</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {hasIn ? shift.checkInTime : '—'}
                          </span>
                        </div>

                        {/* Saída */}
                        <div className="text-right">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Saída</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {hasOut ? shift.checkOutTime : '—'}
                          </span>
                        </div>

                        {/* GPS Badge */}
                        <div className="text-right min-w-[70px]">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">GPS</span>
                          <span className={`text-[9.5px] font-bold ${
                            shift.checkInLocation?.gpsValidated !== false ? 'text-emerald-500' : 'text-amber-500'
                          }`}>
                            {hasIn ? (shift.checkInLocation?.gpsValidated !== false ? '✓ Validado' : '⚠ Fora') : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t flex items-center justify-between text-[11px] text-slate-400 ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <span>Conforme requisitos da Portaria MTP 671/2021</span>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};