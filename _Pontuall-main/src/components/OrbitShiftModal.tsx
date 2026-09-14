import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Pencil, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Tag, 
  Layers, 
  ShieldCheck, 
  Building2, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { Employee, Shift, ShiftType, AttendanceStatus, ShiftStatus, ShiftColor } from '../types';

export const ORBIT_COLORS: ShiftColor[] = [
  { label: "Coral / Vinho", bg: "#96183c", border: "#f89847", text: "#ffffff" },
  { label: "Âmbar / Laranja", bg: "#d97706", border: "#f59e0b", text: "#ffffff" },
  { label: "Esmeralda", bg: "#059669", border: "#10b981", text: "#ffffff" },
  { label: "Azul Oceano", bg: "#0284c7", border: "#38bdf8", text: "#ffffff" },
  { label: "Violeta / Roxo", bg: "#7c3aed", border: "#a78bfa", text: "#ffffff" },
  { label: "Rosa Magenta", bg: "#db2777", border: "#f472b6", text: "#ffffff" },
];

export const SHIFT_TYPES = [
  "Reunião / Alinhamento",
  "Plantão",
  "Home Office",
  "Presencial",
  "Evento",
  "Treinamento",
  "Outro",
];

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
  editingShift: Shift | null;
  employees: Employee[];
  onSave: (shiftData: Partial<Shift> & { id?: string }, notifyEmployee?: boolean, changeReason?: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const OrbitShiftModal: React.FC<OrbitShiftModalProps> = ({
  isOpen,
  initialDate = new Date().toISOString().split('T')[0],
  editingShift,
  employees,
  onSave,
  onDelete,
  onClose,
}) => {
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id || 'emp-1');
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

  // States for published shift view vs edit
  const isAlreadyPublished = Boolean(editingShift && editingShift.status === 'published');
  const [isEditingPublished, setIsEditingPublished] = useState<boolean>(false);
  const [notifyCollaborator, setNotifyCollaborator] = useState<boolean>(true);
  const [changeReason, setChangeReason] = useState<string>('');

  useEffect(() => {
    if (editingShift) {
      setEmployeeId(editingShift.employeeId || employees[0]?.id || 'emp-1');
      
      const mappedType = 
        editingShift.type === 'meeting' ? 'Reunião / Alinhamento' :
        editingShift.type === 'on_call' ? 'Plantão' :
        editingShift.type === 'training' ? 'Treinamento' : 'Presencial';
      
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
      } else if (editingShift.type === 'meeting') {
        setSelectedColor(ORBIT_COLORS[4]);
      } else if (editingShift.type === 'on_call') {
        setSelectedColor(ORBIT_COLORS[1]);
      } else {
        setSelectedColor(ORBIT_COLORS[0]);
      }

      // If the shift is already published, start in View Mode!
      setIsEditingPublished(editingShift.status !== 'published');
      setNotifyCollaborator(true);
      setChangeReason('');
    } else {
      setEmployeeId(employees[0]?.id || 'emp-1');
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
  }, [editingShift, initialDate, employees]);

  if (!isOpen) return null;

  const isEdit = !!editingShift;
  const hoursWorked = calcHours(startTime, endTime, breakTime);
  const assignedEmployee = employees.find(e => e.id === employeeId);

  const handleSaveWithStatus = (forcedStatus?: ShiftStatus) => {
    const finalStatus = forcedStatus || status;
    const breakMins = breakTime === "30min" ? 30 : breakTime === "45min" ? 45
      : breakTime === "1h" ? 60 : breakTime === "1h30" ? 90 : breakTime === "2h" ? 120 : 0;

    let typeMapped: ShiftType = 'regular';
    if (shiftType.includes('Reunião')) typeMapped = 'meeting';
    else if (shiftType.includes('Plantão')) typeMapped = 'on_call';
    else if (shiftType.includes('Treinamento')) typeMapped = 'training';

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
    }, isAlreadyPublished ? notifyCollaborator : false, changeReason);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveWithStatus();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. VIEW MODE: Exibição da Escala Já Publicada (com botão para Editar e aviso)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isAlreadyPublished && !isEditingPublished) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-slate-100 font-sans"
          style={{
            background: "linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)",
            border: "1px solid rgba(150,24,60,0.4)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,152,71,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
            maxHeight: "92vh",
          }}
        >
          {/* Top gradient accent bar (Orbit signature) */}
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #96183c, #f89847, #faf0ac)" }} />

          {/* Header */}
          <div
            className="px-7 py-4.5 flex items-start justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #96183c, #f89847)" }}
              >
                <Calendar className="w-5 h-5 text-[#faf0ac]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <span>Detalhes da Escala Publicada</span>
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Visualização oficial da escala atribuída ao colaborador
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status & Presence row */}
          <div
            className="px-7 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Estado:</span>
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: "rgba(72,187,120,0.2)",
                  color: "#48bb78",
                  border: "1px solid rgba(72,187,120,0.35)"
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#48bb78] animate-pulse" />
                <span>PUBLICADO (OFICIAL)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Presença:</span>
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={presence === "present" ? {
                  background: "rgba(72,187,120,0.2)", color: "#48bb78", border: "1px solid rgba(72,187,120,0.35)"
                } : presence === "absent" ? {
                  background: "rgba(245,101,101,0.2)", color: "#f56565", border: "1px solid rgba(245,101,101,0.35)"
                } : {
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)"
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: presence === "present" ? "#48bb78" : presence === "absent" ? "#f56565" : "rgba(255,255,255,0.3)"
                  }}
                />
                {presence === "present" ? "Presente" : presence === "absent" ? "Ausente" : "Pendente"}
              </span>
            </div>
          </div>

          {/* View Mode Content */}
          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar px-7 py-5 flex flex-col gap-4.5" style={{ maxHeight: "calc(92vh - 210px)" }}>

            {/* Collaborator Card */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-4">
              <img
                src={assignedEmployee?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                alt={assignedEmployee?.name}
                className="w-13 h-13 rounded-full object-cover ring-2 ring-[#f89847]/40 shadow-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-tight truncate">
                    {assignedEmployee?.name || "Colaborador"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f89847]/15 text-[#faf0ac] border border-[#f89847]/30">
                    {assignedEmployee?.department || "Geral"}
                  </span>
                  {assignedEmployee?.contractType && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-slate-300 border border-white/10">
                      {assignedEmployee.contractType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {assignedEmployee?.role || "Função Operacional"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {assignedEmployee?.email} {assignedEmployee?.phone ? `· ${assignedEmployee.phone}` : ''}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Data & Horários */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                  <span>DATA DA ESCALA</span>
                </div>
                <p className="text-sm font-bold text-white">
                  {formatDisplayDate(date)}
                </p>
                <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                  <Clock className="w-3.5 h-3.5 text-[#f89847]" />
                  <span className="text-white font-semibold">{startTime} às {endTime}</span>
                  <span className="text-slate-500">· Intervalo: {breakTime}</span>
                </div>
              </div>

              {/* Carga Horária & Tipo */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5 text-[#f89847]" />
                    <span>TIPO DE ATIVIDADE</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-xs"
                      style={{ background: selectedColor.bg, border: `1px solid ${selectedColor.border}` }}
                    />
                    <span className="text-sm font-bold text-white">
                      {shiftType}
                    </span>
                  </div>
                  {title && (
                    <p className="text-xs text-slate-300 mt-1 italic">
                      "{title}"
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Carga Líquida:</span>
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-extrabold shadow-sm"
                    style={{
                      background: "linear-gradient(135deg, rgba(150,24,60,0.35), rgba(248,152,71,0.25))",
                      border: "1px solid rgba(248,152,71,0.3)",
                      color: "#faf0ac"
                    }}
                  >
                    {hoursWorked}
                  </span>
                </div>
              </div>
            </div>

            {/* Meeting Link (if available) */}
            {meetingLink && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">🔗</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-300">Link da Reunião (Meet / Zoom)</p>
                    <p className="text-[11px] text-emerald-400/80 truncate">{meetingLink}</p>
                  </div>
                </div>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-sm"
                >
                  <span>Acessar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Notes & Tag (if available) */}
            {(notes || tag) && (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#f89847]" />
                    <span>LEMBRETES & OBSERVAÇÕES</span>
                  </span>
                  {tag && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      #{tag}
                    </span>
                  )}
                </div>
                {notes && (
                  <p className="text-xs text-slate-200 mt-1 whitespace-pre-wrap leading-relaxed">
                    {notes}
                  </p>
                )}
              </div>
            )}

            {/* Notice / Transparency Alert */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-300">Escala Oficial Vigente & Transparência</p>
                <p className="text-amber-200/80 mt-1 leading-relaxed">
                  Esta escala já foi publicada e está visível para o colaborador. Caso precise redefinir horários ou datas, clique em <strong>"Editar Escala"</strong>. O colaborador será automaticamente avisado com uma notificação oficial sobre as alterações para garantir transparência e pontualidade na equipe.
                </p>
              </div>
            </div>

          </div>

          {/* View Mode Footer */}
          <div
            className="px-7 py-4.5 flex items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              {onDelete && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80 cursor-pointer"
                  style={{ background: "rgba(245,101,101,0.1)", color: "#f56565", border: "1px solid rgba(245,101,101,0.2)" }}
                >
                  Excluir Escala
                </button>
              )}
              {onDelete && confirmDelete && (
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
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all hover:bg-white/5 cursor-pointer text-slate-300"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPublished(true)}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #96183c 0%, #f89847 100%)",
                  color: "#faf0ac",
                  boxShadow: "0 4px 12px rgba(150,24,60,0.4)"
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar Escala</span>
              </button>
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
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-slate-100 font-sans"
        style={{
          background: "linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)",
          border: "1px solid rgba(150,24,60,0.4)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(248,152,71,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
          maxHeight: "92vh",
        }}
      >
        {/* Top gradient accent bar (Orbit signature) */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #96183c, #f89847, #faf0ac)" }} />

        {/* Header */}
        <div
          className="px-7 py-4.5 flex items-start justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #96183c, #f89847)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#faf0ac">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {isAlreadyPublished ? "Editar Escala Publicada" : isEdit ? "Detalhes do Turno & Atividades" : "Novo Turno & Atividades"}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                {isAlreadyPublished ? "Ajuste os dados e confirme o aviso ao colaborador" : "Gerenciamento de horários e lembretes"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status & Presence row */}
        <div
          className="px-7 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Estado:</span>
            <button
              type="button"
              onClick={() => setStatus(status === "published" ? "draft" : "published")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer hover:scale-105"
              style={status === "published" ? {
                background: "rgba(72,187,120,0.2)",
                color: "#48bb78",
                border: "1px solid rgba(72,187,120,0.35)"
              } : {
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status === "published" ? "#48bb78" : "rgba(255,255,255,0.3)" }}
              />
              {status === "published" ? "PUBLICADO" : "RASCUNHO"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Presença:</span>
            <button
              type="button"
              onClick={() => {
                const cycle: AttendanceStatus[] = ["pending", "present", "absent"];
                const next = cycle[(cycle.indexOf(presence) + 1) % cycle.length];
                setPresence(next);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer hover:scale-105"
              style={presence === "present" ? {
                background: "rgba(72,187,120,0.2)", color: "#48bb78", border: "1px solid rgba(72,187,120,0.35)"
              } : presence === "absent" ? {
                background: "rgba(245,101,101,0.2)", color: "#f56565", border: "1px solid rgba(245,101,101,0.35)"
              } : {
                background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)"
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: presence === "present" ? "#48bb78" : presence === "absent" ? "#f56565" : "rgba(255,255,255,0.3)"
                }}
              />
              {presence === "present" ? "Presente" : presence === "absent" ? "Ausente" : "Pendente"}
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
                style={{ color: "rgba(255,255,255,0.55)" }}
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
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id} style={{ background: "#1a0010", color: "#fff" }}>
                    {emp.name} — {emp.role} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Shift type + Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>
                  TIPO DE TURNO
                </label>
                <select
                  value={shiftType}
                  onChange={e => setShiftType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {SHIFT_TYPES.map(t => (
                    <option key={t} value={t} style={{ background: "#1a0010", color: "#fff" }}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>
                  TÍTULO / IDENTIFICADOR
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Sprint Planning"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
            </div>

            {/* Date + Times */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-6">
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    colorScheme: "dark"
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    colorScheme: "dark"
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    colorScheme: "dark"
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.5)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
            </div>

            {/* Break + Hours badge */}
            <div className="flex items-end gap-3.5">
              <div className="flex-1 min-w-0">
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>Intervalo / Carga</label>
                <select
                  value={breakTime}
                  onChange={e => setBreakTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {BREAK_OPTIONS.map(b => (
                    <option key={b} value={b} style={{ background: "#1a0010", color: "#fff" }}>
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

            {/* Color picker */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: "rgba(255,255,255,0.55)" }}>COR DO TURNO</label>
              <div className="flex items-center gap-2.5">
                {ORBIT_COLORS.map((c) => {
                  const isSelected = selectedColor.label === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-7 h-7 rounded-full transition-all hover:scale-110 relative cursor-pointer ${isSelected ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-[#1a0010]' : 'opacity-85 hover:opacity-100'}`}
                      style={{
                        background: c.bg,
                        border: `2px solid ${c.border}`,
                      }}
                      title={c.label}
                    />
                  );
                })}
              </div>
            </div>

            {/* Meeting Link */}
            <div>
              <label
                className="flex items-center justify-between text-xs font-semibold mb-1.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
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
                className="w-full px-3.5 py-2.5 rounded-xl text-sm placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: "rgba(72,187,120,0.07)",
                  border: "1px solid rgba(72,187,120,0.2)",
                  color: "#48bb78"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(72,187,120,0.5)"}
                onBlur={e => e.target.style.borderColor = "rgba(72,187,120,0.2)"}
              />
            </div>

            {/* Tag + Notes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  ✨ LEMBRETES & ATIVIDADES
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  placeholder="Tag do Projeto"
                  className="w-32 px-2.5 py-1 rounded-lg text-xs text-white placeholder:text-white/25 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}
                />
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Descreva atividades, lembretes ou observações do turno..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
                onFocus={e => e.target.style.borderColor = "rgba(248,152,71,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>

          </div>

          {/* Footer */}
          <div
            className="px-7 py-4.5 flex items-center justify-between gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-2">
              {isAlreadyPublished && (
                <button
                  type="button"
                  onClick={() => setIsEditingPublished(false)}
                  className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/10 hover:border-white/20"
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
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all hover:bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:border-amber-400 cursor-pointer"
                title="Salvar este turno como rascunho"
              >
                Salvar Rascunho
              </button>
              <button
                type="button"
                onClick={() => handleSaveWithStatus('published')}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-lg cursor-pointer flex items-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #96183c 0%, #f89847 100%)",
                  color: "#faf0ac",
                  boxShadow: "0 4px 12px rgba(150,24,60,0.4)"
                }}
              >
                {isAlreadyPublished && notifyCollaborator && <Bell className="w-3.5 h-3.5 animate-bounce" />}
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
