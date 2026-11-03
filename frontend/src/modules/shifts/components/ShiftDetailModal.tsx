import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Users, 
  Video, 
  ExternalLink,
  Calendar,
  MapPin,
  FileText,
  Tag,
  Copy,
  Check,
} from 'lucide-react';
import { Shift, Employee, WorkplaceLocation } from '@/types';
import { formatDateBR, normalizeDateToISO } from '@/shared/utils/dateUtils';
import { calculateShiftDurationHours } from '@/shared/utils/dateUtils';
import { ORBIT_COLORS } from './OrbitShiftModal';
import { findWorkplaceByName } from '@/shared/services/workplaceService';

interface ShiftDetailModalProps {
  shift: Partial<Shift> | null;
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  isLightTheme?: boolean;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  shift,
  employees,
  isOpen,
  onClose,
  isLightTheme = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  // Fecha o modal ao pressionar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !shift) return null;

  const selectedEmployee = employees.find(e => e.id === shift.employeeId);
  const duration = calculateShiftDurationHours(
    shift.startTime || '08:00',
    shift.endTime || '17:00',
    shift.breakMinutes !== undefined ? shift.breakMinutes : 60
  );

  // Extrai com segurança qualquer metadata de local embutida em notes [WP:{...}]
  const rawNotes = shift.notes || '';
  let cleanNotes = rawNotes;
  let parsedWorkplaceFromNotes: WorkplaceLocation | undefined = undefined;

  if (rawNotes.includes('[WP:')) {
    const startIdx = rawNotes.indexOf('[WP:');
    const endIdx = rawNotes.indexOf(']', startIdx);
    if (endIdx > startIdx + 4) {
      try {
        const jsonStr = rawNotes.substring(startIdx + 4, endIdx);
        parsedWorkplaceFromNotes = JSON.parse(jsonStr);
      } catch {}
      cleanNotes = (rawNotes.substring(0, startIdx) + ' ' + rawNotes.substring(endIdx + 1)).trim();
    }
  }

  const assignedWorkplace = shift.workplaceLocation || parsedWorkplaceFromNotes || findWorkplaceByName(shift.workplace || selectedEmployee?.workplace);
  const isRemote = assignedWorkplace?.isRemote || 
    shift.workplace?.toLowerCase().includes('remoto') || 
    shift.workplace?.toLowerCase().includes('home office') ||
    selectedEmployee?.workplace?.toLowerCase().includes('remoto') ||
    selectedEmployee?.workplace?.toLowerCase().includes('home office');

  const workplaceName = assignedWorkplace?.name || shift.workplace || selectedEmployee?.workplace || 'Presencial - Sede / Posto Operacional';
  const workplaceAddress = assignedWorkplace?.address || (isRemote ? 'Atuação 100% Remota / Home Office' : 'Comparecimento presencial com registro de ponto no local.');

  const workplaceMapsUrl = assignedWorkplace?.latitude && assignedWorkplace?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${assignedWorkplace.latitude},${assignedWorkplace.longitude}`
    : assignedWorkplace?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedWorkplace.address)}`
    : null;

  const formattedDate = useMemo(() => {
    if (!shift?.date) return { fullDate: '—', weekDay: '' };
    try {
      const iso = normalizeDateToISO(shift.date);
      const [y, m, d] = iso.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const fullDate = formatDateBR(shift.date);
      return {
        fullDate,
        weekDay: weekDay ? weekDay.charAt(0).toUpperCase() + weekDay.slice(1) : '',
      };
    } catch {
      return { fullDate: formatDateBR(shift.date) || shift.date, weekDay: '' };
    }
  }, [shift?.date]);

  const breakText = useMemo(() => {
    if (!shift.breakMinutes || shift.breakMinutes <= 0) return 'Sem intervalo';
    if (shift.breakMinutes >= 60) {
      const hours = (shift.breakMinutes / 60).toFixed(shift.breakMinutes % 60 === 0 ? 0 : 1);
      return `${hours}h de intervalo`;
    }
    return `${shift.breakMinutes}min de intervalo`;
  }, [shift.breakMinutes]);

  const initialColor = useMemo(() => {
    if (shift?.color?.bg) {
      const match = ORBIT_COLORS.find(
        (c) =>
          c.bg.toLowerCase() === shift.color?.bg?.toLowerCase() ||
          c.label.toLowerCase() === shift.color?.label?.toLowerCase()
      );
      if (match) return match;
      if (shift.color.category || shift.color.description) {
        return shift.color as typeof ORBIT_COLORS[0];
      }
    }
    if (shift?.type === 'meeting') return ORBIT_COLORS[4];
    if (shift?.type === 'on_call') return ORBIT_COLORS[1];
    if (shift?.type === 'training') return ORBIT_COLORS[3];
    return ORBIT_COLORS[0];
  }, [shift]);

  const isMeeting = shift.type === 'meeting' || Boolean(shift.meetingLink);

  const handleCopyLink = () => {
    if (!shift.meetingLink) return;
    navigator.clipboard.writeText(shift.meetingLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Categoria de escala simplificada (exibida de forma sutil no cabeçalho)
  const getCategoryConfig = () => {
    const rawType = (shift.type || '').toLowerCase();
    const rawCategory = (shift.color?.category || initialColor?.category || '').toLowerCase();

    if (rawType.includes('meeting') || rawType.includes('reuniao') || rawCategory.includes('reunião') || isMeeting) {
      return {
        label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Reunião',
        badgeBg: isLightTheme ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-950/50 text-purple-300 border-purple-500/30',
      };
    }
    if (rawType.includes('plantao') || rawType.includes('on_call') || rawCategory.includes('plantão')) {
      return {
        label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Plantão',
        badgeBg: isLightTheme ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-950/50 text-amber-300 border-amber-500/30',
      };
    }
    if (rawType.includes('training') || rawType.includes('treinamento') || rawCategory.includes('treinamento')) {
      return {
        label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Treinamento',
        badgeBg: isLightTheme ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 'bg-cyan-950/50 text-cyan-300 border-cyan-500/30',
      };
    }
    if (isRemote || rawCategory.includes('home office') || rawCategory.includes('remoto')) {
      return {
        label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Home Office',
        badgeBg: isLightTheme ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30',
      };
    }
    if (rawCategory.includes('evento') || rawCategory.includes('extraordinário')) {
      return {
        label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Evento',
        badgeBg: isLightTheme ? 'bg-pink-100 text-pink-800 border-pink-200' : 'bg-pink-950/50 text-pink-300 border-pink-500/30',
      };
    }
    return {
      label: initialColor?.category ? initialColor.category.split('/')[0].trim() : 'Operacional',
      badgeBg: isLightTheme ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-rose-950/50 text-rose-300 border-rose-500/30',
    };
  };

  const categoryConfig = getCategoryConfig();
  const departmentTag = selectedEmployee?.department || (shift as { department?: string })?.department || 'Geral';
  const projectTag = shift.projectTag;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 ${
        isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/75 backdrop-blur-md'
      } animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div
        className={`relative rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 animate-in zoom-in-95 duration-200 ${
          isLightTheme ? 'bg-white border border-slate-200 text-slate-900' : 'text-white border border-white/10'
        }`}
        style={
          isLightTheme
            ? {
                background: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
              }
            : {
                background: 'linear-gradient(160deg, #181920 0%, #111217 60%, #0d0e12 100%)',
                borderColor: 'rgba(150, 24, 60, 0.35)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              }
        }
        onClick={e => e.stopPropagation()}
      >
        {/* Top Decorative Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB] shrink-0" />

        {/* Modal Header */}
        <div
          className={`px-5 py-4.5 flex items-start justify-between gap-3 border-b shrink-0 ${
            isLightTheme ? 'border-slate-100 bg-slate-50/70' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {/* Badge da Categoria de Escala - Limpa e sutil */}
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${categoryConfig.badgeBg}`}
                >
                  {categoryConfig.label}
                </span>

                {/* Badge de Departamento / Setor */}
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    isLightTheme
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-white/5 text-slate-300 border-white/10'
                  }`}
                >
                  <Tag className="w-3 h-3 opacity-60" />
                  {departmentTag}
                </span>

                {/* Tag de Projeto se houver */}
                {projectTag && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLightTheme
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {projectTag}
                  </span>
                )}
              </div>

              <h2
                className={`font-black text-lg leading-tight break-words ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}
              >
                {shift.title || 'Turno de Trabalho'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              isLightTheme
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4.5 flex-1 text-sm custom-scrollbar">
          {/* Date & Time Highlights */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isLightTheme ? 'bg-white border border-slate-200 text-[#96183c]' : 'bg-white/10 text-[#f89642]'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block font-mono ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    Data
                  </span>
                  <span className={`text-xs font-bold font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {formattedDate.fullDate}
                  </span>
                </div>
              </div>

              <div className={`h-8 w-px ${isLightTheme ? 'bg-slate-200' : 'bg-white/10'} hidden sm:block`} />

              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isLightTheme ? 'bg-white border border-slate-200 text-[#96183c]' : 'bg-white/10 text-[#f89642]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block font-mono ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    Horário
                  </span>
                  <span className={`text-xs font-bold font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {shift.startTime || '08:00'} às {shift.endTime || '17:00'}
                    <span className={`ml-1.5 font-normal text-[11px] ${isLightTheme ? 'text-slate-500' : 'text-white/60'}`}>
                      ({duration}h{shift.breakMinutes && shift.breakMinutes > 0 ? ` • ${breakText}` : ''})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                  shift.attendanceStatus === 'present'
                    ? isLightTheme
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : shift.attendanceStatus === 'absent'
                    ? isLightTheme
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : shift.attendanceStatus === 'justified'
                    ? isLightTheme
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : isLightTheme
                    ? 'bg-[#faf0ac] text-[#96183c] border-[#f89642]/40'
                    : 'bg-[#96183c]/30 text-[#f89642] border-[#f89642]/30'
                }`}
              >
                {shift.attendanceStatus === 'present'
                  ? 'PRESENTE'
                  : shift.attendanceStatus === 'absent'
                  ? 'FALTA'
                  : shift.attendanceStatus === 'justified'
                  ? 'JUSTIFICADO'
                  : 'EM ABERTO / AGENDADO'}
              </span>
            </div>
          </div>

          {/* Meeting / External Link Section (se reunião online) */}
          {isMeeting && shift.meetingLink && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'}`} />
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                    Link & Acesso à Reunião
                  </h3>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
                  isLightTheme
                    ? 'bg-emerald-50/60 border-emerald-200/80'
                    : 'bg-emerald-950/20 border-emerald-500/20'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isLightTheme ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/50 text-emerald-300'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[10px] font-bold block uppercase font-mono ${isLightTheme ? 'text-emerald-800' : 'text-emerald-400'}`}>
                      Sala Virtual
                    </span>
                    <a
                      href={shift.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-300 hover:underline truncate block"
                      title={shift.meetingLink}
                    >
                      {shift.meetingLink}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isLightTheme
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                    }`}
                    title="Copiar link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>

                  <a
                    href={shift.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-1.5 bg-gradient-to-r from-[#96183c] to-[#b32047] hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Acessar</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Local de Atuação (presencial ou remoto quando não é reunião online) */}
          {(!isMeeting || !shift.meetingLink) && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isLightTheme ? 'bg-white border border-slate-200 text-[#96183c]' : 'bg-white/10 text-[#f89642]'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-[10px] uppercase font-bold block font-mono ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                    Local de Atuação
                  </span>
                  <p className={`text-xs font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {workplaceName}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-white/60'}`}>
                    {workplaceAddress}
                  </p>
                </div>
              </div>

              {workplaceMapsUrl && (
                <a
                  href={workplaceMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all shrink-0 ${
                    isLightTheme
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                  }`}
                  title="Abrir no Google Maps"
                >
                  <ExternalLink className="w-3 h-3 text-sky-400" />
                  <span>Ver Maps</span>
                </a>
              )}
            </div>
          )}

          {/* Registros de Ponto Real via GPS (Entrada e Saída) */}
          {(shift.checkInTime || shift.checkOutTime) && (
            <div className="space-y-2">
              {shift.checkInTime && (
                <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
                  isLightTheme
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}>
                  <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-emerald-600' : 'text-emerald-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs ${isLightTheme ? 'text-emerald-900' : 'text-emerald-300'}`}>
                        Entrada Registrada às {shift.checkInTime}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {shift.checkInLocation?.reportedWorkplace || 'GPS Validado'}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 truncate ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300/80'}`}>
                      {shift.checkInLocation?.address || workplaceAddress}
                    </p>
                  </div>
                </div>
              )}

              {shift.checkOutTime && (
                <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
                  isLightTheme
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}>
                  <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-rose-600' : 'text-rose-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs ${isLightTheme ? 'text-rose-900' : 'text-rose-300'}`}>
                        Saída Registrada às {shift.checkOutTime}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        Ponto Fechado
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 truncate ${isLightTheme ? 'text-rose-700' : 'text-rose-300/80'}`}>
                      {shift.checkOutLocation?.address || 'Saída confirmada pelo colaborador'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'}`} />
              <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                Descrição Completa
              </h3>
            </div>

            <div
              className={`p-4 rounded-2xl border leading-relaxed text-xs sm:text-sm whitespace-pre-line ${
                isLightTheme
                  ? 'bg-slate-50/80 border-slate-200 text-slate-800'
                  : 'bg-white/[0.04] border-white/10 text-slate-200'
              }`}
            >
              {cleanNotes && cleanNotes.trim().length > 0 ? (
                cleanNotes
              ) : (
                <span className={`italic text-xs ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`}>
                  Nenhuma descrição adicional foi informada pela gestão para este turno.
                </span>
              )}
            </div>
          </div>

          {/* Participants / Allocated Team Members */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#f89642]'}`} />
                <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                  Participantes & Destinatários
                </h3>
              </div>

              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isLightTheme ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                {selectedEmployee ? '1 participante(s)' : 'Equipe Geral'}
              </span>
            </div>

            {selectedEmployee ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  className={`p-2.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                    isLightTheme
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="relative shrink-0">
                    {selectedEmployee.avatar ? (
                      <img
                        src={selectedEmployee.avatar}
                        alt={selectedEmployee.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                          isLightTheme ? 'bg-[#96183c] text-white' : 'bg-[#f89642] text-slate-950'
                        }`}
                      >
                        {selectedEmployee.name ? selectedEmployee.name.slice(0, 2) : 'CL'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                      {selectedEmployee.name}
                    </p>
                    <p className={`text-[11px] truncate ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                      {selectedEmployee.role || 'Colaborador'} • {selectedEmployee.department || 'Operacional'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`p-3 rounded-2xl border text-center text-xs ${
                  isLightTheme ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                Nenhum colaborador atribuído individualmente (escala aberta ou geral).
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 flex items-center justify-end border-t shrink-0 ${
            isLightTheme ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isLightTheme
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
