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
  Sparkles
} from 'lucide-react';
import { Shift, Employee } from '../types';
import { calculateShiftDurationHours } from '../utils/dateUtils';

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
  if (!isOpen || !shift) return null;

  const selectedEmployee = employees.find(e => e.id === shift.employeeId);
  const duration = calculateShiftDurationHours(shift.startTime || '08:00', shift.endTime || '17:00', shift.breakMinutes || 60);

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
                Estado da Escala:
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 ${
                isLightTheme
                  ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                  : 'bg-[#96183c]/30 text-[#F89847] border border-[#F89847]/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLightTheme ? 'bg-[#96183c]' : 'bg-[#F89847]'}`}></span> PUBLICADO OFICIAL
              </span>
            </div>
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
                  : 'Lucas Silva -- Analista de Atendimento (Atendimento)'}
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
                    {shift.date || '2026-09-04'}
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

              {/* Color Palette */}
              <div className="flex items-center gap-2 py-1">
                <div className={`w-5 h-5 rounded-full bg-[#831843] ring-2 ring-[#c026d3] ring-offset-2 cursor-default ${
                  isLightTheme ? 'ring-offset-white' : 'ring-offset-[#0a0308]'
                }`}></div>
                <div className="w-5 h-5 rounded-full bg-[#eab308] cursor-default opacity-80"></div>
                <div className="w-5 h-5 rounded-full bg-[#14b8a6] cursor-default opacity-80"></div>
                <div className="w-5 h-5 rounded-full bg-[#7dd3fc] cursor-default opacity-80"></div>
                <div className="w-5 h-5 rounded-full bg-[#8b5cf6] cursor-default opacity-80"></div>
                <div className="w-5 h-5 rounded-full bg-[#d946ef] cursor-default opacity-80"></div>
              </div>

            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Meeting Link */}
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
                  {shift.meetingLink || 'https://meet.google.com/retrospectiva-equipe-shift'}
                </div>
                <a
                  href={shift.meetingLink || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                    isLightTheme
                      ? 'bg-white hover:bg-rose-50 border-rose-200 text-[#96183c] shadow-2xs'
                      : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                  }`}
                >
                  Abrir <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Manager Notes & Project Tag */}
              <div className={`p-4 rounded-xl space-y-3 border ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <div className="space-y-1.5">
                  <div className={`text-[10px] font-bold uppercase font-mono flex items-center gap-1.5 tracking-wider ${
                    isLightTheme ? 'text-slate-500' : 'text-white/60'
                  }`}>
                    <Sparkles className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-400' : 'text-white/50'}`} /> ORIENTAÇÕES DO GESTOR
                  </div>
                  <p className={`text-sm leading-relaxed font-medium ${isLightTheme ? 'text-slate-700' : 'text-white/90'}`}>
                    {shift.notes || 'Revisão dos resultados da semana e alinhamento.'}
                  </p>
                </div>
                <div className={`border-t pt-3 space-y-1.5 ${isLightTheme ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className={`text-[10px] font-bold uppercase font-mono tracking-wider ${
                    isLightTheme ? 'text-slate-500' : 'text-white/60'
                  }`}>
                    PROJETO TAG
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${
                      isLightTheme ? 'border-slate-200 bg-white text-slate-700 shadow-2xs' : 'border-white/10 bg-white/5 text-white/80'
                    }`}>
                      Projeto Alfa
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${
                      isLightTheme ? 'border-slate-200 bg-white text-slate-700 shadow-2xs' : 'border-white/10 bg-white/5 text-white/80'
                    }`}>
                      Projeto Beta
                    </span>
                  </div>
                </div>
              </div>

              {/* GPS Check-in */}
              {shift.checkInTime && (
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  isLightTheme
                    ? 'bg-emerald-50 rounded-xl border-emerald-200 text-emerald-800'
                    : 'bg-[#14532d]/40 rounded-xl border-[#22c55e]/30'
                }`}>
                  <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-emerald-600' : 'text-[#86efac]'}`} />
                  <div>
                    <span className={`font-bold text-sm ${isLightTheme ? 'text-emerald-800' : 'text-[#86efac]'}`}>
                      Ponto Registrado &agrave;s {shift.checkInTime}
                    </span>
                    <p className={`text-[11px] mt-0.5 font-medium ${isLightTheme ? 'text-emerald-700' : 'text-[#bbf7d0]/80'}`}>
                      {shift.checkInLocation?.address || 'Sede Employer - Av. Paulista, 1000 - SP (GPS Validado)'}
                    </p>
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
