import React from 'react';
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
  Palette,
  Check
} from 'lucide-react';
import { Shift, Employee } from '@/types';
import { calculateShiftDurationHours } from '@/shared/utils/dateUtils';
import { ORBIT_COLORS } from './OrbitShiftModal';

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
  const duration = calculateShiftDurationHours(
    shift.startTime || '08:00',
    shift.endTime || '17:00',
    shift.breakMinutes !== undefined ? shift.breakMinutes : 60
  );

  const formattedDate = React.useMemo(() => {
    if (!shift?.date) return { fullDate: '—', weekDay: '' };
    try {
      const [y, m, d] = shift.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const fullDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      return {
        fullDate,
        weekDay: weekDay.charAt(0).toUpperCase() + weekDay.slice(1),
      };
    } catch {
      return { fullDate: shift.date, weekDay: '' };
    }
  }, [shift?.date]);

  const breakText = React.useMemo(() => {
    if (!shift.breakMinutes || shift.breakMinutes <= 0) return 'Sem intervalo';
    if (shift.breakMinutes >= 60) {
      const hours = (shift.breakMinutes / 60).toFixed(shift.breakMinutes % 60 === 0 ? 0 : 1);
      return `${hours}h de intervalo`;
    }
    return `${shift.breakMinutes}min de intervalo`;
  }, [shift.breakMinutes]);

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

  const isMeeting = shift.type === 'meeting' || Boolean(shift.meetingLink);

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
                background: 'linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)',
                border: '1px solid rgba(150,24,60,0.4)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)'
              }
        }
      >
        {/* Barra superior de destaque em degradê */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]"></div>

        {/* Cabeçalho */}
        <div className={`px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0 border-b ${
          isLightTheme ? 'border-slate-100 bg-slate-50/70' : 'border-white/5 bg-white/[0.02]'
        }`}>
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#96183C] to-[#F89847] flex items-center justify-center shadow-md shadow-[#96183C]/30 shrink-0 border border-[#F89847]/40">
              {isMeeting ? (
                <Video className="w-5 h-5 text-[#FCEABB]" />
              ) : (
                <Calendar className="w-5 h-5 text-[#FCEABB]" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className={`font-black text-base sm:text-lg leading-tight truncate ${
                isLightTheme ? 'text-slate-900' : 'text-white'
              }`}>
                {shift.title || 'Turno de Trabalho'}
              </h3>
              <p className={`text-xs mt-0.5 truncate ${isLightTheme ? 'text-slate-500' : 'text-white/60'}`}>
                {formattedDate.weekDay ? `${formattedDate.weekDay}, ${formattedDate.fullDate}` : 'Detalhes da escala'}
              </p>
            </div>
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
                          ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                          : 'bg-white/10 text-white/70 border-white/15'
                }`}>
                  {shift.attendanceStatus === 'present' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  {shift.attendanceStatus === 'absent' && <XCircle className="w-3 h-3 text-rose-500" />}
                  {shift.attendanceStatus === 'justified' && <FileCheck className="w-3 h-3 text-amber-500" />}
                  {shift.attendanceStatus === 'pending' && <Clock className="w-3 h-3 text-amber-400" />}
                  {shift.attendanceStatus === 'present'
                    ? 'PRESENTE'
                    : shift.attendanceStatus === 'absent'
                      ? 'FALTA'
                      : shift.attendanceStatus === 'justified'
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
                  {selectedEmployee ? `${selectedEmployee.role} • ${selectedEmployee.department}` : 'Equipe Geral'}
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
                  {shift.startTime || '08:00'} às {shift.endTime || '17:00'}
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

          {/* Linha / Cards Adaptativos: Reunião / Local de Atuação e Orientações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {/* Se for reunião: Card de Reunião com link e botão */}
            {isMeeting ? (
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                isLightTheme ? 'bg-rose-50/70 border-rose-200' : 'bg-[#96183c]/20 border-[#96183c]/50'
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
                  <p className={`text-xs font-mono break-all mb-3 ${
                    isLightTheme ? 'text-slate-600' : 'text-white/80'
                  }`}>
                    {shift.meetingLink || 'https://meet.google.com/retrospectiva-equipe-shift'}
                  </p>
                </div>
                <a
                  href={shift.meetingLink || 'https://meet.google.com/retrospectiva-equipe-shift'}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98 ${
                    isLightTheme
                      ? 'bg-[#96183c] hover:bg-[#801433] text-white'
                      : 'bg-gradient-to-r from-[#96183C] to-[#F89847] hover:opacity-95 text-white'
                  }`}
                >
                  Abrir Reunião <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              /* Se for presencial: Card de Local de Atuação */
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <MapPin className={`w-4 h-4 ${isLightTheme ? 'text-[#de7647]' : 'text-[#F89847]'}`} />
                    <div className={`text-xs font-bold uppercase tracking-wider font-mono ${
                      isLightTheme ? 'text-slate-600' : 'text-zinc-300'
                    }`}>
                      Local de Atuação
                    </div>
                  </div>
                  <div className={`text-sm font-extrabold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {shift.workplace || 'Presencial - Sede / Posto Operacional'}
                  </div>
                </div>
                <p className={`text-xs mt-2 ${isLightTheme ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Comparecimento presencial com registro de ponto no local.
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
                  {shift.notes || 'Sem orientações adicionais cadastradas para este turno.'}
                </p>
              </div>

              {shift.projectTag && (
                <div className={`border-t pt-2 ${isLightTheme ? 'border-slate-200' : 'border-white/10'}`}>
                  <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${
                    isLightTheme ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/5 text-zinc-300'
                  }`}>
                    Tag: {shift.projectTag}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GPS Check-in (se houver registro) */}
          {shift.checkInTime && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              isLightTheme
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}>
              <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLightTheme ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <div>
                <span className={`font-bold text-sm ${isLightTheme ? 'text-emerald-900' : 'text-emerald-300'}`}>
                  Ponto Registrado às {shift.checkInTime}
                </span>
                <p className={`text-xs mt-0.5 ${isLightTheme ? 'text-emerald-700' : 'text-emerald-300/80'}`}>
                  {shift.checkInLocation?.address || 'Sede Employer - GPS Validado'}
                </p>
              </div>
            </div>
          )}

          {/* Categoria Visual da Escala - Limpo e Adaptado para Mobile */}
          <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-2.5 ${
            isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-bold uppercase font-mono flex items-center gap-1.5 tracking-wider ${
                isLightTheme ? 'text-slate-500' : 'text-zinc-400'
              }`}>
                <Palette className={`w-3.5 h-3.5 ${isLightTheme ? 'text-slate-400' : 'text-zinc-400'}`} /> Categoria da Escala
              </span>

              {/* Bolinhas de cores em linha única sem quebra */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {ORBIT_COLORS.map((c) => {
                  const isSelected = selectedColor.label === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all relative cursor-pointer flex items-center justify-center ${
                        isSelected 
                          ? isLightTheme
                            ? 'scale-110 ring-2 ring-[#640C1E] ring-offset-2 ring-offset-white shadow-sm'
                            : 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0a0308] shadow-md shadow-black/50'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{
                        background: c.bg,
                        border: `2px solid ${c.border}`,
                      }}
                      title={`${c.label} • ${c.category || ''}`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white stroke-[3] drop-shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card com a categoria selecionada */}
            <div 
              className="p-3 rounded-xl border flex items-center gap-3 transition-all"
              style={{
                background: isLightTheme 
                  ? `${selectedColor.bg}12` 
                  : `${selectedColor.bg}22`,
                borderColor: isLightTheme 
                  ? `${selectedColor.bg}35` 
                  : `${selectedColor.border}50`,
              }}
            >
              <div 
                className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-xs"
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
                    className="text-xs font-black"
                    style={{ color: isLightTheme ? selectedColor.bg : '#ffffff' }}
                  >
                    {selectedColor.category || selectedColor.label}
                  </span>
                  <span 
                    className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
                    style={{
                      background: isLightTheme ? '#ffffff' : 'rgba(0,0,0,0.3)',
                      color: isLightTheme ? '#475569' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {selectedColor.label}
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 leading-snug truncate sm:whitespace-normal ${
                  isLightTheme ? 'text-slate-600' : 'text-zinc-300'
                }`}>
                  {selectedColor.description || 'Identificação visual no calendário.'}
                </p>
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
