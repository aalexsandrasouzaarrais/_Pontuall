import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Clock3,
  Users, 
  Video, 
  ExternalLink,
  Calendar,
  CheckCircle2,
  XCircle,
  FileCheck,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Shift, Employee, WorkplaceLocation, ShiftColor } from '@/types';
import { formatDateBR, normalizeDateToISO } from '@/shared/utils/dateUtils';
import { calculateShiftDurationHours } from '@/shared/utils/dateUtils';
import { findWorkplaceByName } from '@/shared/services/workplaceService';

interface ShiftDetailModalProps {
  shift: Partial<Shift> | null;
  employees?: Employee[];
  isOpen: boolean;
  onClose: () => void;
  isLightTheme?: boolean;
}

const FALLBACK_ORBIT_COLORS: ShiftColor[] = [
  { label: "Coral / Vinho", bg: "#63172a", border: "#8f253f", text: "#ffffff", category: "Operacional / Presencial" },
  { label: "Âmbar / Laranja", bg: "#543015", border: "#7c471f", text: "#ffffff", category: "Plantão / Sobreaviso" },
  { label: "Esmeralda", bg: "#163a2a", border: "#235840", text: "#ffffff", category: "Home Office / Remoto" },
  { label: "Azul Oceano", bg: "#18324a", border: "#284e72", text: "#ffffff", category: "Treinamento / Onboarding" },
  { label: "Violeta / Roxo", bg: "#3a2250", border: "#563476", text: "#ffffff", category: "Reunião / Alinhamento" },
  { label: "Rosa Magenta", bg: "#501d33", border: "#732c4b", text: "#ffffff", category: "Evento" },
];

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  shift,
  employees = [],
  isOpen,
  onClose,
  isLightTheme = false,
}) => {
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

  const safeEmployees = useMemo(() => Array.isArray(employees) ? employees : [], [employees]);
  const safeShift = shift || null;

  const selectedEmployee = useMemo(() => {
    if (!safeShift || !safeShift.employeeId) return undefined;
    return safeEmployees.find(e => e && e.id === safeShift.employeeId);
  }, [safeEmployees, safeShift]);

  const duration = useMemo(() => {
    if (!safeShift) return 8;
    try {
      return calculateShiftDurationHours(
        safeShift.startTime || '08:00',
        safeShift.endTime || '17:00',
        safeShift.breakMinutes !== undefined ? Number(safeShift.breakMinutes) : 60
      );
    } catch {
      return 8;
    }
  }, [safeShift]);

  // Extrai com segurança qualquer metadata de local embutida em notes [WP:{...}]
  const { cleanNotes, parsedWorkplaceFromNotes } = useMemo(() => {
    const rawNotes = typeof safeShift?.notes === 'string' ? safeShift.notes : '';
    let parsed: WorkplaceLocation | undefined = undefined;
    let clean = rawNotes;

    if (rawNotes.includes('[WP:')) {
      const startIdx = rawNotes.indexOf('[WP:');
      const endIdx = rawNotes.indexOf(']', startIdx);
      if (endIdx > startIdx + 4) {
        try {
          const jsonStr = rawNotes.substring(startIdx + 4, endIdx);
          parsed = JSON.parse(jsonStr);
          clean = (rawNotes.substring(0, startIdx) + ' ' + rawNotes.substring(endIdx + 1)).trim();
        } catch {}
      }
    }

    return { cleanNotes: clean, parsedWorkplaceFromNotes: parsed };
  }, [safeShift?.notes]);

  const workplaceStr = useMemo(() => {
    if (!safeShift) return '';
    if (typeof safeShift.workplace === 'string') return safeShift.workplace;
    if (typeof safeShift.workplace === 'object' && safeShift.workplace !== null) {
      return (safeShift.workplace as { name?: string }).name || '';
    }
    return '';
  }, [safeShift]);

  const employeeWorkplaceStr = useMemo(() => {
    if (!selectedEmployee) return '';
    if (typeof selectedEmployee.workplace === 'string') return selectedEmployee.workplace;
    if (typeof selectedEmployee.workplace === 'object' && selectedEmployee.workplace !== null) {
      return (selectedEmployee.workplace as { name?: string }).name || '';
    }
    return '';
  }, [selectedEmployee]);

  const assignedWorkplace = useMemo(() => {
    if (!safeShift) return undefined;
    return safeShift.workplaceLocation || parsedWorkplaceFromNotes || findWorkplaceByName(workplaceStr || employeeWorkplaceStr);
  }, [safeShift, parsedWorkplaceFromNotes, workplaceStr, employeeWorkplaceStr]);

  const isRemote = useMemo(() => {
    const wLower = workplaceStr.toLowerCase();
    const eLower = employeeWorkplaceStr.toLowerCase();
    return Boolean(
      assignedWorkplace?.isRemote ||
      wLower.includes('remoto') ||
      wLower.includes('home office') ||
      eLower.includes('remoto') ||
      eLower.includes('home office')
    );
  }, [assignedWorkplace, workplaceStr, employeeWorkplaceStr]);

  const workplaceName = assignedWorkplace?.name || workplaceStr || employeeWorkplaceStr || 'Presencial - Sede / Posto Operacional';
  const workplaceAddress = assignedWorkplace?.address || (isRemote ? 'Atuação 100% Remota / Home Office' : 'Comparecimento presencial com registro de ponto no local.');

  const workplaceMapsUrl = useMemo(() => {
    if (assignedWorkplace?.latitude && assignedWorkplace?.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${assignedWorkplace.latitude},${assignedWorkplace.longitude}`;
    }
    if (assignedWorkplace?.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(assignedWorkplace.address))}`;
    }
    return null;
  }, [assignedWorkplace]);

  const formattedDate = useMemo(() => {
    if (!safeShift?.date) return { fullDate: '—', weekDay: '' };
    try {
      const iso = normalizeDateToISO(safeShift.date);
      if (iso && iso.includes('-')) {
        const [y, m, d] = iso.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (!isNaN(dateObj.getTime())) {
          const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
          const fullDate = formatDateBR(safeShift.date) || iso;
          return {
            fullDate,
            weekDay: weekDay ? weekDay.charAt(0).toUpperCase() + weekDay.slice(1) : '',
          };
        }
      }
      return { fullDate: formatDateBR(safeShift.date) || String(safeShift.date), weekDay: '' };
    } catch {
      return { fullDate: formatDateBR(safeShift.date) || String(safeShift.date), weekDay: '' };
    }
  }, [safeShift?.date]);

  const breakText = useMemo(() => {
    if (!safeShift) return 'Sem intervalo';
    try {
      const minutes = Number(safeShift.breakMinutes);
      if (isNaN(minutes) || minutes <= 0) return 'Sem intervalo';
      if (minutes >= 60) {
        const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
        return `${hours}h de intervalo`;
      }
      return `${minutes}min de intervalo`;
    } catch {
      return 'Sem intervalo';
    }
  }, [safeShift]);

  // Identificador da Escala limpo e simplificado
  const scaleInfo = useMemo(() => {
    if (!safeShift) {
      return {
        category: 'Operacional / Presencial',
        label: 'Coral / Vinho',
        bg: '#63172a',
        border: '#8f253f',
      };
    }

    try {
      const shiftColor = safeShift.color;
      if (typeof shiftColor === 'object' && shiftColor !== null) {
        const targetBg = typeof shiftColor.bg === 'string' ? shiftColor.bg.toLowerCase() : '';
        const targetLabel = typeof shiftColor.label === 'string' ? shiftColor.label.toLowerCase() : '';

        const match = FALLBACK_ORBIT_COLORS.find(
          c =>
            (targetBg && c.bg.toLowerCase() === targetBg) ||
            (targetLabel && c.label.toLowerCase() === targetLabel)
        );

        if (match) {
          return {
            category: shiftColor.category || match.category || 'Operacional / Presencial',
            label: shiftColor.label || match.label,
            bg: match.bg,
            border: match.border,
          };
        }

        if (shiftColor.category || shiftColor.label) {
          return {
            category: shiftColor.category || shiftColor.label || 'Personalizado',
            label: shiftColor.label || shiftColor.category || '',
            bg: typeof shiftColor.bg === 'string' ? shiftColor.bg : '#63172a',
            border: typeof shiftColor.border === 'string' ? shiftColor.border : '#8f253f',
          };
        }
      }

      if (safeShift.type === 'meeting' || safeShift.meetingLink) {
        return FALLBACK_ORBIT_COLORS[4];
      }
      if (safeShift.type === 'on_call') {
        return FALLBACK_ORBIT_COLORS[1];
      }
      if (safeShift.type === 'training') {
        return FALLBACK_ORBIT_COLORS[3];
      }
      if (isRemote) {
        return FALLBACK_ORBIT_COLORS[2];
      }
    } catch (e) {
      console.warn('Erro ao calcular scaleInfo:', e);
    }

    return FALLBACK_ORBIT_COLORS[0];
  }, [safeShift, isRemote]);

  const isMeeting = Boolean(safeShift?.type === 'meeting' || safeShift?.meetingLink);

  if (!isOpen || !safeShift) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ${
      isLightTheme ? 'bg-slate-900/50 backdrop-blur-xs' : 'bg-black/75 backdrop-blur-md'
    } animate-in fade-in duration-200`}>
      <div
        className={`relative rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isLightTheme ? 'bg-white border border-slate-200 text-slate-800' : 'text-white'
        }`}
        style={
          isLightTheme
            ? {
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18)'
              }
            : {
                background: 'linear-gradient(160deg, #181920 0%, #111217 60%, #0d0e12 100%)',
                border: '1px solid rgba(150, 24, 60, 0.35)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
              }
        }
      >
        {/* Barra superior de destaque em degradê */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]" />

        {/* Cabeçalho */}
        <div className={`px-5 py-4 flex items-center justify-between flex-shrink-0 border-b ${
          isLightTheme ? 'border-slate-100 bg-slate-50/70' : 'border-white/5 bg-white/[0.02]'
        }`}>
          <div className="min-w-0 pr-2">
            <h3 className={`font-black text-base sm:text-lg leading-tight truncate ${
              isLightTheme ? 'text-slate-900' : 'text-white'
            }`}>
              {safeShift.title || 'Turno de Trabalho'}
            </h3>
            <p className={`text-xs mt-0.5 truncate ${isLightTheme ? 'text-slate-500' : 'text-white/60'}`}>
              {formattedDate.weekDay ? `${formattedDate.weekDay}, ${formattedDate.fullDate}` : 'Detalhes da escala'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
              isLightTheme
                ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com rolagem suave */}
        <div className={`p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 ${
          isLightTheme ? 'text-slate-800' : 'text-white'
        }`}>

          {/* Card de Colaborador e Presença */}
          <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
            isLightTheme ? 'bg-slate-50/80 border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                isLightTheme ? 'text-slate-400' : 'text-zinc-400'
              }`}>
                Colaborador(a) Atribuído(a)
              </span>

              {/* Badge de Presença */}
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1 border ${
                  safeShift.attendanceStatus === 'present'
                    ? isLightTheme
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : safeShift.attendanceStatus === 'absent'
                      ? isLightTheme
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : safeShift.attendanceStatus === 'justified'
                        ? isLightTheme
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : isLightTheme
                          ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                          : 'bg-white/10 text-white/70 border-white/15'
                }`}>
                  {safeShift.attendanceStatus === 'present' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  {safeShift.attendanceStatus === 'absent' && <XCircle className="w-3 h-3 text-rose-500" />}
                  {safeShift.attendanceStatus === 'justified' && <FileCheck className="w-3 h-3 text-amber-500" />}
                  {(!safeShift.attendanceStatus || safeShift.attendanceStatus === 'pending') && <Clock className="w-3 h-3 text-amber-400" />}
                  {safeShift.attendanceStatus === 'present'
                    ? 'PRESENTE'
                    : safeShift.attendanceStatus === 'absent'
                      ? 'FALTA'
                      : safeShift.attendanceStatus === 'justified'
                        ? 'JUSTIFICADO'
                        : 'PENDENTE'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border ${
                isLightTheme ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white/15 border-white/20 text-white'
              }`}>
                {selectedEmployee?.avatar ? (
                  <img src={selectedEmployee.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black uppercase">
                    {selectedEmployee?.name ? selectedEmployee.name.charAt(0) : <Users className="w-4 h-4" />}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-extrabold truncate ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {selectedEmployee?.name || 'Colaborador não especificado'}
                </div>
                <div className={`text-xs truncate ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                  {selectedEmployee ? `${selectedEmployee.role || 'Colaborador'} • ${selectedEmployee.department || 'Geral'}` : 'Equipe Geral'}
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Informações de Horário: Data, Horário e Carga */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* Card Data */}
            <div className={`p-3 rounded-2xl border flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono ${
                isLightTheme ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                <Calendar className="w-3.5 h-3.5 text-[#de7647]" /> Data
              </div>
              <div className="text-right sm:text-left">
                <div className={`text-sm font-black font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {formattedDate.fullDate}
                </div>
                {formattedDate.weekDay && (
                  <span className={`text-[11px] font-semibold block ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                    {formattedDate.weekDay}
                  </span>
                )}
              </div>
            </div>

            {/* Card Horário */}
            <div className={`p-3 rounded-2xl border flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono ${
                isLightTheme ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                <Clock className="w-3.5 h-3.5 text-[#de7647]" /> Horário
              </div>
              <div className="text-right sm:text-left">
                <div className={`text-sm font-black font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {safeShift.startTime || '08:00'} às {safeShift.endTime || '17:00'}
                </div>
                <span className={`text-[11px] font-semibold block ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Jornada prevista
                </span>
              </div>
            </div>

            {/* Card Carga & Pausa */}
            <div className={`p-3 rounded-2xl border flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono ${
                isLightTheme ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                <Clock3 className="w-3.5 h-3.5 text-[#de7647]" /> Carga / Pausa
              </div>
              <div className="text-right sm:text-left">
                <div className={`text-sm font-black font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {duration}h totais
                </div>
                <span className={`text-[11px] font-semibold block ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                  {breakText}
                </span>
              </div>
            </div>
          </div>

          {/* Cards de Local de Atuação e Orientações do Gestor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {/* Local de Atuação */}
            {isMeeting && safeShift.meetingLink ? (
              <div className={`p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${
                isLightTheme ? 'bg-rose-50/70 border-rose-200' : 'bg-[#96183c]/15 border-[#96183c]/40'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Video className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'}`} />
                    <div className={`text-xs font-bold uppercase tracking-wider font-mono ${
                      isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'
                    }`}>
                      Reunião Online
                    </div>
                  </div>
                  <div className={`text-xs font-medium break-all ${isLightTheme ? 'text-slate-600' : 'text-[#FCEABB]/90'}`}>
                    {safeShift.meetingLink}
                  </div>
                </div>
                <a
                  href={safeShift.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-2 w-full px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    isLightTheme
                      ? 'bg-white hover:bg-rose-50 border-rose-200 text-[#96183c] shadow-2xs'
                      : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                  }`}
                >
                  Abrir Reunião <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className={`p-4 rounded-2xl border space-y-1.5 flex flex-col justify-between ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#de7647]" />
                      <div className={`text-xs font-bold uppercase tracking-wider font-mono ${
                        isLightTheme ? 'text-slate-600' : 'text-zinc-300'
                      }`}>
                        Local de Atuação
                      </div>
                    </div>
                    {workplaceMapsUrl && (
                      <a
                        href={workplaceMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors"
                        title="Abrir no Google Maps"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver Maps</span>
                      </a>
                    )}
                  </div>
                  <div className={`text-sm font-extrabold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {workplaceName}
                  </div>
                </div>
                <p className={`text-xs mt-2 ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                  {workplaceAddress}
                </p>
              </div>
            )}

            {/* Orientações do Gestor */}
            <div className={`p-4 rounded-2xl border space-y-2.5 flex flex-col justify-between ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div>
                <div className={`text-[10px] font-bold uppercase font-mono flex items-center gap-1.5 tracking-wider mb-1.5 ${
                  isLightTheme ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  <Sparkles className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-400' : 'text-zinc-400'}`} /> Orientações do Gestor
                </div>
                <p className={`text-xs sm:text-sm leading-relaxed font-medium ${
                  isLightTheme ? 'text-slate-700' : 'text-zinc-200'
                }`}>
                  {cleanNotes || 'Sem orientações adicionais cadastradas para este turno.'}
                </p>
              </div>

              {safeShift.projectTag && (
                <div className={`border-t pt-2 ${isLightTheme ? 'border-slate-200' : 'border-white/10'}`}>
                  <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${
                    isLightTheme ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/5 text-zinc-300'
                  }`}>
                    Tag: {safeShift.projectTag}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Registros de Ponto Real via GPS (Entrada e Saída) */}
          {(safeShift.checkInTime || safeShift.checkOutTime) && (
            <div className="space-y-2">
              {safeShift.checkInTime && (
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isLightTheme
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}>
                  <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-emerald-600' : 'text-emerald-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs sm:text-sm ${isLightTheme ? 'text-emerald-900' : 'text-emerald-300'}`}>
                        Entrada Registrada às {safeShift.checkInTime}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {safeShift.checkInLocation?.reportedWorkplace || 'GPS Validado'}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300/80'}`}>
                      {safeShift.checkInLocation?.address || workplaceAddress}
                    </p>
                  </div>
                </div>
              )}

              {safeShift.checkOutTime && (
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  isLightTheme
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                }`}>
                  <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-rose-600' : 'text-rose-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs sm:text-sm ${isLightTheme ? 'text-rose-900' : 'text-rose-300'}`}>
                        Saída Registrada às {safeShift.checkOutTime}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        Ponto Fechado
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${isLightTheme ? 'text-rose-700' : 'text-rose-300/80'}`}>
                      {safeShift.checkOutLocation?.address || 'Saída confirmada pelo colaborador'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Identificador de Escala Simples e Discreto */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
            isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                style={{
                  background: scaleInfo.bg,
                  border: `2px solid ${scaleInfo.border}`,
                }}
              />
              <div className="min-w-0">
                <span className={`text-[10px] uppercase font-bold font-mono tracking-wider block ${
                  isLightTheme ? 'text-slate-500' : 'text-zinc-400'
                }`}>
                  Categoria da Escala
                </span>
                <span className={`text-xs sm:text-sm font-bold truncate block ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}>
                  {scaleInfo.category}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Rodapé com botão de fechar */}
        <div className={`p-4 flex items-center justify-end border-t shrink-0 ${
          isLightTheme ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-[#96183C]/25 active:scale-98 bg-[#96183C] hover:bg-[#7e1231] text-white border border-[#96183C]/30"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
