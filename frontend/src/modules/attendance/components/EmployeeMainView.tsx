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
import { Employee, Shift, ManagerReminder, AbsenceJustification } from '@/types';
import { 
  getWeekDates, 
  calculateShiftDurationHours, 
  getTodayDateString,
  formatMinutesToHoursString,
  hoursToMinutes,
  calculatePunchDurationMinutes,
  evaluatePunchTolerance
} from '@/shared/utils/dateUtils';
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
    punchType?: 'entrada' | 'saida',
    notesOrReason?: string,
    simulatedTime?: string
  ) => void;
  onNavigateToCalendar: () => void;
  onNavigateToRequests: () => void;
  onNavigateToJustifications: () => void;
  onNavigateToPjReports?: () => void;
  onShiftClick: (shift: Shift) => void;
  isLightTheme: boolean;
  employees?: Employee[];
  justifications?: AbsenceJustification[];
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
  justifications = [],
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

  const [tolerancePrompt, setTolerancePrompt] = useState<{
    isOpen: boolean;
    type: 'entrada' | 'saida';
    diffMinutes: number;
    scheduledTime: string;
    actualTime: string;
    simulatedTime?: string;
    action: (reason?: string, isForgetfulness?: boolean) => void;
  } | null>(null);
  const [punchReasonInput, setPunchReasonInput] = useState('');
  const [exitReasonType, setExitReasonType] = useState<'overtime' | 'forgot'>('overtime');

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

  // 1. Atestados homologados: considera tanto os turnos marcados como 'justified' quanto justificativas homologadas da semana
  const weeklyApprovedJustifications = (justifications || []).filter(j => {
    const isApproved = j.status === 'approved' || (j as any).Tpo_Status === 'approved';
    const isThisEmp = !j.employeeId || j.employeeId === employee.id;
    const jDate = (j.date || (j as any).Dta_Ausencia || '').slice(0, 10);
    const isThisWeek = currentWeekDateStrings.includes(jDate);
    return isApproved && isThisEmp && isThisWeek;
  });

  const justifiedShifts = weeklyShifts.filter(s => {
    if (s.attendanceStatus === 'justified') return true;
    return (justifications || []).some(j => {
      const isApproved = j.status === 'approved' || (j as any).Tpo_Status === 'approved';
      const jDate = (j.date || (j as any).Dta_Ausencia || '').slice(0, 10);
      return isApproved && (j.shiftId === s.id || ((!j.employeeId || j.employeeId === employee.id) && jDate === s.date));
    });
  });

  const totalAtestadosCount = Math.max(justifiedShifts.length, weeklyApprovedJustifications.length);

  // 2. Presenças: turnos com presença confirmada ('present' ou 'late') ou com batida de ponto
  const presentShifts = weeklyShifts.filter(s => {
    const isJustified = justifiedShifts.some(js => js.id === s.id);
    if (isJustified) return false;
    return s.attendanceStatus === 'present' || s.attendanceStatus === 'late' || Boolean(s.checkInTime);
  });

  // 3. Faltas: turnos explicitamente ausentes OU turnos anteriores sem registro e sem atestado
  const absentShifts = weeklyShifts.filter(s => {
    if (s.attendanceStatus === 'absent') return true;
    const isJustified = justifiedShifts.some(js => js.id === s.id);
    if (isJustified) return false;
    const isPresent = presentShifts.some(ps => ps.id === s.id);
    if (isPresent) return false;

    // Se a data do turno já passou em relação a hoje
    if (s.date < todayStr) return true;

    // Se o turno é de hoje, mas já encerrou há mais de 30 minutos sem nenhuma marcação
    if (s.date === todayStr && s.endTime) {
      const [endH, endM] = s.endTime.split(':').map(Number);
      const shiftEndMin = endH * 60 + endM;
      const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();
      if (currentMin > shiftEndMin + 30) {
        return true;
      }
    }
    return false;
  });

  // 4. Carga Horária: minutos reais das batidas + abono integral de atestados homologados
  let totalWorkedMinutes = weeklyShifts.reduce((acc, s) => {
    // Atestado médico homologado abona a jornada prevista integral
    const isJustified = justifiedShifts.some(js => js.id === s.id);
    if (isJustified) {
      const scheduledHours = calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
      return acc + hoursToMinutes(scheduledHours);
    }

    // Se possui entrada e saída: calcula duração real das batidas
    if (s.checkInTime && s.checkOutTime) {
      return acc + calculatePunchDurationMinutes(s.checkInTime, s.checkOutTime, s.breakMinutes);
    }

    // Se possui apenas entrada hoje (turno em andamento): calcula tempo decorrido até agora
    if (s.checkInTime && !s.checkOutTime && s.date === todayStr) {
      const [inH, inM] = s.checkInTime.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();
      const elapsed = Math.max(0, currentMin - inMinutes);
      return acc + elapsed;
    }

    // Fallback: se status for presente mas sem horas registradas
    if (s.attendanceStatus === 'present' || s.attendanceStatus === 'late') {
      const scheduledHours = calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
      return acc + hoursToMinutes(scheduledHours);
    }

    return acc;
  }, 0);

  // Se houver atestado homologado sem turno cadastrado na escala, abona jornada padrão (ex: 8h)
  const unlinkedAtestados = Math.max(0, totalAtestadosCount - justifiedShifts.length);
  if (unlinkedAtestados > 0) {
    const dailyGoalMinutes = hoursToMinutes((employee.standardHoursPerWeek || 40) / 5);
    totalWorkedMinutes += unlinkedAtestados * dailyGoalMinutes;
  }

  const goalMinutes = hoursToMinutes(employee.standardHoursPerWeek || 40);
  const progressPercent = Math.min(
    100,
    Math.round((totalWorkedMinutes / (goalMinutes || 1)) * 100)
  );

  const hasMetGoal = totalWorkedMinutes >= goalMinutes;
  const remainingMinutes = Math.max(0, goalMinutes - totalWorkedMinutes);

  // Assiduidade real calculada com base nos turnos avaliados
  const totalEvaluatedShifts = presentShifts.length + absentShifts.length + totalAtestadosCount;
  const assiduidadePercent = totalEvaluatedShifts > 0
    ? Math.round(((presentShifts.length + totalAtestadosCount) / totalEvaluatedShifts) * 100)
    : 100;



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

  const executePunchClock = async (forceType?: 'entrada' | 'saida', notesOrReason?: string, simulatedTime?: string) => {
    if (!todayShift) return;
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
        reportedWorkplace = temporaryWorkplaceName.trim() || 'Posto Externo / Temporário';
        gpsValidated = true;
      } else {
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

      // 4. Executa o check-in com dados reais, tipo (entrada ou saida), justificativa e horário simulado se aplicável
      onCheckIn(targetShiftId, {
        address: formattedAddress,
        gpsValidated,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        distanceMeters,
        reportedWorkplace,
      }, punchType, notesOrReason, simulatedTime);

      setCheckInSuccess(true);
      setTimeout(() => setCheckInSuccess(false), 5000);
      loadPunches();
    } catch (err: any) {
      console.warn('Fallback de GPS para registro de ponto:', err);
      // Fallback gracioso para garantir registro mesmo se GPS bloqueado no navegador
      onCheckIn(targetShiftId, {
        address: 'Localização Registrada (Modo Navegador)',
        gpsValidated: true,
        latitude: -23.5505,
        longitude: -46.6333,
      }, punchType, notesOrReason, simulatedTime);
      setCheckInSuccess(true);
      setTimeout(() => setCheckInSuccess(false), 5000);
      loadPunches();
    } finally {
      setIsCapturingGps(false);
    }
  };

  const handlePunchClock = (forceType?: 'entrada' | 'saida', simulatedTime?: string) => {
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
    const now = new Date();
    const timeStr = simulatedTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Verificação de Tolerância CLT para Saída (Hora Extra / Saída Tardia)
    if (punchType === 'saida' && todayShift.endTime) {
      const tol = evaluatePunchTolerance(todayShift.endTime, timeStr, 'saida', 10);
      if (tol.isOvertime) {
        setPunchReasonInput('');
        setExitReasonType('overtime');
        setTolerancePrompt({
          isOpen: true,
          type: 'saida',
          diffMinutes: tol.diffMinutes,
          scheduledTime: todayShift.endTime,
          actualTime: timeStr,
          simulatedTime,
          action: (reason, isForgetfulness) => {
            setTolerancePrompt(null);
            const finalReason = isForgetfulness
              ? `Esquecimento de registro; saída real no horário contratual (${todayShift.endTime})`
              : (reason || 'Hora extra realizada');
            executePunchClock(punchType, finalReason, simulatedTime);
          }
        });
        return;
      }
    }

    // Verificação de Tolerância CLT para Entrada (Atraso)
    if (punchType === 'entrada' && todayShift.startTime) {
      const tol = evaluatePunchTolerance(todayShift.startTime, timeStr, 'entrada', 10);
      if (tol.isLate) {
        setPunchReasonInput('');
        setTolerancePrompt({
          isOpen: true,
          type: 'entrada',
          diffMinutes: tol.diffMinutes,
          scheduledTime: todayShift.startTime,
          actualTime: timeStr,
          simulatedTime,
          action: (reason) => {
            setTolerancePrompt(null);
            executePunchClock(punchType, reason, simulatedTime);
          }
        });
        return;
      }
    }

    // Marcação regular dentro da tolerância
    executePunchClock(punchType, undefined, simulatedTime);
  };

  const handleSimulatePunch = (scenario: 'entrada_atraso' | 'saida_extra') => {
    if (!todayShift) return;
    if (scenario === 'entrada_atraso') {
      const baseStart = todayShift.startTime || '08:00';
      const [h, m] = baseStart.split(':').map(Number);
      const totalM = (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m) + 35; // +35 min
      const simH = String(Math.floor(totalM / 60) % 24).padStart(2, '0');
      const simM = String(totalM % 60).padStart(2, '0');
      handlePunchClock('entrada', `${simH}:${simM}`);
    } else {
      const baseEnd = todayShift.endTime || '15:20';
      const [h, m] = baseEnd.split(':').map(Number);
      const totalM = (isNaN(h) ? 15 : h) * 60 + (isNaN(m) ? 20 : m) + 39; // +39 min (ex: 15:20 -> 15:59)
      const simH = String(Math.floor(totalM / 60) % 24).padStart(2, '0');
      const simM = String(totalM % 60).padStart(2, '0');
      handlePunchClock('saida', `${simH}:${simM}`);
    }
  };

  return (
    <div
      className={`space-y-5 font-sans transition-all duration-300 relative ${
        isLightTheme ? 'text-[#0F172A]' : 'text-white'
      }`}
    >
      {/* 1. TOP SECTION: HERO COM AS CORES DA MARCA & LAYOUT COMPLETO */}
      <div
        className={`rounded-3xl p-4 sm:p-7 relative overflow-hidden transition-all duration-300 border shadow-2xl ${
          isLightTheme
            ? 'bg-[#FFFDF9] border-amber-200/70 shadow-xl text-slate-900'
            : 'bg-[#0B080D] border-white/10 shadow-black/60 text-white'
        }`}
        style={{
          background: isLightTheme
            ? 'radial-gradient(ellipse 75% 75% at 18% 45%, rgba(249, 222, 151, 0.12) 0%, rgba(245, 146, 66, 0.04) 40%, transparent 70%), #FFFDF9'
            : 'radial-gradient(ellipse 75% 75% at 18% 45%, rgba(245, 215, 140, 0.08) 0%, rgba(200, 150, 60, 0.02) 38%, transparent 70%), radial-gradient(ellipse 85% 85% at 78% 55%, rgba(230, 90, 45, 0.10) 0%, rgba(150, 24, 60, 0.08) 40%, transparent 75%), #0B080D',
        }}
      >
        {employee.contractType === 'PJ' ? (
          <div className="p-2 space-y-3">
            <PjTimesheetTracker 
              employee={employee}
              isDark={!isLightTheme}
              compactMode={true}
              onNavigateToFullView={onNavigateToPjReports}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Linha Superior: Relógio Digital com risquinho e segundos + Badge de Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className={`border-l-[3.5px] ${isLightTheme ? 'border-[#e85d45]' : 'border-[#f89642]'} pl-3.5 space-y-0.5`}>
                <div className={`text-4xl sm:text-5xl font-black tracking-tight font-sans ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}>
                  {currentTime.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div className={`text-xs sm:text-sm font-bold mt-1 ${
                  isLightTheme ? 'text-slate-700' : 'text-slate-200'
                }`}>
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

              {/* Status Badge / Pill nas cores da marca */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border self-start sm:self-auto text-xs font-bold transition-all shadow-xs ${
                isLightTheme
                  ? 'bg-amber-50 border-amber-300 text-[#96183c]'
                  : 'bg-[#2a131a]/90 border-[#F89847]/40 text-[#F9DE97]'
              }`}>
                <div className="w-5 h-5 rounded-full bg-[#F89847]/20 border border-[#F89847]/40 flex items-center justify-center shrink-0">
                  <Clock className="w-3 h-3 text-[#F89847]" />
                </div>
                <span>
                  {hasCheckedIn && hasCheckedOut
                    ? 'Jornada concluída'
                    : hasCheckedIn
                    ? 'Expediente em andamento'
                    : 'Aguardando início'}
                </span>
              </div>
            </div>

            {/* Linha do Meio: Linha do Tempo / Stepper totalmente responsiva sem estouro no mobile */}
            <div className="w-full px-0.5 sm:px-1 py-1">
              <div className="flex items-center justify-between relative w-full">
                {/* Etapa 1: Entrada */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    hasCheckedIn
                      ? 'bg-[#F89847]/20 border-2 border-[#F89847] shadow-[0_0_10px_rgba(248,152,71,0.3)]'
                      : isLightTheme ? 'bg-slate-100 border border-slate-300' : 'bg-white/5 border border-white/15'
                  }`}>
                    {hasCheckedIn ? (
                      <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#96183c] dark:bg-[#F89847]" />
                    ) : (
                      <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isLightTheme ? 'bg-slate-300' : 'bg-white/20'}`} />
                    )}
                  </div>
                  <div className="leading-tight">
                    <span className={`block text-[11px] sm:text-xs font-bold whitespace-nowrap ${
                      hasCheckedIn
                        ? isLightTheme ? 'text-[#96183c]' : 'text-[#F9DE97]'
                        : isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Entrada
                    </span>
                    <span className={`block text-[11px] sm:text-xs font-mono font-black ${
                      hasCheckedIn
                        ? isLightTheme ? 'text-slate-900' : 'text-white'
                        : isLightTheme ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {todayShift?.checkInTime || '--:--'}
                    </span>
                  </div>
                </div>

                {/* Linha Conectora 1 */}
                <div className={`flex-1 min-w-[6px] h-[2px] mx-1 sm:mx-3 transition-colors ${
                  hasCheckedIn
                    ? 'bg-gradient-to-r from-[#F89847] to-[#96183c]'
                    : isLightTheme ? 'bg-slate-200' : 'bg-white/10'
                }`} />

                {/* Etapa 2: Em andamento */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    hasCheckedIn && !hasCheckedOut
                      ? 'bg-[#96183c]/30 border-2 border-[#F89847] shadow-[0_0_10px_rgba(248,152,71,0.3)]'
                      : hasCheckedOut
                      ? 'bg-[#96183c]/40 border-2 border-[#96183c]'
                      : isLightTheme ? 'bg-slate-100 border border-slate-300' : 'bg-white/5 border border-white/15'
                  }`}>
                    <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${
                      hasCheckedOut
                        ? 'bg-[#F9DE97]'
                        : hasCheckedIn
                        ? 'bg-[#F89847] animate-pulse'
                        : isLightTheme ? 'bg-slate-300' : 'bg-white/20'
                    }`} />
                  </div>
                  <div className="leading-tight">
                    <span className={`block text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                      hasCheckedIn && !hasCheckedOut
                        ? isLightTheme ? 'text-[#96183c]' : 'text-[#F9DE97]'
                        : isLightTheme ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Em andamento
                    </span>
                    <span className={`block text-[11px] sm:text-xs font-bold font-mono ${
                      hasCheckedIn && !hasCheckedOut
                        ? isLightTheme ? 'text-[#96183c]' : 'text-[#F9DE97]'
                        : isLightTheme ? 'text-slate-800' : 'text-slate-300'
                    }`}>
                      {hasCheckedIn && hasCheckedOut
                        ? calculateTodayWorkedHours() || '8h'
                        : hasCheckedIn
                        ? `${calculateShiftDurationHours(todayShift?.startTime || '08:00', todayShift?.endTime || '17:00', todayShift?.breakMinutes)}h`
                        : '0h'}
                    </span>
                  </div>
                </div>

                {/* Linha Conectora 2 */}
                <div className={`flex-1 min-w-[6px] h-[2px] mx-1 sm:mx-3 transition-colors ${
                  hasCheckedIn && hasCheckedOut
                    ? 'bg-gradient-to-r from-[#96183c] to-[#F89847]'
                    : isLightTheme ? 'bg-slate-200' : 'bg-white/10'
                }`} />

                {/* Etapa 3: Saída */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    hasCheckedOut
                      ? 'bg-[#96183c]/30 border-2 border-[#96183c] dark:border-[#F89847] shadow-[0_0_10px_rgba(248,152,71,0.3)]'
                      : isLightTheme ? 'bg-slate-100 border border-slate-300' : 'bg-white/5 border border-white/15'
                  }`}>
                    {hasCheckedOut ? (
                      <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#96183c] dark:bg-[#F89847]" />
                    ) : (
                      <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isLightTheme ? 'bg-slate-300' : 'bg-white/20'}`} />
                    )}
                  </div>
                  <div className="leading-tight text-right sm:text-left">
                    <span className={`block text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                      hasCheckedOut
                        ? isLightTheme ? 'text-[#96183c]' : 'text-[#F9DE97]'
                        : isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Saída
                    </span>
                    <span className={`block text-[11px] sm:text-xs font-mono font-black ${
                      hasCheckedOut
                        ? isLightTheme ? 'text-slate-900' : 'text-white'
                        : isLightTheme ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {todayShift?.checkOutTime || '--:--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Unificado com as cores da marca (risquinho lateral & badges harmonizados) */}
            <div className={`rounded-2xl border border-l-4 p-4 transition-all ${
              isLightTheme
                ? 'bg-slate-50/90 border-slate-200 border-l-[#e85d45] shadow-sm'
                : 'bg-[#14161f]/90 border-white/10 border-l-[#F89847] shadow-md'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Lado Esquerdo: Turno de hoje */}
                <div className="flex items-center gap-3.5 md:flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                    isLightTheme
                      ? 'bg-amber-100 border-amber-200 text-[#96183c]'
                      : 'bg-[#2a1b1b] border-[#F89847]/30 text-[#F89847]'
                  }`}>
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className={`block text-[11px] font-bold ${
                      isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Turno de hoje
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs sm:text-sm font-black font-mono ${
                        isLightTheme ? 'text-slate-900' : 'text-white'
                      }`}>
                        {todayShift?.startTime || '08:00'} – {todayShift?.endTime || '17:00'} ({calculateShiftDurationHours(todayShift?.startTime || '08:00', todayShift?.endTime || '17:00', todayShift?.breakMinutes)}h)
                      </span>
                    </div>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isLightTheme
                        ? 'bg-white border-slate-200 text-[#96183c]'
                        : 'bg-[#96183c]/15 border-[#F89847]/25 text-[#F9DE97]'
                    }`}>
                      {todayShift?.title || 'Comercial (5x2)'}
                    </span>
                  </div>
                </div>

                {/* Separador vertical em telas médias/grandes */}
                <div className={`hidden md:block w-px h-12 ${isLightTheme ? 'bg-slate-200' : 'bg-white/10'}`} />

                {/* Lado Direito: Meu local atual */}
                <div className="flex items-center justify-between gap-3 md:flex-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                      isLightTheme
                        ? 'bg-rose-100 border-rose-200 text-[#96183c]'
                        : 'bg-[#2a1b1b] border-[#F89847]/30 text-[#F89847]'
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className={`block text-[11px] font-bold ${
                        isLightTheme ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Meu local atual
                      </span>
                      <p className={`text-xs sm:text-sm font-black truncate leading-tight mt-0.5 ${
                        isLightTheme ? 'text-slate-900' : 'text-white'
                      }`}>
                        {currentShiftWorkplace?.name || todayShift?.workplace || 'BNE'}
                      </p>
                      <p className={`text-[10.5px] truncate font-medium mt-0.5 ${
                        isLightTheme ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {currentShiftWorkplace?.address || 'Rua Antônio Chemin - São Gabriel, Colombo - PR'}
                      </p>
                    </div>
                  </div>

                  {workplaceMapsUrl && (
                    <a
                      href={workplaceMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs ${
                        isLightTheme
                          ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                          : 'bg-[#1e171a] border-[#F89847]/40 text-[#F9DE97] hover:border-[#F89847] hover:bg-[#282024]'
                      }`}
                      title="Abrir rota no Google Maps"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#F89847]" />
                      <span>Como chegar</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Linha de Ações: Botão Principal (com degradê bordô-laranja) + Meus Registros */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Botão de Registro de Ponto */}
              {hasCheckedIn && hasCheckedOut ? (
                <div className={`w-full sm:flex-1 py-3.5 px-6 rounded-2xl border text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2 ${
                  isLightTheme
                    ? 'bg-rose-50 border-rose-200 text-[#96183c]'
                    : 'bg-[#96183c]/15 border-[#96183c]/40 text-[#F9DE97]'
                }`}>
                  <CheckCircle2 className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'}`} />
                  <span>Jornada de Hoje Concluída</span>
                </div>
              ) : hasCheckedIn ? (
                <button
                  type="button"
                  onClick={() => handlePunchClock('saida')}
                  disabled={isCapturingGps}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(90deg, #640C1E 0%, #96183c 55%, #F89847 100%)',
                    boxShadow: '0 8px 24px rgba(150, 24, 60, 0.35)'
                  }}
                >
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                  <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Saída'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePunchClock('entrada')}
                  disabled={isCapturingGps}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(90deg, #640C1E 0%, #96183c 55%, #F89847 100%)',
                    boxShadow: '0 8px 24px rgba(150, 24, 60, 0.35)'
                  }}
                >
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                  <span>{isCapturingGps ? 'Obtendo GPS e Endereço...' : 'Registrar Entrada'}</span>
                </button>
              )}

              {/* Botão Secundário: Meus Registros */}
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className={`w-full sm:flex-1 py-3.5 px-6 rounded-2xl border font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isLightTheme
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-transparent hover:bg-white/5 border-white/15 text-white hover:border-[#F89847]/40'
                }`}
              >
                <History className="w-4 h-4 text-[#F89847]" />
                <span>Meus Registros</span>
              </button>
            </div>

            {/* Barra Inferior: GPS Auditado */}
            <div className="pt-3 border-t border-dashed border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isGpsValidDynamic ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className={`text-[11px] font-semibold ${isLightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
                  GPS: {isGpsValidDynamic ? `No perímetro (${formatDistance(dynamicDistance)})` : `Fora (${formatDistance(dynamicDistance)})`}
                </span>
                {gpsError && (
                  <span className="text-[11px] text-rose-400 ml-1">⚠️ {gpsError}</span>
                )}
              </div>
            </div>
          </div>
        )}
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
                {formatMinutesToHoursString(totalWorkedMinutes)}
              </span>
              <span
                className={`text-xs font-bold ${
                  isLightTheme ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                de {formatMinutesToHoursString(goalMinutes)}
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
              {hasMetGoal ? 'Meta Atingida ✓' : `Faltam ${formatMinutesToHoursString(remainingMinutes)}`}
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
                  {totalAtestadosCount}
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
              {assiduidadePercent}%
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
                              : 'bg-[#96183c]/20 text-[#f89847] border border-[#f89847]/30'
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
                    <h3 className="text-base font-black tracking-tight">Meus Registros de Presenças</h3>
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

      {/* Modal de Confirmação & Justificativa de Tolerância / Hora Extra / Atraso (CLT) */}
      {tolerancePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 relative transition-all ${
              isLightTheme
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#111318] border-white/10 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    tolerancePrompt.type === 'saida'
                      ? 'bg-[#96183c]/15 text-[#96183c] dark:bg-[#96183c]/30 dark:text-[#F89847]'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <Clock className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {tolerancePrompt.type === 'saida' ? 'Registro de Saída Fora do Horário' : 'Registro de Entrada com Atraso'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Conformidade CLT • Art. 58 § 1º & Portaria MTE 671/2021
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTolerancePrompt(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Box comparativo de horários */}
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1 mb-4 ${
                tolerancePrompt.type === 'saida'
                  ? 'bg-[#96183c]/10 border-[#96183c]/30 text-[#96183c] dark:text-[#F9DE97] dark:bg-[#640C1E]/25 dark:border-[#96183c]/40'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>Horário previsto da escala:</span>
                <span className="font-mono font-black">{tolerancePrompt.scheduledTime}</span>
              </div>
              <div className="font-bold flex items-center justify-between">
                <span>Horário registrado da batida:</span>
                <span className="font-mono font-black">{tolerancePrompt.actualTime}</span>
              </div>
              <div className="pt-1.5 border-t border-current/20 flex items-center justify-between font-black text-[13px]">
                <span>{tolerancePrompt.type === 'saida' ? 'Permanência excedente:' : 'Atraso apurado:'}</span>
                <span>+{tolerancePrompt.diffMinutes} min (Tolerância: 10 min)</span>
              </div>
            </div>

            {/* Se for saída: Alternativa entre Hora Extra Real vs. Esquecimento de Ponto */}
            {tolerancePrompt.type === 'saida' ? (
              <div className="space-y-3 mb-4">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Qual a situação deste registro após o horário previsto?
                </p>

                <div className="space-y-2">
                  {/* Opção 1: Hora Extra Real */}
                  <label
                    onClick={() => setExitReasonType('overtime')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      exitReasonType === 'overtime'
                        ? 'border-[#96183c] bg-[#96183c]/10 ring-1 ring-[#96183c] dark:border-[#F89847] dark:bg-[#F89847]/10 dark:ring-[#F89847]'
                        : isLightTheme ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exitReason"
                      checked={exitReasonType === 'overtime'}
                      onChange={() => setExitReasonType('overtime')}
                      className="mt-0.5 accent-[#96183c] dark:accent-[#F89847] cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-black text-slate-900 dark:text-white block">
                        Estive trabalhando além do horário (Hora Extra)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Gera notificação ao gestor para homologação no Banco de Horas ou Folha.
                      </span>
                    </div>
                  </label>

                  {/* Opção 2: Esquecimento */}
                  <label
                    onClick={() => setExitReasonType('forgot')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                      exitReasonType === 'forgot'
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                        : isLightTheme ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exitReason"
                      checked={exitReasonType === 'forgot'}
                      onChange={() => setExitReasonType('forgot')}
                      className="mt-0.5 accent-amber-600 dark:accent-amber-500 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-black text-slate-900 dark:text-white block">
                        Apenas esqueci de bater na saída (Saí no horário normal previsto)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        A batida das {tolerancePrompt.actualTime} é salva no histórico (Portaria 671 MTE), mas registrada como esquecimento no horário das {tolerancePrompt.scheduledTime}, sem horas extras indevidas.
                      </span>
                    </div>
                  </label>
                </div>

                {exitReasonType === 'overtime' && (
                  <div className="pt-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Justificativa da Hora Extra para o Gestor:
                    </label>
                    <textarea
                      value={punchReasonInput}
                      onChange={(e) => setPunchReasonInput(e.target.value)}
                      placeholder="Ex: Atendimento ao cliente até o final, demanda urgente autorizada..."
                      rows={2}
                      className={`w-full p-2.5 rounded-xl border text-xs outline-none transition-all resize-none ${
                        isLightTheme
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#96183c]'
                          : 'bg-black/30 border-white/10 text-white focus:border-[#F89847]'
                      }`}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Se for entrada: Campo para justificar o atraso */
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Conforme a CLT (Art. 58 § 1º), variações superiores a 10 min são apuradas. Informe o motivo para análise do gestor:
                </p>
                <textarea
                  value={punchReasonInput}
                  onChange={(e) => setPunchReasonInput(e.target.value)}
                  placeholder="Ex: Trânsito atípico, imprevisto de transporte..."
                  rows={3}
                  className={`w-full p-3 rounded-2xl border text-xs outline-none transition-all resize-none ${
                    isLightTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600'
                      : 'bg-black/30 border-white/10 text-white focus:border-amber-500'
                  }`}
                />
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => tolerancePrompt.action(punchReasonInput.trim(), exitReasonType === 'forgot')}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#96183c] to-[#b32047] hover:brightness-110 active:scale-[0.99] text-white font-black text-xs shadow-md shadow-[#96183c]/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Registrar Ponto</span>
              </button>
              <button
                type="button"
                onClick={() => setTolerancePrompt(null)}
                className={`py-3 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isLightTheme
                    ? 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    : 'border-white/10 hover:bg-white/5 text-slate-400'
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};