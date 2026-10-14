import React from 'react';
import { 
  X, 
  Clock, 
  Users, 
  Video, 
  ExternalLink,
  Calendar,
  CheckCircle2,
  XCircle,
  FileCheck,
  MapPin,
  Sparkles,
  Palette,
  Check
} from 'lucide-react';
import { Shift, Employee } from '@/types';
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
  const selectedEmployee = employees.find(e => e.id === shift?.employeeId);
  const duration = calculateShiftDurationHours(shift?.startTime || '08:00', shift?.endTime || '17:00', shift?.breakMinutes || 60);

  const assignedWorkplace = shift?.workplaceLocation || findWorkplaceByName(shift?.workplace || selectedEmployee?.workplace);
  const isRemote = assignedWorkplace?.isRemote || 
    shift?.workplace?.toLowerCase().includes('remoto') || 
    shift?.workplace?.toLowerCase().includes('home office') ||
    selectedEmployee?.workplace?.toLowerCase().includes('remoto') ||
    selectedEmployee?.workplace?.toLowerCase().includes('home office');

  const workplaceMapsUrl = assignedWorkplace?.latitude && assignedWorkplace?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${assignedWorkplace.latitude},${assignedWorkplace.longitude}`
    : assignedWorkplace?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedWorkplace.address)}`
    : null;

  const initialColor = React.useMemo(() => {
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

  const [selectedColor, setSelectedColor] = React.useState(initialColor);

  React.useEffect(() => {
    setSelectedColor(initialColor);
  }, [initialColor]);

  if (!isOpen || !shift) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/70 backdrop-blur-md'} animate-in fade-in duration-200`}>
      <div
        className={`relative rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isLightTheme ? 'bg-white border border-slate-200 text-slate-800' : 'text-white'
        }`}
        style={
          isLightTheme
            ? {
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
              }
            : {
                background: 'linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)',
                border: '1px solid rgba(150,24,60,0.4)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)'
              }
        }
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]"></div>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between flex-shrink-0 border-b ${
          isLightTheme ? 'border-slate-100 bg-slate-50/60' : 'border-white/5 bg-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96183C] to-[#F89847] flex items-center justify-center shadow-lg shadow-[#96183C]/20 border border-[#F89847]/40">
              {shift.type === 'meeting' ? <Video className="w-5 h-5 text-[#FCEABB]" /> : <Calendar className="w-5 h-5 text-[#FCEABB]" />}
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                {shift.title || 'Retrospectiva Semanal de Equipe'}
              </h3>
              <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                Hor&aacute;rio, atividades e confirma&ccedil;&atilde;o de presen&ccedil;a
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLightTheme
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`p-5 overflow-y-auto space-y-4 flex-1 ${isLightTheme ? 'text-slate-800' : 'text-white'}`}>

          {/* Status & Attendance Badges */}
          <div className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border ${
            isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold ${isLightTheme ? 'text-slate-600' : 'text-white/60'}`}>
                Presen&ccedil;a:
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                shift.attendanceStatus === 'present' ? (isLightTheme ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-[#96183c]/40 text-[#FCEABB] border border-[#96183c]') :
                shift.attendanceStatus === 'absent' ? (isLightTheme ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-[#7f1d1d]/40 text-[#fecdd3] border border-[#b91c1c]') :
                shift.attendanceStatus === 'justified' ? (isLightTheme ? 'bg-amber-50 text-amber-800 border border-amber-300' : 'bg-[#78350f]/40 text-[#fde68a] border border-[#f59e0b]') :
                (isLightTheme ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-white/10 text-white/70 border border-white/20')
              }`}>
                {shift.attendanceStatus === 'present' && <CheckCircle2 className={`w-3 h-3 ${isLightTheme ? 'text-emerald-600' : 'text-[#FCEABB]'}`} />}
                {shift.attendanceStatus === 'absent' && <XCircle className="w-3 h-3 text-rose-600" />}
                {shift.attendanceStatus === 'justified' && <FileCheck className="w-3 h-3 text-amber-600" />}
                {shift.attendanceStatus === 'pending' && <Clock className={`w-3 h-3 ${isLightTheme ? 'text-slate-500' : 'text-white/70'}`} />}
                {shift.attendanceStatus === 'present' ? 'PRESENTE' :
                 shift.attendanceStatus === 'absent' ? 'FALTA' :
                 shift.attendanceStatus === 'justified' ? 'JUSTIFICADO' : 'PENDENTE'}
              </span>
            </div>
          </div>

          {/* Employee */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-500' : 'text-white/60'
            }`}>
              COLABORADOR(A) ATRIBU&Iacute;DO(A)
            </label>
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center shrink-0 border ${
                isLightTheme ? 'bg-slate-200 border-slate-300' : 'bg-white/20 border-white/30'
              }`}>
                {selectedEmployee?.avatar ? (
                  <img src={selectedEmployee.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Users className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-600' : 'text-white/70'}`} />
                )}
              </div>
              <div className={`text-sm font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                {selectedEmployee
                  ? `${selectedEmployee.name} -- ${selectedEmployee.role} (${selectedEmployee.department})`
                  : 'Colaborador não especificado'}
              </div>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-2 gap-4">

            {/* Left column */}
            <div className="space-y-4">

              {/* Date / Time / Break */}
              <div className={`p-4 rounded-xl space-y-3 border ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <div>
                  <div className={`text-[10px] font-bold mb-1 flex items-center gap-1.5 font-mono ${
                    isLightTheme ? 'text-slate-500' : 'text-white/50'
                  }`}>
                    <Calendar className={`w-3 h-3 ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`} /> Data
                  </div>
                  <div className={`text-sm font-bold font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {shift.date ? shift.date.split('-').reverse().join('/') : '—'}
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] font-bold mb-1 flex items-center gap-1.5 font-mono ${
                    isLightTheme ? 'text-slate-500' : 'text-white/50'
                  }`}>
                    <Clock className={`w-3 h-3 ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`} /> Hor&aacute;rio
                  </div>
                  <div className={`text-sm font-bold font-mono ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {shift.startTime || '08:00'} -- {shift.endTime || '17:00'}
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] font-bold mb-1 font-mono ${
                    isLightTheme ? 'text-slate-500' : 'text-white/50'
                  }`}>
                    Intervalo / Carga
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 cursor-default border ${
                      isLightTheme ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/70'
                    }`}>
                      1h <span className="text-[8px] ml-1 opacity-50">v</span>
                    </div>
                    <div className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      isLightTheme ? 'bg-slate-200/80 text-slate-800 border-slate-300' : 'bg-white/10 text-white/70 border-white/10'
                    }`}>
                      {duration}h
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Palette & Legend */}
              <div className="space-y-2">
                <div className={`text-[10px] font-bold uppercase font-mono flex items-center justify-between tracking-wider ${
                  isLightTheme ? 'text-slate-500' : 'text-white/60'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Palette className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-400' : 'text-white/50'}`} /> COR & CATEGORIA DA ESCALA
                  </span>
                  <span className="text-[9px] font-normal normal-case opacity-75">
                    Toque para inspecionar
                  </span>
                </div>

                {/* Botões de seleção de cores */}
                <div className="flex items-center gap-2 flex-wrap">
                  {ORBIT_COLORS.map((c) => {
                    const isSelected = selectedColor.label === c.label;
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-7 h-7 rounded-full transition-all relative cursor-pointer flex items-center justify-center ${
                          isSelected 
                            ? isLightTheme
                              ? 'scale-110 ring-2 ring-[#640C1E] ring-offset-2 ring-offset-white shadow-md'
                              : 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0a0308] shadow-md shadow-black/50'
                            : 'opacity-85 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{
                          background: c.bg,
                          border: `2px solid ${c.border}`,
                        }}
                        title={`${c.label} • ${c.category || ''}`}
                      >
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-xs" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Card dinâmico com o significado / legenda da cor selecionada */}
                <div 
                  className="mt-2.5 p-3 rounded-xl border flex items-start gap-3 transition-all animate-in fade-in duration-150"
                  style={{
                    background: isLightTheme 
                      ? `${selectedColor.bg}12` 
                      : `${selectedColor.bg}22`,
                    borderColor: isLightTheme 
                      ? `${selectedColor.bg}40` 
                      : `${selectedColor.border}50`,
                  }}
                >
                  <div 
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-xs mt-0.5"
                    style={{
                      background: `linear-gradient(135deg, ${selectedColor.bg}, ${selectedColor.border})`,
                      color: '#ffffff',
                    }}
                  >
                    <Palette className="w-4 h-4" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span 
                        className="text-xs font-extrabold"
                        style={{ color: isLightTheme ? selectedColor.bg : '#ffffff' }}
                      >
                        {selectedColor.category || selectedColor.label}
                      </span>
                      <span 
                        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md"
                        style={{
                          background: isLightTheme ? '#ffffff' : 'rgba(0,0,0,0.35)',
                          border: `1px solid ${selectedColor.border}66`,
                          color: isLightTheme ? '#475569' : 'rgba(255,255,255,0.75)',
                        }}
                      >
                        {selectedColor.label}
                      </span>
                    </div>
                    
                    <p className={`text-xs mt-1 leading-relaxed ${
                      isLightTheme ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      {selectedColor.description || "Indica a categoria visual desta escala no calendário e grade."}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Meeting Link (apenas se existir link de verdade cadastrado pelo gestor) */}
              {shift.meetingLink && shift.meetingLink.trim() !== '' && (
                <div className={`p-3 rounded-xl border ${
                  isLightTheme ? 'bg-rose-50/70 border-rose-200' : 'bg-[#96183c]/20 border-[#96183c]/50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Video className={`w-4 h-4 ${isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'}`} />
                    <div className={`text-sm font-bold ${isLightTheme ? 'text-[#96183c]' : 'text-[#F89847]'}`}>
                      Reunião / Link Online
                    </div>
                  </div>
                  <div className={`text-[11px] font-medium tracking-wide mb-3 break-all ${
                    isLightTheme ? 'text-slate-600' : 'text-[#FCEABB]/90'
                  }`}>
                    {shift.meetingLink}
                  </div>
                  <a
                    href={shift.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                      isLightTheme
                        ? 'bg-white hover:bg-rose-50 border-rose-200 text-[#96183c] shadow-2xs'
                        : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                    }`}
                  >
                    Abrir Reunião <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Manager Notes & Project Tag (apenas se existirem dados reais) */}
              {(shift.notes || shift.projectTag) && (
                <div className={`p-4 rounded-xl space-y-3 border ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}>
                  {shift.notes && (
                    <div className="space-y-1.5">
                      <div className={`text-[10px] font-bold uppercase font-mono flex items-center gap-1.5 tracking-wider ${
                        isLightTheme ? 'text-slate-500' : 'text-white/60'
                      }`}>
                        <Sparkles className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-400' : 'text-white/50'}`} /> ORIENTAÇÕES DO GESTOR
                      </div>
                      <p className={`text-sm leading-relaxed font-medium ${isLightTheme ? 'text-slate-700' : 'text-white/90'}`}>
                        {shift.notes}
                      </p>
                    </div>
                  )}
                  {shift.projectTag && (
                    <div className={`border-t pt-3 space-y-1.5 ${isLightTheme ? 'border-slate-200' : 'border-white/10'}`}>
                      <div className={`text-[10px] font-bold uppercase font-mono tracking-wider ${
                        isLightTheme ? 'text-slate-500' : 'text-white/60'
                      }`}>
                        PROJETO / TAG
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${
                          isLightTheme ? 'border-slate-200 bg-white text-slate-700 shadow-2xs' : 'border-white/10 bg-white/5 text-white/80'
                        }`}>
                          {shift.projectTag}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Local de Trabalho / Posto da Escala */}
              <div className={`p-4 rounded-xl space-y-2 border ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <div className={`text-[10px] font-bold uppercase font-mono flex items-center justify-between tracking-wider ${
                  isLightTheme ? 'text-slate-500' : 'text-white/60'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#f89847]" /> LOCAL DE TRABALHO / UNIDADE
                  </span>
                  {workplaceMapsUrl && !isRemote && (
                    <a
                      href={workplaceMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                      title="Abrir rota no Google Maps"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver no Maps</span>
                    </a>
                  )}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {assignedWorkplace?.name || shift.workplace || selectedEmployee?.workplace || 'Posto Presencial'}
                  </h4>
                  <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-slate-600' : 'text-slate-300'}`}>
                    {assignedWorkplace?.address || 'Endereço fornecido pelo Gestor'}
                  </p>
                </div>
                <div className="pt-1.5 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isRemote
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {isRemote ? '🏠 Home Office / Remoto (Raio Livre)' : `🏢 Presencial (Tolerância: ${assignedWorkplace?.radiusMeters || 200}m)`}
                  </span>
                </div>
              </div>

              {/* GPS Check-in (Entrada) */}
              {(shift.checkInTime || shift.attendanceStatus === 'present') && (
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                  shift.checkInLocation?.gpsValidated !== false
                    ? (isLightTheme ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/30 text-white')
                    : (isLightTheme ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-500/30 text-white')
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      Entrada às {shift.checkInTime || 'Horário gravado'}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      shift.checkInLocation?.reportedWorkplace
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                        : shift.checkInLocation?.gpsValidated !== false
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                    }`}>
                      {shift.checkInLocation?.reportedWorkplace
                        ? `📌 ${shift.checkInLocation.reportedWorkplace}`
                        : shift.checkInLocation?.gpsValidated !== false
                        ? '🟢 GPS Validado'
                        : `🟡 Fora (${shift.checkInLocation?.distanceMeters ? `${shift.checkInLocation.distanceMeters}m` : ''})`}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium leading-relaxed opacity-90 truncate">
                    {shift.checkInLocation?.address || 'Localização capturada via GPS'}
                  </div>
                </div>
              )}

              {/* GPS Check-out (Saída) */}
              {shift.checkOutTime && (
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${
                  shift.checkOutLocation?.gpsValidated !== false
                    ? (isLightTheme ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/30 text-white')
                    : (isLightTheme ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-500/30 text-white')
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-500" />
                      Saída às {shift.checkOutTime}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      shift.checkOutLocation?.gpsValidated !== false
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                    }`}>
                      {shift.checkOutLocation?.gpsValidated !== false
                        ? '🟢 GPS Validado'
                        : `🟡 Fora (${shift.checkOutLocation?.distanceMeters ? `${shift.checkOutLocation.distanceMeters}m` : ''})`}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium leading-relaxed opacity-90 truncate">
                    {shift.checkOutLocation?.address || 'Localização capturada via GPS'}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <div className={`pt-3 flex items-center justify-end border-t ${
            isLightTheme ? 'border-slate-100' : 'border-white/5'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 font-bold text-xs rounded-xl transition-colors cursor-pointer border ${
                isLightTheme
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs'
                  : 'bg-transparent text-[#FCEABB] hover:bg-white/5 border-[#FCEABB]/40'
              }`}
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
