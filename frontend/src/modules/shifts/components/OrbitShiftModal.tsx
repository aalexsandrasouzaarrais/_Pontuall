import { getTodayDateString } from '@/shared/utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Pencil, 
  Bell, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  ExternalLink, 
  Tag, 
  Layers, 
  ShieldCheck, 
  ShieldAlert,
  Building2, 
  Sparkles,
  ArrowLeft,
  Palette,
  Check,
  Info,
  MapPin,
  Plus,
  Navigation,
  Search,
  Loader2,
  Compass,
  Trash2
} from 'lucide-react';
import { Employee, Shift, ShiftType, AttendanceStatus, ShiftStatus, ShiftColor, TimeOffRequest, AbsenceJustification } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';
import {
  findShiftOverlapConflict,
  checkTimeOffConflict,
  checkInterjornadaRest,
  ShiftConflictResult,
  AbsenceConflictResult,
  InterjornadaResult
} from '@/shared/utils/shiftValidation';
import { getStoredWorkplaces, createWorkplaceFromAddress, deleteWorkplace, WorkplaceLocation } from '@/shared/services/workplaceService';
import { getSchedulableEmployees } from '@/shared/utils/employeeUtils';
import { 
  searchAddressSuggestions, 
  AddressSuggestion, 
  getCurrentCoordinates, 
  reverseGeocode 
} from '@/shared/utils/geolocation';
import { DraggableMapPicker } from '@/shared/components/DraggableMapPicker';

export const ORBIT_COLORS: ShiftColor[] = [
  { 
    label: "Coral / Vinho", 
    bg: "#63172a", 
    border: "#8f253f", 
    text: "#ffffff",
    category: "Operacional / Presencial",
    description: "Turnos padrão de rotina diária e atividades presenciais regulares da equipe."
  },
  { 
    label: "Âmbar / Laranja", 
    bg: "#543015", 
    border: "#7c471f", 
    text: "#ffffff",
    category: "Plantão / Sobreaviso",
    description: "Plantões, escalas 12x36, turnos de sobreaviso ou cobertura em fins de semana."
  },
  { 
    label: "Esmeralda", 
    bg: "#163a2a", 
    border: "#235840", 
    text: "#ffffff",
    category: "Home Office / Remoto",
    description: "Jornadas cumpridas em teletrabalho, regime híbrido ou expediente à distância."
  },
  { 
    label: "Azul Oceano", 
    bg: "#18324a", 
    border: "#284e72", 
    text: "#ffffff",
    category: "Treinamento / Onboarding",
    description: "Capacitações técnicas, cursos de integração de novos membros ou workshops."
  },
  { 
    label: "Violeta / Roxo", 
    bg: "#3a2250", 
    border: "#563476", 
    text: "#ffffff",
    category: "Reunião / Alinhamento",
    description: "Reuniões de alinhamento estratégico, sprint review, comitês e reuniões 1-on-1."
  },
  { 
    label: "Rosa Magenta", 
    bg: "#501d33", 
    border: "#732c4b", 
    text: "#ffffff",
    category: "Evento",
    description: "Eventos institucionais, convenções da empresa, celebrações ou missões pontuais."
  },
];

export const SHIFT_TYPES = [
  "Presencial",
  "Home Office",
  "Reunião / Alinhamento",
  "Plantão",
  "Treinamento",
  "Evento",
  "Outro",
];

export const getColorForShiftType = (type: string): ShiftColor => {
  const lower = type.toLowerCase();
  if (lower.includes('home office') || lower.includes('remoto')) {
    return ORBIT_COLORS[2]; // Esmeralda (Home Office / Remoto)
  }
  if (lower.includes('presencial') || lower.includes('operacional')) {
    return ORBIT_COLORS[0]; // Coral / Vinho (Operacional / Presencial)
  }
  if (lower.includes('reunião') || lower.includes('alinhamento') || lower.includes('meeting')) {
    return ORBIT_COLORS[4]; // Violeta / Roxo (Reunião / Alinhamento)
  }
  if (lower.includes('plantão') || lower.includes('sobreaviso')) {
    return ORBIT_COLORS[1]; // Âmbar / Laranja (Plantão / Sobreaviso)
  }
  if (lower.includes('treinamento') || lower.includes('onboarding')) {
    return ORBIT_COLORS[3]; // Azul Oceano (Treinamento / Onboarding)
  }
  if (lower.includes('evento') || lower.includes('extraordinário')) {
    return ORBIT_COLORS[5]; // Rosa Magenta (Evento)
  }
  return ORBIT_COLORS[0];
};

export const getTypeForColor = (color: ShiftColor): string | null => {
  if (color.label === "Coral / Vinho" || color.category?.includes("Presencial")) return "Presencial";
  if (color.label === "Esmeralda" || color.category?.includes("Home Office")) return "Home Office";
  if (color.label === "Violeta / Roxo" || color.category?.includes("Reunião") || color.category?.includes("Alinhamento")) return "Reunião / Alinhamento";
  if (color.label === "Âmbar / Laranja" || color.category?.includes("Plantão")) return "Plantão";
  if (color.label === "Azul Oceano" || color.category?.includes("Treinamento")) return "Treinamento";
  if (color.label === "Rosa Magenta" || color.category?.includes("Evento")) return "Evento";
  return null;
};

export const BREAK_OPTIONS = ["30min", "45min", "1h", "1h30", "2h", "Sem intervalo"];

function calcHours(start: string, end: string, breakTime: string): string {
  try {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let totalMins = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMins < 0) totalMins += 24 * 60;
    const breakMins = breakTime === "30min" ? 30 : breakTime === "45min" ? 45
      : breakTime === "1h" ? 60 : breakTime === "1h30" ? 90 : breakTime === "2h" ? 120 : 0;
    totalMins -= breakMins;
    const h = Math.floor(Math.max(0, totalMins) / 60);
    const m = Math.max(0, totalMins) % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  } catch {
    return "-";
  }
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${d.toString().padStart(2, '0')} de ${months[m - 1]} de ${y} (${weekDays[dt.getDay()]})`;
  } catch {
    return dateStr;
  }
}

interface OrbitShiftModalProps {
  isOpen: boolean;
  initialDate?: string;
  initialEmployeeId?: string;
  editingShift: Shift | null;
  employees: Employee[];
  shifts?: Shift[];
  requests?: TimeOffRequest[];
  justifications?: AbsenceJustification[];
  isRh?: boolean;
  onSave: (shiftData: Partial<Shift> & { id?: string }, notifyEmployee?: boolean, changeReason?: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const OrbitShiftModal: React.FC<OrbitShiftModalProps> = ({
  isOpen,
  initialDate = getTodayDateString(),
  initialEmployeeId,
  editingShift,
  employees,
  shifts = [],
  requests = [],
  justifications = [],
  isRh,
  onSave,
  onDelete,
  onClose,
}) => {
  const { isDark } = useTheme();
  const isLight = !isDark;

  const [employeeId, setEmployeeId] = useState<string>(initialEmployeeId || employees[0]?.id || 'emp-1');
  const [shiftType, setShiftType] = useState<string>(SHIFT_TYPES[0]);
  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [breakTime, setBreakTime] = useState<string>('1h');
  const [meetingLink, setMeetingLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [tag, setTag] = useState<string>('');
  const [status, setStatus] = useState<ShiftStatus>('published');
  const [presence, setPresence] = useState<AttendanceStatus>('pending');
  const [selectedColor, setSelectedColor] = useState<ShiftColor>(ORBIT_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Validação em tempo real: Choque de Horários (Sobreposição)
  const overlapConflict = useMemo<ShiftConflictResult | null>(() => {
    if (!shifts || shifts.length === 0) return null;
    return findShiftOverlapConflict(
      {
        employeeId,
        date,
        startTime,
        endTime,
        id: editingShift?.id,
      },
      shifts
    );
  }, [employeeId, date, startTime, endTime, editingShift, shifts]);

  // Validação em tempo real: Ausência Aprovada (Folga/Férias/Atestado)
  const absenceConflict = useMemo<AbsenceConflictResult | null>(() => {
    return checkTimeOffConflict(employeeId, date, requests, justifications);
  }, [employeeId, date, requests, justifications]);

  // Validação em tempo real: Descanso Interjornada CLT Art. 66 (Mínimo de 11h)
  const interjornadaWarning = useMemo<InterjornadaResult | null>(() => {
    if (!shifts || shifts.length === 0) return null;
    return checkInterjornadaRest(
      {
        employeeId,
        date,
        startTime,
        endTime,
        id: editingShift?.id,
      },
      shifts
    );
  }, [employeeId, date, startTime, endTime, editingShift, shifts]);

  const hasBlockingConflict = Boolean(overlapConflict || (absenceConflict && absenceConflict.type === 'time_off'));

  // States for published shift view vs edit
  const isAlreadyPublished = Boolean(editingShift && editingShift.status === 'published');
  const [isEditingPublished, setIsEditingPublished] = useState<boolean>(false);
  const [notifyCollaborator, setNotifyCollaborator] = useState<boolean>(true);
  const [changeReason, setChangeReason] = useState<string>('');

  // Estados de gestão de postos de trabalho / unidades
  const [workplacesList, setWorkplacesList] = useState<WorkplaceLocation[]>(() => getStoredWorkplaces());
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState<string>('');
  const [isAddingNewWorkplace, setIsAddingNewWorkplace] = useState<boolean>(false);
  const [newWorkplaceName, setNewWorkplaceName] = useState<string>('');
  const [newWorkplaceAddress, setNewWorkplaceAddress] = useState<string>('');
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState<boolean>(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [customRadiusMeters, setCustomRadiusMeters] = useState<number>(200);
  const [addressErrorMessage, setAddressErrorMessage] = useState<string | null>(null);
  const [isManagingWorkplaces, setIsManagingWorkplaces] = useState<boolean>(false);

  const inputStyle: React.CSSProperties = {
    background: isLight ? "#f8fafc" : "rgba(255,255,255,0.05)",
    border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.12)",
    color: isLight ? "#0f172a" : "#ffffff",
    colorScheme: isLight ? "light" : "dark",
  };
  const labelStyle: React.CSSProperties = {
    color: isLight ? "#475569" : "rgba(255,255,255,0.55)",
  };
  const optionStyle: React.CSSProperties = {
    background: isLight ? "#ffffff" : "#181920",
    color: isLight ? "#0f172a" : "#ffffff",
  };

  // Filtra colaboradores excluindo gestores da lista de pessoas a serem escaladas
  const schedulableEmployees = useMemo(() => {
    return getSchedulableEmployees(employees, editingShift?.employeeId);
  }, [employees, editingShift?.employeeId]);

  useEffect(() => {
    const list = getStoredWorkplaces();
    setWorkplacesList(list);

    if (editingShift) {
      setEmployeeId(editingShift.employeeId || initialEmployeeId || schedulableEmployees[0]?.id || employees[0]?.id || 'emp-1');
      
      // Sincroniza o posto de trabalho do turno
      let matchedWp = list.find(w => 
        (editingShift.workplaceLocation?.id && w.id === editingShift.workplaceLocation.id) ||
        (editingShift.workplace && w.name.toLowerCase() === editingShift.workplace.toLowerCase())
      );
      if (!matchedWp && editingShift.workplaceLocation) {
        matchedWp = editingShift.workplaceLocation;
        list.push(matchedWp);
        setWorkplacesList([...list]);
      } else if (!matchedWp && editingShift.workplace) {
        matchedWp = {
          id: `wp-${Date.now()}`,
          name: editingShift.workplace,
          address: editingShift.workplace,
          latitude: 0,
          longitude: 0,
          radiusMeters: 200,
          isRemote: false,
        };
        list.push(matchedWp);
        setWorkplacesList([...list]);
      }
      setSelectedWorkplaceId(matchedWp ? matchedWp.id : (list[0]?.id || ''));

      let mappedType = editingShift.color ? getTypeForColor(editingShift.color) : null;
      if (!mappedType) {
        const isHomeOffice = editingShift.workplace?.toLowerCase().includes('remoto') || 
                             editingShift.workplace?.toLowerCase().includes('home office') ||
                             editingShift.title?.toLowerCase().includes('home office');
        mappedType = 
          isHomeOffice ? 'Home Office' :
          editingShift.type === 'meeting' ? 'Reunião / Alinhamento' :
          editingShift.type === 'on_call' ? 'Plantão' :
          editingShift.type === 'training' ? 'Treinamento' :
          editingShift.title?.toLowerCase().includes('evento') ? 'Evento' : 'Presencial';
      }
      
      setShiftType(mappedType);
      setTitle(editingShift.title || '');
      setDate(editingShift.date || initialDate);
      setStartTime(editingShift.startTime || '09:00');
      setEndTime(editingShift.endTime || '18:00');
      
      const bMins = editingShift.breakMinutes;
      const bStr = bMins === 30 ? '30min' : bMins === 45 ? '45min' : bMins === 60 ? '1h' : bMins === 90 ? '1h30' : bMins === 120 ? '2h' : bMins === 0 ? 'Sem intervalo' : '1h';
      setBreakTime(bStr);
      
      setMeetingLink(editingShift.meetingLink || '');
      setNotes(editingShift.notes || '');
      setTag(editingShift.projectTag || '');
      setStatus(editingShift.status || 'published');
      setPresence(editingShift.attendanceStatus || 'pending');

      if (editingShift.color) {
        setSelectedColor(editingShift.color);
      } else {
        setSelectedColor(getColorForShiftType(mappedType));
      }

      // If the shift is already published, start in View Mode!
      setIsEditingPublished(editingShift.status !== 'published');
      setNotifyCollaborator(true);
      setChangeReason('');
    } else {
      const targetEmpId = initialEmployeeId || schedulableEmployees[0]?.id || employees[0]?.id || 'emp-1';
      setEmployeeId(targetEmpId);

      // Local padrão do colaborador
      const emp = employees.find(e => e.id === targetEmpId);
      const matchedWp = list.find(w => emp?.workplace && w.name.toLowerCase() === emp.workplace.toLowerCase());
      setSelectedWorkplaceId(matchedWp ? matchedWp.id : (list[0]?.id || ''));

      setShiftType(SHIFT_TYPES[0]);
      setTitle('');
      setDate(initialDate);
      setStartTime('09:00');
      setEndTime('18:00');
      setBreakTime('1h');
      setMeetingLink('');
      setNotes('');
      setTag('');
      setStatus('published');
      setPresence('pending');
      setSelectedColor(ORBIT_COLORS[0]);
      setIsEditingPublished(true);
      setNotifyCollaborator(false);
      setChangeReason('');
    }
    setConfirmDelete(false);
  }, [editingShift, initialDate, initialEmployeeId, employees, schedulableEmployees]);

  // Busca sugestões em tempo real (Estilo Uber) com debounce de 350ms
  useEffect(() => {
    if (!isOpen || !isAddingNewWorkplace || !newWorkplaceAddress.trim() || newWorkplaceAddress.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await searchAddressSuggestions(newWorkplaceAddress);
        setAddressSuggestions(results);
      } catch (err) {
        console.warn('Erro ao buscar sugestões:', err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [isOpen, newWorkplaceAddress, isAddingNewWorkplace]);

  // Ao clicar diretamente numa cor da paleta, sincroniza também o tipo se houver categoria correspondente
  const handleColorChange = (c: ShiftColor) => {
    setSelectedColor(c);
    const matchingType = getTypeForColor(c);
    if (matchingType) {
      setShiftType(matchingType);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!editingShift;
  const hoursWorked = calcHours(startTime, endTime, breakTime);
  const assignedEmployee = employees.find(e => e.id === employeeId);

  const handleSelectSuggestion = (sugg: AddressSuggestion) => {
    setNewWorkplaceAddress(sugg.displayName);
    setSelectedCoordinates({ latitude: sugg.latitude, longitude: sugg.longitude });
    setAddressSuggestions([]);
    setAddressErrorMessage(null);
    if (!newWorkplaceName.trim()) {
      const autoName = sugg.road 
        ? `${sugg.road}${sugg.city ? ` - ${sugg.city}` : ''}`
        : (sugg.displayName.split(',')[0] || 'Novo Posto');
      setNewWorkplaceName(autoName);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsSearchingAddress(true);
    setAddressErrorMessage(null);
    try {
      const coords = await getCurrentCoordinates();
      const geocoded = await reverseGeocode(coords.latitude, coords.longitude);
      setNewWorkplaceAddress(geocoded.formattedAddress);
      setSelectedCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
      if (!newWorkplaceName.trim()) {
        setNewWorkplaceName(geocoded.road ? `${geocoded.road} (${geocoded.city || 'Posto'})` : 'Meu Local Atual');
      }
      setAddressSuggestions([]);
    } catch (err: any) {
      setAddressErrorMessage(err.message || 'Não foi possível capturar o GPS do seu dispositivo.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleAddNewWorkplace = async () => {
    if (!newWorkplaceName.trim() || !newWorkplaceAddress.trim()) return;
    setIsSearchingAddress(true);
    setAddressErrorMessage(null);
    try {
      const created = await createWorkplaceFromAddress({
        name: newWorkplaceName.trim(),
        address: newWorkplaceAddress.trim(),
        radiusMeters: customRadiusMeters || 200,
        manualCoordinates: selectedCoordinates || undefined,
      });
      const updatedList = getStoredWorkplaces();
      setWorkplacesList(updatedList);
      setSelectedWorkplaceId(created.id);
      setIsAddingNewWorkplace(false);
      setNewWorkplaceName('');
      setNewWorkplaceAddress('');
      setSelectedCoordinates(null);
      setAddressSuggestions([]);
    } catch (err: any) {
      console.error('Erro ao adicionar posto de trabalho:', err);
      setAddressErrorMessage(err.message || 'Não foi possível localizar o endereço. Verifique as sugestões da lista.');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleDeleteWorkplace = (id: string) => {
    const wp = workplacesList.find(w => w.id === id);
    if (!wp) return;
    if (window.confirm(`Deseja realmente excluir o posto "${wp.name}"? Ele deixará de aparecer na lista de postos.`)) {
      const updated = deleteWorkplace(id);
      setWorkplacesList(updated);
      if (selectedWorkplaceId === id) {
        setSelectedWorkplaceId(updated[0]?.id || '');
      }
    }
  };

  const handleSaveWithStatus = (forcedStatus?: ShiftStatus) => {
    if (hasBlockingConflict) {
      alert(overlapConflict?.message || absenceConflict?.message || 'Não é possível salvar: existe um conflito de horário para este colaborador.');
      return;
    }

    const finalStatus = forcedStatus || status;
    const breakMins = breakTime === "30min" ? 30 : breakTime === "45min" ? 45
      : breakTime === "1h" ? 60 : breakTime === "1h30" ? 90 : breakTime === "2h" ? 120 : 0;

    let typeMapped: ShiftType = 'regular';
    if (shiftType.includes('Reunião')) typeMapped = 'meeting';
    else if (shiftType.includes('Plantão')) typeMapped = 'on_call';
    else if (shiftType.includes('Treinamento')) typeMapped = 'training';

    const currentWp = workplacesList.find(w => w.id === selectedWorkplaceId) || workplacesList[0];

    onSave({
      id: editingShift?.id,
      employeeId,
      date,
      startTime,
      endTime,
      breakMinutes: breakMins,
      title: title || (shiftType + ' - ' + (employees.find(e => e.id === employeeId)?.name || '')),
      type: typeMapped,
      status: finalStatus,
      attendanceStatus: presence,
      meetingLink: meetingLink.trim() || undefined,
      notes: notes.trim() || undefined,
      projectTag: tag.trim() || undefined,
      color: selectedColor,
      workplace: currentWp?.name,
      workplaceLocation: currentWp,
    }, isAlreadyPublished ? notifyCollaborator : false, changeReason);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasBlockingConflict) return;
    handleSaveWithStatus();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. VIEW MODE: Exibição da Escala Já Publicada (com botão para Editar)
  // ─────────────────────────────────────────────────────────────────────────────
  if ((isAlreadyPublished || isRh) && !isEditingPublished) {
    const currentWp = workplacesList.find(w => w.id === selectedWorkplaceId)
      || editingShift?.workplaceLocation
      || (editingShift?.workplace ? { name: editingShift.workplace, address: editingShift.workplace } : null);

    const wpName = currentWp?.name || 'Home Office / Remoto';
    const wpAddress = currentWp?.address || 'Trabalho Remoto / Domiciliar';
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${wpName} ${wpAddress}`)}`;

    // Formatação da data no cabeçalho: "Terça-feira, 03/11/2026"
    let headerDateStr = date;
    let cardDateStr = date;
    let cardWeekdayStr = '';
    try {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const dayStr = d.toString().padStart(2, '0');
      const monthStr = m.toString().padStart(2, '0');
      headerDateStr = `${weekDays[dt.getDay()]}, ${dayStr}/${monthStr}/${y}`;
      cardDateStr = `${dayStr}/${monthStr}/${y}`;
      cardWeekdayStr = weekDays[dt.getDay()];
    } catch {
      // fallback
    }

    const modalTitle = editingShift?.title || title || shiftType || 'Escala de Trabalho';
    const presenceStatus = presence === 'present' ? 'PRESENTE' : presence === 'absent' ? 'AUSENTE' : 'PENDENTE';

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className={`relative w-full max-w-xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 font-sans flex flex-col max-h-[92vh] ${
            isLight ? 'bg-white text-slate-800' : 'text-slate-100'
          }`}
          style={{
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #181920 0%, #111217 60%, #0d0e12 100%)",
            border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: isLight
              ? "0 25px 60px rgba(0,0,0,0.12)"
              : "0 25px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Top gradient accent bar (Orbit signature) */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB] shrink-0" />

          {/* Header (Disposição idêntica à imagem 2, sem ícone no início, cor escura da 1) */}
          <div
            className={`px-6 py-4 flex items-start justify-between border-b shrink-0 ${
              isLight ? 'border-slate-100' : 'border-white/10'
            }`}
          >
            <div className="min-w-0 pr-4">
              <h2 className={`text-lg sm:text-xl font-bold tracking-tight truncate ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                {modalTitle}
              </h2>
              <p className={`text-xs mt-0.5 capitalize ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                {headerDateStr}
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Corpo rolável com a disposição exata da imagem 2 */}
          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar p-5 sm:p-6 flex flex-col gap-3.5 flex-1">

            {/* 1. Card do Colaborador no topo */}
            <div className={`p-4 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  COLABORADOR(A) ATRIBUÍDO(A)
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                  presence === 'present'
                    ? isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : presence === 'absent'
                    ? isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-zinc-400 border-white/10'
                }`}>
                  {presenceStatus}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <img
                  src={assignedEmployee?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                  alt={assignedEmployee?.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#f89847]/40 shadow-md shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm sm:text-base font-bold truncate ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {assignedEmployee?.name || "Colaborador"}
                  </h3>
                  <p className={`text-xs mt-0.5 truncate ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    {assignedEmployee?.role || "Função Operacional"}{assignedEmployee?.department ? ` • ${assignedEmployee.department}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Grid com 3 cards: Data, Horário e Carga/Pausa */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card Data */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
              }`}>
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                  DATA
                </span>
                <div className="mt-2">
                  <div className={`text-sm sm:text-base font-bold ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {cardDateStr}
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    {cardWeekdayStr || 'Programada'}
                  </div>
                </div>
              </div>

              {/* Card Horário */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
              }`}>
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  <Clock className="w-3.5 h-3.5 text-[#f89847]" />
                  HORÁRIO
                </span>
                <div className="mt-2">
                  <div className={`text-sm sm:text-base font-bold ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {startTime} às {endTime}
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    Jornada prevista
                  </div>
                </div>
              </div>

              {/* Card Carga / Pausa */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
              }`}>
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  <Clock className="w-3.5 h-3.5 text-[#f89847]" />
                  CARGA / PAUSA
                </span>
                <div className="mt-2">
                  <div className={`text-sm sm:text-base font-bold ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {hoursWorked} totais
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    {breakTime} de intervalo
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Grid com 2 cards: Local de Atuação e Orientações do Gestor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Local de Atuação */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    <MapPin className="w-3.5 h-3.5 text-[#f89847]" />
                    LOCAL DE ATUAÇÃO
                  </span>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver Maps
                  </a>
                </div>
                <div>
                  <div className={`text-xs sm:text-sm font-bold truncate ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {wpName}
                  </div>
                  <div className={`text-xs mt-0.5 line-clamp-2 ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    {wpAddress}
                  </div>
                </div>
              </div>

              {/* Card Orientações do Gestor */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
              }`}>
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 mb-2 ${
                  isLight ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  <Sparkles className="w-3.5 h-3.5 text-[#f89847]" />
                  ORIENTAÇÕES DO GESTOR
                </span>
                <p className={`text-xs leading-relaxed line-clamp-3 ${
                  notes ? (isLight ? 'text-slate-700' : 'text-zinc-200') : (isLight ? 'text-slate-400 italic' : 'text-zinc-500 italic')
                }`}>
                  {notes || 'Sem orientações adicionais cadastradas para este turno.'}
                </p>
              </div>
            </div>

            {/* 4. Ponto batido (se houver checkIn ou checkOut registrado) */}
            {(editingShift?.checkInTime || editingShift?.checkOutTime) && (
              <div className="flex flex-col gap-2">
                {editingShift.checkInTime && (
                  <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
                    isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-xs sm:text-sm ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>
                          Entrada Registrada às {editingShift.checkInTime}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          GPS Validado
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-emerald-700' : 'text-emerald-300/80'}`}>
                        {editingShift.checkInLocation?.address || 'Entrada confirmada via aplicativo'}
                      </p>
                    </div>
                  </div>
                )}

                {editingShift.checkOutTime && (
                  <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
                    isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'
                  }`}>
                    <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-xs sm:text-sm ${isLight ? 'text-rose-900' : 'text-rose-300'}`}>
                          Saída Registrada às {editingShift.checkOutTime}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                          Ponto Fechado
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-rose-700' : 'text-rose-300/80'}`}>
                        {editingShift.checkOutLocation?.address || 'Saída confirmada pelo colaborador'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Link da Reunião (se houver) */}
            {meetingLink && (
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base">🔗</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>Link da Reunião</p>
                    <p className={`text-[11px] truncate ${isLight ? 'text-emerald-700' : 'text-emerald-400/80'}`}>{meetingLink}</p>
                  </div>
                </div>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <span>Acessar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* 6. Categoria da Escala (Simples, discreto e sem ícone no início) */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.04] border-white/10'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{
                    background: selectedColor.bg,
                    border: `2px solid ${selectedColor.border}`,
                  }}
                />
                <div className="min-w-0">
                  <span className={`text-[10px] uppercase font-bold font-mono tracking-wider block ${
                    isLight ? 'text-slate-500' : 'text-zinc-400'
                  }`}>
                    CATEGORIA DA ESCALA
                  </span>
                  <span className={`text-xs sm:text-sm font-bold truncate block ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {selectedColor.category || ORBIT_COLORS.find(c => c.label === selectedColor.label || c.bg === selectedColor.bg)?.category || shiftType || 'Operacional / Presencial'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Rodapé com botões de ação do Gestor */}
          <div
            className={`px-6 py-4 flex items-center justify-between gap-3 border-t shrink-0 ${
              isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div>
              {!isRh && onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className={`text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer font-medium ${
                    isLight 
                      ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' 
                      : 'hover:bg-red-500/20 text-red-400 border border-red-500/20'
                  }`}
                  style={!isLight ? { background: "rgba(245,101,101,0.08)" } : undefined}
                >
                  Excluir Escala
                </button>
              )}
              {!isRh && onDelete && confirmDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(editingShift!.id)}
                  className="text-xs px-3.5 py-2 rounded-xl transition-all font-bold cursor-pointer bg-red-600 text-white hover:bg-red-700 shadow-sm"
                >
                  Confirmar exclusão
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                Fechar
              </button>
              {!isRh && (
                <button
                  type="button"
                  onClick={() => setIsEditingPublished(true)}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer text-white"
                  style={{
                    background: "linear-gradient(135deg, #96183c 0%, #f89847 100%)",
                    boxShadow: "0 4px 12px rgba(150,24,60,0.4)"
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Escala</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. EDIT MODE: Formulário de Criação ou Edição (com aviso ao colaborador)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 font-sans ${
          isLight ? 'text-slate-800' : 'text-slate-100'
        }`}
        style={{
          background: isLight ? "#ffffff" : "linear-gradient(160deg, #181920 0%, #111217 60%, #0d0e12 100%)",
          border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(150, 24, 60, 0.35)",
          boxShadow: isLight
            ? "0 25px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(248,152,71,0.15)"
            : "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(248,152,71,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
          maxHeight: "92vh",
        }}
      >
        {/* Top gradient accent bar (Orbit signature) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB] shrink-0" />

        {/* Header */}
        <div
          className={`px-7 py-4.5 flex items-start justify-between border-b ${
            isLight ? 'border-slate-100' : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-3.5">
            
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {isAlreadyPublished ? "Editar Escala Publicada" : isEdit ? "Detalhes do Turno & Atividades" : "Novo Turno & Atividades"}
              </h2>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                {isAlreadyPublished ? "Ajuste os dados e confirme o aviso ao colaborador" : "Gerenciamento de horários e lembretes"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status & Presence row */}
        <div
          className={`px-7 py-3 flex items-center justify-between border-b ${
            isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={labelStyle}>Estado:</span>
            <button
              type="button"
              onClick={() => setStatus(status === "published" ? "draft" : "published")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer hover:scale-105"
              style={status === "published" ? {
                background: isLight ? "#ecfdf5" : "rgba(72,187,120,0.2)",
                color: isLight ? "#047857" : "#48bb78",
                border: isLight ? "1px solid #a7f3d0" : "1px solid rgba(72,187,120,0.35)"
              } : {
                background: isLight ? "#f1f5f9" : "rgba(255,255,255,0.05)",
                color: isLight ? "#475569" : "rgba(255,255,255,0.5)",
                border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status === "published" ? "#48bb78" : isLight ? "#94a3b8" : "rgba(255,255,255,0.3)" }}
              />
              {status === "published" ? "PUBLICADO" : "RASCUNHO"}
            </button>
          </div>

        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ maxHeight: "calc(92vh - 210px)" }}>
          <div className="px-7 py-5 flex flex-col gap-4.5">

            {/* Aviso especial caso a escala já tenha sido publicada */}
            {isAlreadyPublished && (
              <>
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-xs">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-amber-300">Atenção: Você está editando uma escala já publicada!</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingPublished(false)}
                        className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer text-[11px]"
                      >
                        Ver dados publicados
                      </button>
                    </div>
                    <p className="text-amber-200/80 mt-1 leading-relaxed">
                      O colaborador pode já ter se programado com base na escala anterior. Para ser justo com o mesmo, mantenha o aviso ativado para que ele receba a notificação imediata sobre as mudanças.
                    </p>
                  </div>
                </div>

                {/* Opção de Notificar Colaborador */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-[#f89847]/30 flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifyCollaborator}
                      onChange={e => setNotifyCollaborator(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#f89847] cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-[#f89847]" />
                      <span className="text-xs font-bold text-white">
                        Avisar colaborador(a) sobre a alteração (Recomendado)
                      </span>
                    </div>
                  </label>
                  {notifyCollaborator && (
                    <div className="pl-6.5">
                      <input
                        type="text"
                        value={changeReason}
                        onChange={e => setChangeReason(e.target.value)}
                        placeholder="Motivo da alteração para constar no aviso (ex: Mudança de horário, necessidade operacional)..."
                        className="w-full px-3 py-2 rounded-lg text-xs bg-black/40 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[#f89847] transition-all"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        🔔 Uma notificação oficial será adicionada ao painel do colaborador informando os novos horários.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Collaborator Selector */}
            <div>
              <label
                className="flex items-center gap-1.5 text-xs font-semibold mb-1.5"
                style={labelStyle}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                COLABORADOR(A) ATRIBUÍDO(A)
              </label>

              <select
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                style={inputStyle}
              >
                {schedulableEmployees.map(emp => (
                  <option key={emp.id} value={emp.id} style={optionStyle}>
                    {emp.name} — {emp.role} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>
                TÍTULO / IDENTIFICADOR
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Sprint Planning"
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all ${
                  isLight ? 'placeholder:text-slate-400' : 'placeholder:text-white/25'
                }`}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.8)"}
                onBlur={e => e.target.style.borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
              />
            </div>

            {/* Date + Times */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.8)"}
                  onBlur={e => e.target.style.borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.8)"}
                  onBlur={e => e.target.style.borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.8)"}
                  onBlur={e => e.target.style.borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
                />
              </div>
            </div>

            {/* Break + Hours badge */}
            <div className="flex items-end gap-3.5">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold mb-1.5 block" style={labelStyle}>Intervalo / Carga</label>
                <select
                  value={breakTime}
                  onChange={e => setBreakTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                  style={inputStyle}
                >
                  {BREAK_OPTIONS.map(b => (
                    <option key={b} value={b} style={optionStyle}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0">
                <div
                  className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs flex items-center justify-center min-w-[70px]"
                  style={{
                    background: "linear-gradient(135deg, rgba(150,24,60,0.35), rgba(248,152,71,0.25))",
                    border: "1px solid rgba(248,152,71,0.3)",
                    color: "#faf0ac"
                  }}
                >
                  {hoursWorked}
                </div>
              </div>
            </div>

            {/* Alerta de Conflito de Horário (Bloqueante) */}
            {overlapConflict && (
              <div 
                className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
                  isLight 
                    ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm' 
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-sm shadow-rose-950/50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm mb-0.5 flex items-center gap-1.5">
                    <span>🚫 Conflito de Horário Detectado</span>
                  </p>
                  <p className="leading-relaxed font-medium">
                    {overlapConflict.message}
                  </p>
                  <p className="text-[11px] opacity-80 mt-1 font-mono">
                    Não é permitido alocar o mesmo colaborador em turnos sobrepostos. Ajuste o horário ou a data para desbloquear o salvamento.
                  </p>
                </div>
              </div>
            )}

            {/* Alerta de Ausência / Férias / Folga Aprovada */}
            {absenceConflict && (
              <div 
                className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in duration-200 ${
                  absenceConflict.type === 'time_off'
                    ? isLight ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm' : 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-sm shadow-amber-950/50'
                    : isLight ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-sm' : 'bg-sky-950/40 border-sky-500/50 text-sky-200 shadow-sm shadow-sky-950/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  absenceConflict.type === 'time_off'
                    ? 'bg-amber-500/20 border-amber-500/40'
                    : 'bg-sky-500/20 border-sky-500/40'
                }`}>
                  <ShieldAlert className={`w-4 h-4 ${absenceConflict.type === 'time_off' ? 'text-amber-500' : 'text-sky-400'}`} />
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-sm mb-0.5">
                    {absenceConflict.type === 'time_off' ? '🏖️ Colaborador em Folga / Férias' : '📋 Justificativa de Ausência Registrada'}
                  </p>
                  <p className="leading-relaxed font-medium">
                    {absenceConflict.message}
                  </p>
                </div>
              </div>
            )}

            {/* Aviso de Intervalo Interjornada CLT Art. 66 (< 11h de descanso) */}
            {interjornadaWarning && !overlapConflict && (
              <div 
                className={`p-3 rounded-xl border flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  isLight 
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-amber-700 dark:text-amber-300">
                    Aviso CLT Art. 66 (Interjornada):
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90 mt-0.5">
                    {interjornadaWarning.message}
                  </p>
                </div>
              </div>
            )}

            {/* Seletor simples e elegante de Categoria da Escala (Sem bolas coloridas) */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isLight 
                ? 'bg-slate-50 border-slate-200' 
                : 'bg-white/[0.04] border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <label className={`text-xs font-bold tracking-wider uppercase font-mono ${
                  isLight ? 'text-slate-600' : 'text-zinc-300'
                }`}>
                  Categoria da Escala
                </label>
              </div>

              {/* Grid simples e intuitivo de botões de categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ORBIT_COLORS.map((c) => {
                  const isSelected = selectedColor.label === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => handleColorChange(c)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected 
                          ? isLight
                            ? 'bg-white border-[#96183C] shadow-xs ring-1 ring-[#96183C]/30'
                            : 'bg-white/10 border-[#F89847] shadow-sm ring-1 ring-[#F89847]/40'
                          : isLight
                            ? 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-700'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                          style={{ background: c.bg, border: `1.5px solid ${c.border}` }} 
                        />
                        <span className={`text-xs font-bold truncate ${
                          isSelected
                            ? isLight ? 'text-slate-900' : 'text-white'
                            : isLight ? 'text-slate-700' : 'text-zinc-300'
                        }`}>
                          {c.category}
                        </span>
                      </div>
                      {isSelected && (
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                          isLight ? 'bg-rose-50 text-[#96183C]' : 'bg-[#F89847]/20 text-[#FAF0AC]'
                        }`}>
                          Ativo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meeting Link */}
            <div>
              <label
                className="flex items-center justify-between text-xs font-semibold mb-1.5"
                style={labelStyle}
              >
                <span>🔗 LINK DA REUNIÃO (MEET / ZOOM)</span>
                {meetingLink && (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs flex items-center gap-1 hover:opacity-80 transition-all font-bold"
                    style={{ color: "#48bb78" }}
                  >
                    ABRIR LINK
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all ${
                  isLight ? 'placeholder:text-emerald-700/40 text-emerald-800' : 'placeholder:text-white/25 text-[#48bb78]'
                }`}
                style={{
                  background: isLight ? "rgba(72,187,120,0.08)" : "rgba(72,187,120,0.07)",
                  border: isLight ? "1px solid rgba(72,187,120,0.3)" : "1px solid rgba(72,187,120,0.2)",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(72,187,120,0.7)"}
                onBlur={e => e.target.style.borderColor = isLight ? "rgba(72,187,120,0.3)" : "rgba(72,187,120,0.2)"}
              />
            </div>

            {/* Posto / Unidade de Trabalho do Turno */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold flex items-center gap-1.5" style={labelStyle}>
                  <MapPin className="w-3.5 h-3.5 text-[#F89847]" />
                  <span>POSTO DE TRABALHO / UNIDADE</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingWorkplaces(prev => !prev);
                      setIsAddingNewWorkplace(false);
                    }}
                    className={`text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isManagingWorkplaces ? 'Fechar Gerenciador' : `Gerenciar / Excluir Postos (${workplacesList.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewWorkplace(prev => !prev);
                      setIsManagingWorkplaces(false);
                    }}
                    className="text-[11px] font-bold text-[#F89847] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    {isAddingNewWorkplace ? 'Cancelar' : 'Novo Posto via Endereço/CEP'}
                  </button>
                </div>
              </div>

              {!isAddingNewWorkplace ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedWorkplaceId}
                      onChange={e => setSelectedWorkplaceId(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer font-medium"
                      style={inputStyle}
                    >
                      {workplacesList.map(w => (
                        <option key={w.id} value={w.id} style={optionStyle}>
                          {w.name} {w.isRemote ? '(Flexível/Remoto)' : `(${w.address})`}
                        </option>
                      ))}
                    </select>

                    {selectedWorkplaceId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkplace(selectedWorkplaceId)}
                        className={`px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium shrink-0 ${isLight ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"}`}
                        title="Excluir o posto selecionado da lista"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Excluir Posto</span>
                      </button>
                    )}
                  </div>

                  {/* Painel aberto de Gerenciar e Excluir Postos Cadastrados */}
                  {isManagingWorkplaces && (
                    <div className={`p-3.5 rounded-2xl border space-y-2 animate-in fade-in duration-200 ${
                      isLight ? 'bg-slate-50 border-slate-200 shadow-inner' : 'bg-black/40 border-white/10'
                    }`}>
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-white/10">
                        <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          Lista de Postos Cadastrados ({workplacesList.length})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Remova postos desnecessários da lista
                        </span>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {workplacesList.map(wp => (
                          <div
                            key={wp.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                              isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {wp.name}
                              </p>
                              <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                {wp.isRemote ? 'Remoto / Flexível' : wp.address} {wp.radiusMeters ? `(${wp.radiusMeters}m)` : ''}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteWorkplace(wp.id)}
                              className={`px-2.5 py-1.5 rounded-lg border font-medium text-xs flex items-center gap-1 shrink-0 cursor-pointer transition-all ${isLight ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"}`}
                              title={`Excluir ${wp.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border space-y-3 relative ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[11px] font-semibold flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      <Search className="w-3.5 h-3.5 text-[#F89847]" />
                      <span>Digite a rua, bairro, CEP ou nome do local:</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={isSearchingAddress}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                        isLight
                          ? 'border-slate-300 bg-white text-slate-700 hover:border-[#96183c] hover:text-[#96183c]'
                          : 'border-white/20 bg-white/10 text-white hover:border-[#F89847] hover:text-[#F89847]'
                      }`}
                      title="Preencher com o GPS atual do seu dispositivo"
                    >
                      <Navigation className="w-3 h-3 text-[#F89847]" />
                      <span>Usar Minha Localização</span>
                    </button>
                  </div>

                  {/* Nome do Posto */}
                  <input
                    type="text"
                    placeholder="Nome do Posto (Ex: Filial Colombo, Stand Anhembi, Obra 02...)"
                    value={newWorkplaceName}
                    onChange={e => setNewWorkplaceName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs outline-none font-medium"
                    style={inputStyle}
                  />

                  {/* Input de Endereço com Autocomplete estilo Uber */}
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Endereço, Rua ou CEP (Ex: Rua Antonio Chemin, Colombo - PR)"
                          value={newWorkplaceAddress}
                          onChange={e => {
                            setNewWorkplaceAddress(e.target.value);
                            setSelectedCoordinates(null);
                          }}
                          className="w-full px-3.5 py-2 pr-8 rounded-xl text-xs outline-none font-medium"
                          style={inputStyle}
                        />
                        {isSearchingSuggestions && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-slate-400" />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddNewWorkplace}
                        disabled={isSearchingAddress || !newWorkplaceName.trim() || !newWorkplaceAddress.trim()}
                        className="px-4 py-2 rounded-xl bg-[#96183c] hover:bg-[#b32047] text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50 shrink-0 shadow-sm"
                      >
                        {isSearchingAddress ? 'Salvando...' : 'Salvar Posto'}
                      </button>
                    </div>

                    {/* Lista suspensa de sugestões (Dropdown estilo Uber) */}
                    {addressSuggestions.length > 0 && (
                      <div 
                        className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border shadow-2xl overflow-hidden divide-y backdrop-blur-md ${
                          isLight 
                            ? 'bg-white/95 border-slate-200 divide-slate-100' 
                            : 'bg-[#181920]/95 border-white/15 divide-white/10'
                        }`}
                      >
                        <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-slate-400 font-bold bg-white/5">
                          Sugestões de Endereço (OpenStreetMap / Correios):
                        </div>
                        {addressSuggestions.map((sugg, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSuggestion(sugg)}
                            className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                              isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                            }`}
                          >
                            <MapPin className="w-4 h-4 text-[#F89847] shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {sugg.road ? `${sugg.road}${sugg.houseNumber ? `, ${sugg.houseNumber}` : ''}` : sugg.displayName.split(',')[0]}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {[sugg.neighbourhood, sugg.city, sugg.state].filter(Boolean).join(' - ')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Configurações adicionais: Raio de Validação e Verificação no Maps */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-400 text-[10.5px]">Raio de Tolerância:</span>
                      {[100, 200, 300, 500, 1000].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setCustomRadiusMeters(r)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            customRadiusMeters === r
                              ? 'bg-[#F89847] text-black shadow-xs'
                              : isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {r >= 1000 ? '1km' : `${r}m`}
                        </button>
                      ))}
                    </div>

                    {selectedCoordinates && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedCoordinates.latitude},${selectedCoordinates.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver no Google Maps
                      </a>
                    )}
                  </div>

                  {/* Mini-Mapa Interativo com Pino Arrastável e Círculo de Raio */}
                  {selectedCoordinates && (
                    <div className="pt-2">
                      <DraggableMapPicker
                        latitude={selectedCoordinates.latitude}
                        longitude={selectedCoordinates.longitude}
                        radiusMeters={customRadiusMeters}
                        onLocationChange={(newLat, newLng) => {
                          setSelectedCoordinates({ latitude: newLat, longitude: newLng });
                        }}
                        isLight={isLight}
                      />
                    </div>
                  )}

                  {/* Feedback de Erro */}
                  {addressErrorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-medium">
                      ⚠️ {addressErrorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tag + Notes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={labelStyle}>
                  LEMBRETES & ATIVIDADES
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  placeholder="Tag do Projeto"
                  className={`w-32 px-2.5 py-1 rounded-lg text-xs outline-none ${
                    isLight ? 'placeholder:text-slate-400' : 'placeholder:text-white/25'
                  }`}
                  style={inputStyle}
                />
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Descreva atividades, lembretes ou observações do turno..."
                rows={3}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all resize-none ${
                  isLight ? 'placeholder:text-slate-400' : 'placeholder:text-white/25'
                }`}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.8)"}
                onBlur={e => e.target.style.borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
              />
            </div>

          </div>

          {/* Footer */}
          <div
            className={`px-7 py-4.5 flex items-center justify-between gap-3 border-t ${
              isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              {isAlreadyPublished && (
                <button
                  type="button"
                  onClick={() => setIsEditingPublished(false)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border ${
                    isLight
                      ? 'text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white border-white/10 hover:border-white/20'
                  }`}
                >
                  ← Visualizar
                </button>
              )}

              {isEdit && onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 cursor-pointer"
                  style={{ background: "rgba(245,101,101,0.1)", color: "#f56565", border: "1px solid rgba(245,101,101,0.2)" }}
                >
                  Excluir
                </button>
              )}
              {isEdit && onDelete && confirmDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(editingShift!.id)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer"
                  style={{ background: "rgba(245,101,101,0.2)", color: "#f56565", border: "1px solid rgba(245,101,101,0.4)" }}
                >
                  Confirmar exclusão
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSaveWithStatus('draft')}
                disabled={hasBlockingConflict}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
                  hasBlockingConflict
                    ? 'opacity-40 cursor-not-allowed border-slate-500/20 text-slate-500 bg-black/10'
                    : 'hover:bg-amber-500/15 border-amber-500/40 text-amber-300 hover:border-amber-400 cursor-pointer'
                }`}
                title={hasBlockingConflict ? "Corrija os conflitos de horário antes de salvar" : "Salvar este turno como rascunho"}
              >
                Salvar Rascunho
              </button>
              <button
                type="button"
                onClick={() => handleSaveWithStatus('published')}
                disabled={hasBlockingConflict}
                className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg flex items-center gap-1.5 ${
                  hasBlockingConflict
                    ? 'opacity-40 cursor-not-allowed grayscale'
                    : 'hover:opacity-90 active:scale-95 cursor-pointer'
                }`}
                style={{
                  background: hasBlockingConflict
                    ? '#475569'
                    : "linear-gradient(135deg, #96183c 0%, #f89847 100%)",
                  color: "#faf0ac",
                  boxShadow: hasBlockingConflict ? 'none' : "0 4px 12px rgba(150,24,60,0.4)"
                }}
                title={hasBlockingConflict ? "Corrija os conflitos de horário antes de salvar" : undefined}
              >
                {isAlreadyPublished && notifyCollaborator && !hasBlockingConflict && <Bell className="w-3.5 h-3.5 animate-bounce" />}
                <span>
                  {isAlreadyPublished
                    ? (notifyCollaborator ? "Salvar & Avisar Colaborador" : "Salvar Alterações")
                    : (isEdit ? "Salvar Publicado" : "Publicar Turno")}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
