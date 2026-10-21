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
  X,
  Briefcase
} from 'lucide-react';
import { Employee, Shift, ManagerReminder } from '@/types';
import { getWeekDates, calculateShiftDurationHours, getTodayDateString } from '@/shared/utils/dateUtils';
import { ReminderDetailModal } from './ReminderDetailModal';
import { getCurrentCoordinates, reverseGeocode, validateGeofence, calculateHaversineDistance } from '@/shared/utils/geolocation';
import { findWorkplaceByName, getStoredWorkplaces } from '@/shared/services/workplaceService';
import { supabase } from '@/shared/services/supabase';
import { getPunchesSupabase } from '@/modules/shifts/services/shiftService';
import { PjTimesheetTracker } from './PjTimesheetTracker';
import { showPolishedToast } from '@/components/ui/halo-toast';

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
  onNavigateToPjReports?: () => void;
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
  onNavigateToPjReports,
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
  const [dbPunches, setDbPunches] = useState<any[]>([]);
  const [isLoadingPunches, setIsLoadingPunches] = useState(false);

  const loadPunches = async () => {
    setIsLoadingPunches(true);
    try {
      const list = await getPunchesSupabase(employee.id);
      setDbPunches(list);
    } catch (err) {
      console.warn('Erro ao buscar batidas de ponto:', err);
    } finally {
      setIsLoadingPunches(false);
    }
  };

  useEffect(() => {
    loadPunches();
  }, [employee.id]);

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

  const rawWorkplace =
    todayShift?.workplaceLocation ||
    findWorkplaceByName(todayShift?.workplace) ||
    findWorkplaceByName(employee.department) ||
    findWorkplaceByName(employee.workplace);

  const currentShiftWorkplace = rawWorkplace || (getStoredWorkplaces()[0]?.latitude ? getStoredWorkplaces()[0] : {
    id: 'wp-padrao',
    name: todayShift?.workplace || employee.workplace || 'Posto Presencial',
    address: 'Endereço definido pelo gestor',
    latitude: 0,
    longitude: 0,
    radiusMeters: 200,
    isRemote: false,
  });

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
    if (!todayShift) {
      const msg = 'Você não possui turno escalado para hoje. Não é possível bater ponto.';
      setGpsError(msg);
      showPolishedToast({
        id: 'no-shift-alert',
        title: 'Sem Turno Cadastrado',
        description: msg,
        rimVariant: 'destructive',
        duration: 5000,
        closeButton: true,
      });
      return;
    }
    const punchType: 'entrada' | 'saida' = forceType || (hasCheckedIn ? 'saida' : 'entrada');
    const targetShiftId = todayShift.id;
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
      onCheckIn(targetShiftId, {
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
      loadPunches();
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
      {/* 1. TOP SECTION: HERO WITH DIGITAL CLOCK & FLOATING PROOF WIDGET (Modo Claro e Escuro) */}
      <div
        className={`rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-300 border ${
          isLightTheme
            ? 'border-amber-200/70 shadow-xl'
            : 'border-white/10 shadow-2xl'
        }`}
        style={{
          background: isLightTheme
            ? 'radial-gradient(ellipse 75% 75% at 18% 45%, rgba(249, 222, 151, 0.45) 0%, rgba(245, 146, 66, 0.18) 40%, rgba(255, 255, 255, 0) 70%), radial-gradient(ellipse 85% 85% at 78% 55%, rgba(254, 205, 211, 0.55) 0%, rgba(254, 226, 226, 0.3) 45%, rgba(255, 255, 255, 0) 75%), #FFFDF9'
            : 'radial-gradient(ellipse 75% 75% at 18% 45%, rgba(245, 215, 140, 0.32) 0%, rgba(200, 150, 60, 0.15) 38%, rgba(10, 8, 13, 0) 70%), radial-gradient(ellipse 85% 85% at 78% 55%, rgba(230, 90, 45, 0.45) 0%, rgba(150, 24, 60, 0.35) 40%, rgba(10, 8, 13, 0) 75%), #0B080D',
        }}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left Column: Big Digital Clock with orange bar indicator, Date & Shift Box */}
          <div className="flex-1 space-y-4">
            {/* Big Clean Digital Clock & Date */}
            <div className={`border-l-[3.5px] ${isLightTheme ? 'border-[#e85d45]' : 'border-[#f89642]'} pl-3.5 space-y-0.5`}>
              <div
                className={`text-4xl sm:text-5xl font-black tracking-tight font-sans ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}
              >
                {currentTime.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>

              <div
                className={`text-xs sm:text-sm font-bold mt-1 ${
                  isLightTheme ? 'text-slate-700' : 'text-slate-200'
                }`}
              >
                {(() => {
                  const weekday = currentTime.toLocaleDateString('pt-BR', { weekday: 'long' });
                  const day = currentTime.getDate();
                  const month = currentTime.toLocaleDateString('pt-BR', { month: 'long' });
                  const year = currentTime.getFullYear();
                  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
                  const formattedWeekday = weekday.split('-').map(cap).join('-');
                  return `${formattedWeekday}, ${day} De ${cap(month)} De ${year}`;
                })()}
              </div>
            </div>

            {/* Today's Shift Card (Contraste nítido e legível) */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 max-w-lg ${
                isLightTheme
                  ? 'bg-white border-slate-200 shadow-md'
                  : 'bg-[#151822]/95 border-white/10 shadow-lg'
              }`}
            >
              {todayShift ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      className={`w-4 h-4 ${
                        isLightTheme ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-black tracking-wider uppercase font-mono ${
                        isLightTheme ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      TURNO DE HOJE
                    </span>
                  </div>

                  {/* Hours & Title */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock
                        className={`w-4 h-4 ${
                          isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'
                        }`}
                      />
                      <span
                        className={`text-base font-black font-mono ${
                          isLightTheme ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {todayShift.startTime} - {todayShift.endTime}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isLightTheme ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        ({calculateShiftDurationHours(
                          todayShift.startTime,
                          todayShift.endTime,
                          todayShift.breakMinutes
                        )}h)
                      </span>
                    </div>

                    <p
                      className={`text-xs font-bold pl-6 ${
                        isLightTheme ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      {todayShift.title || 'Comercial (5x2)'}
                    </p>
                  </div>

                  {/* Workplace Location & Address & How to get there */}
                  <div
                    className={`pt-2.5 border-t space-y-2.5 ${
                      isLightTheme ? 'border-slate-200' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin
                        className="w-4 h-4 text-[#e85d45] shrink-0 mt-0.5"
                      />
                      <div>
                        <p
                          className={`text-xs font-black leading-tight ${
                            isLightTheme ? 'text-slate-900' : 'text-slate-100'
                          }`}
                        >
                          {currentShiftWorkplace?.name || todayShift.workplace || 'Posto Presencial'}
                        </p>
                        <p
                          className="text-[11.5px] mt-0.5 font-semibold leading-snug"
                          style={{ color: isLightTheme ? '#334155' : '#cbd5e1' }}
                        >
                          {currentShiftWorkplace?.address || 'Endereço definido pelo gestor'}
                        </p>
                      </div>
                    </div>

                    {workplaceMapsUrl && (
                      <a
                        href={workplaceMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border shadow-xs cursor-pointer"
                        style={
                          isLightTheme
                            ? { backgroundColor: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }
                            : { backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#bae6fd', borderColor: 'rgba(14, 165, 233, 0.4)' }
                        }
                        title="Abrir rota no Google Maps"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Como Chegar (Google Maps)</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`text-xs py-1 flex items-center gap-2 font-bold ${
                    isLightTheme ? 'text-slate-700' : 'text-slate-300'
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
          <div className="shrink-0 lg:w-84">
            <div
              className={`rounded-3xl border overflow-hidden transition-all duration-300 shadow-xl ${
                isLightTheme
                  ? 'bg-white border-slate-200 shadow-slate-900/10'
                  : 'bg-[#151821] border-white/10 shadow-black/50'
              }`}
            >
              {/* Para Prestadores PJ: Timesheet em Tempo Real */}
              {employee.contractType === 'PJ' ? (
                <div className="p-5 space-y-3">
                  <PjTimesheetTracker 
                    employee={employee}
                    isDark={!isLightTheme}
                    compactMode={true}
                    onNavigateToFullView={onNavigateToPjReports}
                  />
                </div>
              ) : (
                <>
                  {/* Warm Gradient Header - Matches image reference */}
                  <div className="bg-gradient-to-r from-[#F89847] via-[#ea580c] to-[#96183c] p-4 sm:p-5 text-white flex items-center gap-3.5 shadow-sm">
                    <div className="w-11 h-11 rounded-full bg-amber-100 text-[#b43403] flex items-center justify-center shrink-0 shadow-md">
                      <Clock className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-white leading-tight">
                        {hasCheckedIn && hasCheckedOut
                          ? 'Jornada Concluída'
                          : hasCheckedIn
                          ? 'Expediente em Andamento'
                          : 'Aguardando Início'}
                      </h4>
                      <p className="text-xs text-white font-semibold mt-0.5 truncate">
                        {hasCheckedIn && hasCheckedOut
                          ? `Total trabalhado: ${calculateTodayWorkedHours() || '8h'}`
                          : hasCheckedIn
                          ? `Entrada às ${todayShift.checkInTime || '15:26'}`
                          : 'Registre sua entrada ao chegar'}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Feedback de Confirmação Digital */}
                    {checkInSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-[11px]">Ponto Registrado com Sucesso</p>
                          <p className="text-[10px] font-mono opacity-80">Protocolo #{Date.now().toString().slice(-6)} • Horário Oficial de Brasília</p>
                        </div>
                      </div>
                    )}

                    {hasCheckedIn && hasCheckedOut ? (
                      /* ESTADO 1: JORNADA COMPLETA */
                      <div className="space-y-3">
                        {/* Entrada */}
                        <div
                          className={`rounded-2xl p-3 border space-y-1 ${
                            isLightTheme
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-white/5 border-white/10 text-white/90'
                          }`}
                        >
                          <div className="flex items-center justify-between font-black text-xs">
                            <span
                              className="flex items-center gap-1.5 text-xs font-black"
                              style={{ color: isLightTheme ? '#064e3b' : '#6ee7b7' }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: '#10b981' }}
                              />
                              Entrada: {todayShift.checkInTime}
                            </span>
                            {isGpsValidDynamic ? (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#dcfce7', color: '#064e3b', borderColor: '#86efac' }
                                    : { backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)' }
                                }
                              >
                                GPS OK ({formatDistance(dynamicDistance)})
                              </span>
                            ) : (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }
                                    : { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.4)' }
                                }
                              >
                                Fora ({formatDistance(dynamicDistance)})
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: isLightTheme ? '#334155' : '#cbd5e1' }}
                          >
                            {todayShift.checkInLocation?.address || 'Localização Registrada'}
                          </p>
                        </div>

                        {/* Saída */}
                        <div
                          className={`rounded-2xl p-3 border space-y-1 ${
                            isLightTheme
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-white/5 border-white/10 text-white/90'
                          }`}
                        >
                          <div className="flex items-center justify-between font-black text-xs">
                            <span
                              className="flex items-center gap-1.5 text-xs font-black"
                              style={{ color: isLightTheme ? '#881337' : '#fda4af' }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: '#f43f5e' }}
                              />
                              Saída: {todayShift.checkOutTime}
                            </span>
                            {isGpsOutValidDynamic ? (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#dcfce7', color: '#064e3b', borderColor: '#86efac' }
                                    : { backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)' }
                                }
                              >
                                GPS OK ({formatDistance(dynamicOutDistance)})
                              </span>
                            ) : (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }
                                    : { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.4)' }
                                }
                              >
                                Fora ({formatDistance(dynamicOutDistance)})
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: isLightTheme ? '#334155' : '#cbd5e1' }}
                          >
                            {todayShift.checkOutLocation?.address || 'Localização Registrada'}
                          </p>
                        </div>

                        {/* Botão Meu Histórico de Batidas */}
                        <button
                          type="button"
                          onClick={() => setIsHistoryOpen(true)}
                          className={`w-full py-2.5 px-4 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                            isLightTheme
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                          }`}
                        >
                          <History className="w-4 h-4" />
                          <span>Meu Histórico de Batidas</span>
                        </button>
                      </div>
                    ) : hasCheckedIn ? (
                      /* ESTADO 2: ENTRADA JÁ REGISTRADA, SAÍDA PENDENTE */
                      <div className="space-y-3">
                        {/* Card Entrada Registrada com verde nítido e alto contraste */}
                        <div
                          className={`rounded-2xl p-3 border space-y-1 ${
                            isLightTheme
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-white/5 border-white/10 text-white/90'
                          }`}
                        >
                          <div className="flex items-center justify-between font-black text-xs">
                            <span
                              className="flex items-center gap-1.5 text-xs font-black"
                              style={{ color: isLightTheme ? '#064e3b' : '#6ee7b7' }}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: '#10b981' }}
                              />
                              Entrada: {todayShift.checkInTime || '15:26'}
                            </span>
                            {isGpsValidDynamic ? (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#dcfce7', color: '#064e3b', borderColor: '#86efac' }
                                    : { backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)' }
                                }
                              >
                                GPS OK ({formatDistance(dynamicDistance)})
                              </span>
                            ) : (
                              <span
                                className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs"
                                style={
                                  isLightTheme
                                    ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }
                                    : { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.4)' }
                                }
                              >
                                Fora ({formatDistance(dynamicDistance)})
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: isLightTheme ? '#334155' : '#cbd5e1' }}
                          >
                            {todayShift.checkInLocation?.address || 'Localização Registrada'}
                          </p>
                        </div>

                        {/* Botão Registrar Saída */}
                        <button
                          type="button"
                          onClick={() => handlePunchClock('saida')}
                          disabled={isCapturingGps}
                          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#96183c] to-[#b32047] hover:brightness-110 active:scale-[0.99] text-white font-black text-xs shadow-md shadow-[#96183c]/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Clock className="w-4 h-4 stroke-[2.5]" />
                          <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Saída'}</span>
                        </button>

                        {/* Mensagem de Erro de GPS amigável se a permissão for negada */}
                        {gpsError && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold text-left">
                            ⚠️ {gpsError}
                          </div>
                        )}

                        {/* Botão Meu Histórico de Batidas */}
                        <button
                          type="button"
                          onClick={() => setIsHistoryOpen(true)}
                          className={`w-full py-2.5 px-4 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isLightTheme
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                          }`}
                        >
                          <History className="w-4 h-4" />
                          <span>Meu Histórico de Batidas</span>
                        </button>
                      </div>
                    ) : (
                      /* ESTADO 3: ENTRADA PENDENTE (NENHUM PONTO BATIDO AINDA) */
                      <div className="space-y-3">
                        {isTemporaryWorker && (
                          <div className="text-left space-y-1 mb-2">
                            <label
                              className={`text-[10px] font-bold uppercase tracking-wider block ${
                                isLightTheme ? 'text-slate-700' : 'text-slate-300'
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
                                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-600'
                                  : 'bg-white/10 border-white/20 text-white focus:border-white/40'
                              }`}
                            />
                          </div>
                        )}

                        {/* Botão Registrar Entrada */}
                        <button
                          type="button"
                          onClick={() => handlePunchClock('entrada')}
                          disabled={isCapturingGps}
                          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#96183c] to-[#b32047] hover:brightness-110 active:scale-[0.99] text-white font-black text-xs shadow-md shadow-[#96183c]/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Clock className="w-4 h-4 stroke-[2.5]" />
                          <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Entrada'}</span>
                        </button>

                        {/* Mensagem de Erro de GPS amigável se a permissão for negada */}
                        {gpsError && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold text-left">
                            ⚠️ {gpsError}
                          </div>
                        )}

                        <p
                          className={`text-[11px] font-semibold text-center ${
                            isLightTheme ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          Início da jornada com geolocalização auditável
                        </p>

                        {/* Botão Meu Histórico de Batidas */}
                        <button
                          type="button"
                          onClick={() => setIsHistoryOpen(true)}
                          className={`w-full py-2.5 px-4 rounded-2xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isLightTheme
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                          }`}
                        >
                          <History className="w-4 h-4" />
                          <span>Meu Histórico de Batidas</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
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
            className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              isLightTheme ? 'bg-[#F8FAFC] border-slate-200 text-slate-900' : 'bg-[#12141c] border-white/10 text-white'
            }`}
          >
            {/* Header */}
            <div className={`px-6 py-4.5 border-b flex items-center justify-between ${
              isLightTheme ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#96183c] to-[#f89642] text-white flex items-center justify-center shadow-xs">
                  <History className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight">Meu Histórico de Batidas</h3>
                    {dbPunches && dbPunches.length > 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isLightTheme ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'
                      }`}>
                        {dbPunches.length} {dbPunches.length === 1 ? 'registro' : 'registros'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Extrato auditável de presenças e jornadas registradas com geolocalização</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-5 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
              {isLoadingPunches ? (
                <div className="text-center py-12 text-xs text-slate-400 font-medium space-y-2">
                  <div className="w-6 h-6 border-2 border-[#96183c] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Carregando registros de ponto do banco de dados...</p>
                </div>
              ) : dbPunches && dbPunches.length > 0 ? (
                dbPunches.map((punch: any, idx: number) => {
                  const dt = punch.Dta_Hora_Registro ? new Date(punch.Dta_Hora_Registro) : new Date();
                  const dateFormatted = !isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : todayStr;
                  const timeFormatted = !isNaN(dt.getTime()) ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                  const isEntrada = punch.Tpo_Registro?.toLowerCase() === 'entrada';
                  const isValid = punch.Flg_Gps_Validado !== false;

                  return (
                    <div
                      key={punch.Idf_Registro_Ponto || idx}
                      className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                        isLightTheme
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          : 'bg-white/[0.04] border-white/10 hover:border-white/15 shadow-sm'
                      }`}
                    >
                      {/* Top Row: ● Entrada: 14:24 (or Saída: 16:29), Date and GPS badge */}
                      <div className="flex items-center justify-between gap-2 font-black text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center gap-1.5 text-xs font-black"
                            style={{ color: isEntrada ? (isLightTheme ? '#064e3b' : '#6ee7b7') : (isLightTheme ? '#881337' : '#fda4af') }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: isEntrada ? '#10b981' : '#f43f5e' }}
                            />
                            {isEntrada ? 'Entrada:' : 'Saída:'} {timeFormatted}
                          </span>

                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono"
                            style={{
                              backgroundColor: isLightTheme ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                              color: isLightTheme ? '#475569' : '#cbd5e1',
                            }}
                          >
                            {dateFormatted}
                          </span>
                        </div>

                        <span
                          className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs shrink-0"
                          style={
                            isValid
                              ? isLightTheme
                                ? { backgroundColor: '#dcfce7', color: '#064e3b', borderColor: '#86efac' }
                                : { backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)' }
                              : isLightTheme
                                ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }
                                : { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.4)' }
                          }
                        >
                          {isValid ? 'GPS OK' : 'Fora do Raio'}
                        </span>
                      </div>

                      {/* Bottom Row: Address without emoji */}
                      <p
                        className="text-xs font-medium truncate mt-1.5 pl-4"
                        style={{ color: isLightTheme ? '#475569' : '#94a3b8' }}
                      >
                        {punch.Des_Endereco || 'Localização Registrada'}
                        {punch.Num_Latitude && punch.Num_Longitude && (
                          <span className="font-mono text-[10px] opacity-70 ml-2">
                            ({Number(punch.Num_Latitude).toFixed(4)}, {Number(punch.Num_Longitude).toFixed(4)})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })
              ) : empShifts.length > 0 ? (
                empShifts.map((shift) => {
                  const hasIn = Boolean(shift.checkInTime);
                  const hasOut = Boolean(shift.checkOutTime);
                  const isGpsOk = shift.checkInLocation?.gpsValidated !== false;
                  return (
                    <div
                      key={shift.id}
                      className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                        isLightTheme
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                          : 'bg-white/[0.04] border-white/10 hover:border-white/15 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-black text-xs">
                        <div className="flex items-center gap-3">
                          {hasIn && (
                            <span
                              className="flex items-center gap-1.5 text-xs font-black"
                              style={{ color: isLightTheme ? '#064e3b' : '#6ee7b7' }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#10b981' }} />
                              Entrada: {shift.checkInTime}
                            </span>
                          )}
                          {hasOut && (
                            <span
                              className="flex items-center gap-1.5 text-xs font-black"
                              style={{ color: isLightTheme ? '#881337' : '#fda4af' }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: '#f43f5e' }} />
                              Saída: {shift.checkOutTime}
                            </span>
                          )}
                          {!hasIn && !hasOut && (
                            <span className="text-xs font-semibold text-slate-500">
                              Turno: {shift.startTime} – {shift.endTime}
                            </span>
                          )}
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono"
                            style={{
                              backgroundColor: isLightTheme ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                              color: isLightTheme ? '#475569' : '#cbd5e1',
                            }}
                          >
                            {shift.date.split('-').reverse().join('/')}
                          </span>
                        </div>

                        <span
                          className="text-[11px] px-2.5 py-0.5 rounded-full font-black border shadow-xs shrink-0"
                          style={
                            isGpsOk
                              ? isLightTheme
                                ? { backgroundColor: '#dcfce7', color: '#064e3b', borderColor: '#86efac' }
                                : { backgroundColor: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', borderColor: 'rgba(16, 185, 129, 0.4)' }
                              : isLightTheme
                                ? { backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }
                                : { backgroundColor: 'rgba(245, 158, 11, 0.25)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.4)' }
                          }
                        >
                          {hasIn ? (isGpsOk ? 'GPS OK' : 'Fora do Raio') : 'Agendado'}
                        </span>
                      </div>

                      <p
                        className="text-xs font-medium truncate mt-1.5 pl-4"
                        style={{ color: isLightTheme ? '#475569' : '#94a3b8' }}
                      >
                        {shift.checkInLocation?.address || shift.workplace || 'Posto Presencial'}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-xs text-slate-400 font-medium">
                  Nenhum registro de ponto localizado ainda. Registre sua entrada para visualizar seu histórico.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-6 py-3.5 border-t flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 ${
              isLightTheme ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'
            }`}>
              <span className="text-[11.5px] font-medium">Conforme Portaria MTP 671/2021 • Registro Digital Seguro</span>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white/15 dark:hover:bg-white/25 font-bold text-xs transition-all cursor-pointer shadow-xs"
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