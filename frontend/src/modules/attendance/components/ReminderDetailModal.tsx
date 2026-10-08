import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Copy,
  Check,
  Users,
  FileText,
  Tag,
  AlertTriangle,
  GraduationCap,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { ManagerReminder, Employee } from '@/types';

interface ReminderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ManagerReminder | null;
  employees?: Employee[];
  currentEmployee?: Employee;
  isLightTheme?: boolean;
}

export const ReminderDetailModal: React.FC<ReminderDetailModalProps> = ({
  isOpen,
  onClose,
  reminder,
  employees = [],
  currentEmployee,
  isLightTheme = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  // Close on Escape key press
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

  if (!isOpen || !reminder) return null;

  const handleCopyLink = () => {
    if (!reminder.link) return;
    navigator.clipboard.writeText(reminder.link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'reuniao':
      case 'meeting':
        return {
          label: 'Reunião',
          icon: <Video className="w-4 h-4 text-purple-300" />,
          accentColor: '#7c5cbf',
          badgeBg: isLightTheme ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-950/50 text-purple-300 border-purple-500/30',
        };
      case 'plantao':
      case 'on_call':
        return {
          label: 'Plantão',
          icon: <ShieldAlert className="w-4 h-4 text-amber-300" />,
          accentColor: '#b58e1a',
          badgeBg: isLightTheme ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-950/50 text-amber-300 border-amber-500/30',
        };
      case 'treinamento':
      case 'training':
        return {
          label: 'Treinamento',
          icon: <GraduationCap className="w-4 h-4 text-cyan-300" />,
          accentColor: '#2d7fa8',
          badgeBg: isLightTheme ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 'bg-cyan-950/50 text-cyan-300 border-cyan-500/30',
        };
      case 'alert':
        return {
          label: 'Aviso Importante',
          icon: <AlertTriangle className="w-4 h-4 text-rose-300" />,
          accentColor: '#e11d48',
          badgeBg: isLightTheme ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-rose-950/50 text-rose-300 border-rose-500/30',
        };
      default:
        return {
          label: 'Atividade',
          icon: <Sparkles className="w-4 h-4 text-orange-300" />,
          accentColor: '#f97316',
          badgeBg: isLightTheme ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-orange-950/50 text-orange-300 border-orange-500/30',
        };
    }
  };

  const typeConfig = getTypeConfig(reminder.type);

  // Resolving allocated participants
  const assignedIds = reminder.assignedEmployeeIds || [];
  const assignedEmployees = assignedIds
    .map(id => employees.find(e => e.id === id))
    .filter(Boolean) as Employee[];

  // Format date DD/MM/YYYY if formatted as YYYY-MM-DD
  const formattedDate = (() => {
    if (!reminder.date) return 'Data não informada';
    if (reminder.date.includes('-')) {
      const parts = reminder.date.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return reminder.date;
  })();

  const currentTag = reminder.tag || reminder.projectTag;

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
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md border"
              style={{
                background: isLightTheme
                  ? 'linear-gradient(135deg, #96183C 0%, #ba254d 100%)'
                  : 'linear-gradient(135deg, #96183c 0%, #5e0d22 100%)',
                borderColor: 'rgba(248, 150, 66, 0.4)',
              }}
            >
              {typeConfig.icon}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeConfig.badgeBg}`}
                >
                  {typeConfig.label}
                </span>

                {currentTag && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLightTheme
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    <Tag className="w-3 h-3 opacity-60" />
                    {currentTag}
                  </span>
                )}

                {reminder.completed && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLightTheme
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Concluído
                  </span>
                )}
              </div>

              <h2
                className={`font-black text-lg leading-tight break-words ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}
              >
                {reminder.title}
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
                    {formattedDate}
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
                    {reminder.time || 'Não especificado'}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                  reminder.completed
                    ? isLightTheme
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-white/5 text-white/50 border-white/10'
                    : isLightTheme
                    ? 'bg-[#faf0ac] text-[#96183c] border-[#f89642]/40'
                    : 'bg-[#96183c]/30 text-[#f89642] border-[#f89642]/30'
                }`}
              >
                {reminder.completed ? 'COMPROMISSO ENCERRADO' : 'EM ABERTO / AGENDADO'}
              </span>
            </div>
          </div>

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
              {reminder.description && reminder.description.trim().length > 0 ? (
                reminder.description
              ) : (
                <span className={`italic text-xs ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`}>
                  Nenhuma descrição adicional foi informada pela gestão para este lembrete.
                </span>
              )}
            </div>
          </div>

          {/* Meeting / External Link Section */}
          {reminder.link && (
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
                      href={reminder.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-300 hover:underline truncate block"
                      title={reminder.link}
                    >
                      {reminder.link}
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
                    href={reminder.link}
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
                {assignedEmployees.length > 0
                  ? `${assignedEmployees.length} participante(s)`
                  : assignedIds.length > 0
                  ? `${assignedIds.length} participante(s)`
                  : 'Equipe Geral'}
              </span>
            </div>

            {assignedEmployees.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
                {assignedEmployees.map(person => {
                  const isCurrent = currentEmployee && (currentEmployee.id === person.id || currentEmployee.email === person.email);
                  return (
                    <div
                      key={person.id}
                      className={`p-2.5 rounded-2xl border flex items-center gap-3 transition-colors ${
                        isCurrent
                          ? isLightTheme
                            ? 'bg-rose-50/60 border-rose-200'
                            : 'bg-[#96183c]/15 border-[#96183c]/40'
                          : isLightTheme
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {person.avatar ? (
                          <img
                            src={person.avatar}
                            alt={person.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                              isLightTheme ? 'bg-[#96183c] text-white' : 'bg-[#f89642] text-slate-950'
                            }`}
                          >
                            {person.name ? person.name.slice(0, 2) : 'CL'}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-bold truncate ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                            {person.name}
                          </p>
                          {isCurrent && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#96183c] text-white shrink-0">
                              Você
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] truncate ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                          {person.role || 'Colaborador'} {person.department ? `• ${person.department}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : assignedIds.length > 0 ? (
              // When employee objects weren't found in memory but IDs exist
              <div
                className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isLightTheme ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-white/70'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                    {reminder.assigneeName || `${assignedIds.length} colaborador(es) alocado(s)`}
                  </p>
                  <p className={`text-[10px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                    Membros da equipe selecionados para este compromisso.
                  </p>
                </div>
              </div>
            ) : (
              // General team assignment
              <div
                className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    isLightTheme ? 'bg-amber-100 text-[#96183c]' : 'bg-[#f89642]/15 text-[#f89642]'
                  }`}
                >
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                      {reminder.assigneeName || 'Equipe Geral (Todos)'}
                    </p>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isLightTheme ? 'bg-amber-200 text-amber-900' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      Geral
                    </span>
                  </div>
                  <p className={`text-[11px] ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                    Este lembrete foi compartilhado com todos os colaboradores da empresa/equipe.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-end gap-2.5 shrink-0 ${
            isLightTheme ? 'border-slate-100 bg-slate-50/70' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              isLightTheme
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            Fechar
          </button>

          {reminder.link && (
            <a
              href={reminder.link}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2 bg-gradient-to-r from-[#96183c] via-[#b32047] to-[#f89642] hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-[#96183c]/20 transition-all"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Entrar na Reunião</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
