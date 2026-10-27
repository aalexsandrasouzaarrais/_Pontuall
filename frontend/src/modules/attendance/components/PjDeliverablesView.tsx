import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Briefcase, 
  Clock, 
  Plus, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Upload, 
  X, 
  Eye, 
  Send,
  ChevronDown,
  ChevronUp,
  Timer,
  Check,
  FileSpreadsheet,
  History,
  DollarSign,
  Calculator,
  Bell,
  Video,
  ArrowUpRight,
  Lock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  GripHorizontal,
  ListTodo,
  CheckSquare
} from 'lucide-react';
import { Employee, PjDeliverableReport, PjReportLink, PjTimesheetEntry, ManagerReminder } from '@/types';
import { 
  getPjReportsSupabase, 
  createPjReportSupabase,
  getDraftTimesheet,
  syncDraftTimesheetFromSupabase,
  saveDraftTimesheetToSupabase,
  deleteDraftTimesheetEntry,
  clearDraftTimesheet,
  clearDraftTimesheetSupabase,
  exportPjTimesheetSpreadsheet
} from '@/modules/attendance/services/pjReportService';
import {
  PjPrivateScheduleBlock,
  getPjPrivateScheduleLocal,
  syncPjPrivateScheduleFromSupabase,
  addPjPrivateScheduleBlock,
  deletePjPrivateScheduleBlock
} from '@/modules/attendance/services/pjNotesService';
import { PjTimesheetTracker } from './PjTimesheetTracker';
import { PjNotepadSection } from './PjNotepadSection';
import { ReminderDetailModal } from './ReminderDetailModal';
import { getTodayDateString } from '@/shared/utils/dateUtils';

interface PjDeliverablesViewProps {
  employee: Employee;
  isDark?: boolean;
  activeSubView?: 'overview' | 'timesheet';
  reminders?: ManagerReminder[];
  employees?: Employee[];
  onNavigateToCalendar?: () => void;
  onNavigateToTimesheet?: () => void;
  onReportCreated?: (report: PjDeliverableReport) => void;
}

export const PjDeliverablesView: React.FC<PjDeliverablesViewProps> = ({
  employee,
  isDark = true,
  activeSubView = 'overview',
  reminders = [],
  employees = [],
  onNavigateToCalendar,
  onNavigateToTimesheet,
  onReportCreated,
}) => {
  const [reports, setReports] = useState<PjDeliverableReport[]>([]);
  const [draftEntries, setDraftEntries] = useState<PjTimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<ManagerReminder | null>(null);

  // Escala Pessoal Privada do PJ & Calendário Interativo
  const [privateSchedule, setPrivateSchedule] = useState<PjPrivateScheduleBlock[]>(() =>
    getPjPrivateScheduleLocal(employee.id)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(getTodayDateString());
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => new Date());
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [isAllRemindersOpen, setIsAllRemindersOpen] = useState(false);
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [schedDate, setSchedDate] = useState(getTodayDateString());
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('18:00');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedNotes, setSchedNotes] = useState('');

  // Formulário de Fechamento / Envio ao Gestor
  const currentMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  const formattedDefaultPeriod = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const [period, setPeriod] = useState(formattedDefaultPeriod);
  const [hoursWorked, setHoursWorked] = useState<string>('0');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<PjReportLink[]>([{ title: '', url: '' }]);
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCC = employee.department 
    ? `CC-${employee.department.toUpperCase().slice(0, 4)}-01 • ${employee.department}`
    : 'CC-TI-01 • Tecnologia & Dev';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, drafts, syncedSched] = await Promise.all([
        getPjReportsSupabase(employee.id),
        syncDraftTimesheetFromSupabase(employee.id),
        syncPjPrivateScheduleFromSupabase(employee.id)
      ]);
      setReports(data);
      setDraftEntries(drafts);
      setPrivateSchedule(syncedSched);
    } catch (err) {
      console.warn('Erro ao carregar dados PJ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employee.id]);

  // Atualiza rascunhos quando uma nova entrada é adicionada via PjTimesheetTracker
  const handleEntryAdded = (newEntry: PjTimesheetEntry) => {
    const updated = [newEntry, ...draftEntries.filter(e => e.id !== newEntry.id)];
    setDraftEntries(updated);
    saveDraftTimesheetToSupabase(employee.id, updated);
  };

  const handleDeleteDraftEntry = (id: string) => {
    if (window.confirm('Excluir esta atividade do seu timesheet em aberto?')) {
      const updated = deleteDraftTimesheetEntry(employee.id, id);
      setDraftEntries(updated);
    }
  };

  // Cálculo total de horas no rascunho em aberto
  const totalDraftHours = useMemo(() => {
    return Number(draftEntries.reduce((acc, curr) => acc + (Number(curr.durationHours) || 0), 0).toFixed(2));
  }, [draftEntries]);

  // Métricas de relatórios enviados
  const totalHoursApproved = Number(
    reports
      .filter(r => r.status === 'approved')
      .reduce((acc, curr) => acc + curr.hoursWorked, 0)
      .toFixed(2)
  );

  const totalHoursPendingApproval = Number(
    reports
      .filter(r => r.status === 'pending')
      .reduce((acc, curr) => acc + curr.hoursWorked, 0)
      .toFixed(2)
  );

  const totalWorkedHoursCombined = Number((totalDraftHours + totalHoursApproved + totalHoursPendingApproval).toFixed(2));

  // Parâmetros Contratuais definidos pelo Gestor no cadastro do Colaborador PJ
  const contractedHourlyRate = Number(employee.hourlyRate) > 0 ? Number(employee.hourlyRate) : 85;
  const contractedMonthlyQuota = Number(employee.monthlyHoursQuota) > 0 ? Number(employee.monthlyHoursQuota) : 160;

  // Estados da Calculadora de Recebimento do Colaborador PJ (Simulador independente)
  const [hasUserEditedSimHours, setHasUserEditedSimHours] = useState(false);
  const [simulatedHours, setSimulatedHours] = useState<string>(() =>
    totalWorkedHoursCombined > 0 ? String(totalWorkedHoursCombined) : '0'
  );

  useEffect(() => {
    if (!hasUserEditedSimHours) {
      setSimulatedHours(totalWorkedHoursCombined > 0 ? String(totalWorkedHoursCombined) : '0');
    }
  }, [totalWorkedHoursCombined, hasUserEditedSimHours]);

  const parsedSimHours = Math.max(0, Number(String(simulatedHours).replace(',', '.')) || 0);
  const simulatedEarnings = parsedSimHours * contractedHourlyRate;
  const openTimesheetEarnings = totalDraftHours * contractedHourlyRate;
  const approvedEarnings = totalHoursApproved * contractedHourlyRate;
  const fullQuotaEarnings = contractedMonthlyQuota * contractedHourlyRate;

  // PROGRESSO REAL DO FATURAMENTO: Calculado estritamente pelas horas reais trabalhadas (em aberto + em aprovação + aprovadas)
  const realHoursTotal = totalWorkedHoursCombined;
  const realRemainingHoursToQuota = Math.max(0, Number((contractedMonthlyQuota - realHoursTotal).toFixed(2)));
  const realQuotaProgressPercent = Math.min(100, Math.round((realHoursTotal / Math.max(1, contractedMonthlyQuota)) * 100));

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Adicionar bloco na escala pessoal privada
  const handleAddPrivateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDate = schedDate || selectedCalendarDate;
    if (!targetDate || !schedStart || !schedEnd) return;
    const updated = await addPjPrivateScheduleBlock(employee.id, {
      date: targetDate,
      startTime: schedStart,
      endTime: schedEnd,
      title: schedTitle.trim() || 'Horário de Trabalho',
      notes: schedNotes.trim() || undefined,
    });
    setPrivateSchedule(updated);
    setSchedTitle('');
    setSchedNotes('');
    setIsAddScheduleOpen(false);
  };

  const handleRemovePrivateSchedule = async (blockId: string) => {
    const updated = await deletePjPrivateScheduleBlock(employee.id, blockId);
    setPrivateSchedule(updated);
  };

  // Navegação e Métodos do Calendário PJ (Substituto da Escala Pessoal - Estilo Neutro)
  const handlePrevMonth = () => {
    setCalendarMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formattedCalendarHeader = useMemo(() => {
    if (!selectedCalendarDate) return '23 de Outubro, Sexta-feira';
    const [y, m, d] = selectedCalendarDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    const weekDayStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedWeekday = weekDayStr.charAt(0).toUpperCase() + weekDayStr.slice(1);
    return `${capitalizedMonth}, ${d} ${capitalizedWeekday}`;
  }, [selectedCalendarDate]);

  const calendarGridDays = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Domingo

    const startDate = new Date(year, month, 1 - startDayOfWeek);
    const todayStr = getTodayDateString();
    const days = [];

    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${day}`;

      const isCurrentMonth = d.getMonth() === month;
      const isToday = dateString === todayStr;
      const isSelected = dateString === selectedCalendarDate;
      const hasSchedule = privateSchedule.some(s => s.date === dateString);
      const hasReminder = reminders.some(r => r.date === dateString);

      days.push({
        date: d,
        dateString,
        dayNumber: d.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        hasSchedule,
        hasReminder,
      });
    }

    return days;
  }, [calendarMonthDate, selectedCalendarDate, privateSchedule, reminders]);

  const selectedDayScheduleItems = useMemo(() => {
    return privateSchedule
      .filter(s => s.date === selectedCalendarDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [privateSchedule, selectedCalendarDate]);

  const selectedDayReminderItems = useMemo(() => {
    return reminders.filter(r => r.date === selectedCalendarDate);
  }, [reminders, selectedCalendarDate]);

  // Lista unificada e ordenada de itens da escala e lembretes para a timeline do dia
  const dayTimelineEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      type: 'schedule' | 'reminder';
      startTime: string;
      endTime?: string;
      title: string;
      link?: string;
      canDelete: boolean;
    }> = [];

    selectedDayScheduleItems.forEach(s => {
      entries.push({
        id: s.id,
        type: 'schedule',
        startTime: s.startTime,
        endTime: s.endTime,
        title: s.title,
        canDelete: true,
      });
    });

    selectedDayReminderItems.forEach(r => {
      entries.push({
        id: r.id,
        type: 'reminder',
        startTime: r.time,
        title: r.title,
        link: r.link,
        canDelete: false,
      });
    });

    return entries.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDayScheduleItems, selectedDayReminderItems]);

  const scheduleColorStyles = [
    {
      card: isDark ? 'bg-emerald-950/25 border-emerald-500/25 text-emerald-300' : 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
      badge: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800',
    },
    {
      card: isDark ? 'bg-amber-950/25 border-amber-500/25 text-amber-300' : 'bg-amber-50/80 border-amber-200 text-amber-900',
      badge: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800',
    },
    {
      card: isDark ? 'bg-purple-950/25 border-purple-500/25 text-purple-300' : 'bg-purple-50/80 border-purple-200 text-purple-900',
      badge: isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-800',
    },
  ];

  // Preparar fechamento a partir do timesheet em aberto
  const handleOpenClosePeriodModal = () => {
    setFormError(null);
    setPeriod(formattedDefaultPeriod);
    const initialHours = totalDraftHours > 0 ? totalDraftHours : contractedMonthlyQuota;
    setHoursWorked(String(initialHours));

    if (draftEntries.length > 0) {
      const projects = Array.from(new Set(draftEntries.map(e => e.project))).filter(Boolean);
      const costCenters = Array.from(new Set(draftEntries.map(e => e.costCenter || defaultCC))).filter(Boolean);
      const synthesis = `Fechamento de Timesheet - ${draftEntries.length} atividade(s) registrada(s).\n` +
        `Centro(s) de Custo: ${costCenters.join(', ')}.\n` +
        `Projeto(s) Atendido(s): ${projects.join(', ')}.\n\n` +
        `Detalhamento de Entregas:\n` +
        draftEntries.slice(0, 12).map((e, idx) => {
          const code = e.taskCode || `TK-${String(idx + 1).padStart(3, '0')}`;
          return `• [${code}] [${e.costCenter || defaultCC}] ${e.project}: ${e.taskDescription} (${e.durationHours}h)`;
        }).join('\n') +
        (draftEntries.length > 12 ? `\n... e mais ${draftEntries.length - 12} atividades detalhadas na grade do timesheet.` : '');
      setDescription(synthesis);

      const allLinks: PjReportLink[] = [];
      const allImgs: string[] = [];
      draftEntries.forEach(entry => {
        if (entry.links) {
          entry.links.forEach(l => {
            if (l.url && !allLinks.some(al => al.url === l.url)) allLinks.push(l);
          });
        }
        if (entry.images) {
          entry.images.forEach(img => {
            if (!allImgs.includes(img)) allImgs.push(img);
          });
        }
      });
      setLinks(allLinks.length > 0 ? allLinks : [{ title: '', url: '' }]);
      setImages(allImgs);
    } else {
      setDescription('');
      setLinks([{ title: '', url: '' }]);
      setImages([]);
    }

    setIsModalOpen(true);
  };

  const handleAddLink = () => {
    setLinks([...links, { title: '', url: '' }]);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, field: keyof PjReportLink, value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Submissão do Fechamento de Relatório
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!period.trim()) {
      setFormError('Por favor informe o período de referência.');
      return;
    }

    const parsedHours = Number(String(hoursWorked).replace(',', '.'));
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('Informe uma quantidade válida de horas trabalhadas no período (maior que zero).');
      return;
    }

    if (!description.trim() || description.trim().length < 3) {
      setFormError('Descreva suas atividades e entregas realizadas.');
      return;
    }

    const validLinks = links.filter(l => l.url.trim().length > 0).map(l => ({
      title: l.title.trim() || l.url.trim(),
      url: l.url.trim().startsWith('http') ? l.url.trim() : `https://${l.url.trim()}`
    }));

    setIsSubmitting(true);
    try {
      const created = await createPjReportSupabase({
        employeeId: employee.id,
        employeeName: employee.name,
        period: period.trim(),
        hoursWorked: Number(parsedHours.toFixed(2)),
        activitiesDescription: description.trim(),
        timesheetEntries: draftEntries,
        links: validLinks,
        images: images,
      });

      setReports(prev => [created, ...prev]);
      if (onReportCreated) {
        onReportCreated(created);
      }

      setExpandedReportId(created.id);
      clearDraftTimesheetSupabase(employee.id);
      setDraftEntries([]);

      setSubmitSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitSuccess(false);
        setDescription('');
        setLinks([{ title: '', url: '' }]);
        setImages([]);
      }, 1000);
    } catch (err: any) {
      setFormError('Erro ao registrar relatório: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exportar planilha do próprio colaborador
  const handleExportOwnTimesheet = (format: 'xls' | 'csv') => {
    const submittedEntries = reports.flatMap(r =>
      (r.timesheetEntries || []).map(ts => ({
        ...ts,
        periodLabel: r.period,
        reportStatus: r.status,
      }))
    );
    const openEntries = draftEntries.map(ts => ({
      ...ts,
      periodLabel: formattedDefaultPeriod,
      reportStatus: 'open',
    }));
    const allEntries = [...openEntries, ...submittedEntries];

    if (allEntries.length === 0) {
      alert('Nenhuma atividade registrada para exportar na planilha.');
      return;
    }

    exportPjTimesheetSpreadsheet({
      employeeName: employee.name,
      employeeRole: employee.role,
      defaultCostCenter: defaultCC,
      periodTitle: formattedDefaultPeriod,
      quotaHours: contractedMonthlyQuota,
      entries: allEntries,
      format,
    });
  };

  return (
    <div
      className={`space-y-6 animate-in fade-in duration-200 ${isDark ? 'text-white' : 'text-slate-900'}`}
      style={{ zoom: 0.82 }}
    >
      
      {activeSubView === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* =====================================================================
              COLUNA ESQUERDA: BANNER + FATURAMENTO + LEMBRETES + BLOCO DE NOTAS
              ===================================================================== */}
          <div className="xl:col-span-8 space-y-6">
            {/* 1. Hero Banner do Colaborador PJ (Estilo Painel Gestor) */}
            <div
              className={`rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
              style={{
                backgroundColor: isDark ? '#111216' : '#ffffff',
                boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)',
              }}
            >
              <div
                className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)',
                  filter: 'blur(70px)',
                }}
              />

              <div className="relative z-10 max-w-2xl space-y-2">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
                  }`}
                >
                  <span
                    className="w-3.5 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                  />
                  <span>Regime de Prestação de Serviços PJ</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Painel Completo do{' '}
                  <span
                    className={`inline-block bg-clip-text text-transparent ${
                      isDark
                        ? 'bg-gradient-to-r from-[#F9DE97] via-[#F59242] to-[#9F243C]'
                        : 'bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242]'
                    }`}
                    style={{
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                    }}
                  >
                    Colaborador PJ
                  </span>
                </h1>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Acompanhe seu faturamento, organize sua rotina e fique por dentro das suas tarefas.
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono">
                    💰 {formatBRL(contractedHourlyRate)} / hora
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono">
                    ⏱️ Franquia: {contractedMonthlyQuota}h / mês
                  </span>
                </div>
              </div>
            </div>

            {/* 2. MEU FATURAMENTO & CALCULADORA DE HORAS PJ */}
            <div
              className={`rounded-3xl border p-5 sm:p-6 space-y-5 transition-all ${
                isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200/80 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Meu Faturamento & Calculadora de Horas PJ
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="text-[11px] opacity-75">Simulação:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={simulatedHours}
                      onChange={(e) => {
                        setHasUserEditedSimHours(true);
                        setSimulatedHours(e.target.value);
                      }}
                      className={`w-16 px-1.5 py-0.5 rounded text-center font-mono font-black text-xs border outline-none ${
                        isDark
                          ? 'bg-black/50 text-amber-400 border-white/15 focus:border-amber-400'
                          : 'bg-white text-amber-700 border-slate-300 focus:border-[#96183c]'
                      }`}
                      title="Altere as horas para ver o cálculo do painel mudar em tempo real"
                    />
                    <span className="text-[11px] opacity-75">h</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCalculatorModalOpen(true)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                    title="Abrir Calculadora Completa"
                  >
                    <Calculator className="w-4 h-4 text-[#f89847]" />
                  </button>
                </div>
              </div>

              {/* 5 Cards de Métricas em Linha Horizontal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
                }`}>
                  <span className={`text-[11px] font-bold block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Valor hora (PJ)
                  </span>
                  <div className={`text-xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatBRL(contractedHourlyRate)}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
                }`}>
                  <span className={`text-[11px] font-bold block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Timesheet aberto
                  </span>
                  <div className={`text-xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {totalDraftHours}h
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
                }`}>
                  <span className={`text-[11px] font-bold block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Homologado
                  </span>
                  <div className={`text-xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {totalHoursApproved}h
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
                }`}>
                  <span className={`text-[11px] font-bold block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Total calculado ({parsedSimHours}h)
                  </span>
                  <div className={`text-xl font-black font-mono tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-700 font-extrabold'}`}>
                    {formatBRL(simulatedEarnings)}
                  </div>
                </div>

                <div className={`col-span-2 sm:col-span-1 p-3.5 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/80 border-slate-200/90 shadow-2xs'
                }`}>
                  <span className={`text-[11px] font-bold block mb-1.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`} title={`Valor total do contrato (${contractedMonthlyQuota}h)`}>
                    Valor total do contrato ({contractedMonthlyQuota}h)
                  </span>
                  <div className={`text-xl font-black font-mono tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-700 font-extrabold'}`}>
                    {formatBRL(fullQuotaEarnings)}
                  </div>
                </div>
              </div>

              {/* Barra de Progresso do Faturamento (Baseada estritamente nas horas reais) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className={isDark ? 'text-slate-300' : 'text-slate-800'}>
                    Progresso do faturamento ({realHoursTotal}h de {contractedMonthlyQuota}h)
                  </span>
                  <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <strong className={isDark ? 'text-white' : 'text-slate-900 font-black'}>{realQuotaProgressPercent}%</strong> concluído
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${realQuotaProgressPercent}%`,
                      background: 'linear-gradient(90deg, #96183c, #f89847)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'}>
                    Meta mensal: {contractedMonthlyQuota}h
                  </span>
                  {realRemainingHoursToQuota > 0 ? (
                    <span className={`font-bold ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                      Faltam {realRemainingHoursToQuota}h para a meta
                    </span>
                  ) : realHoursTotal >= contractedMonthlyQuota ? (
                    <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      Meta mensal atingida! ✓
                    </span>
                  ) : (
                    <span className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Inicie suas atividades para pontuar
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. PAINEL DE LEMBRETES & REUNIÕES DE GESTÃO */}
            <div
              className={`rounded-3xl p-5 sm:p-6 border transition-all flex flex-col justify-between ${
                isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200/80 shadow-xs'
              }`}
            >
              <div>
                <div className={`flex items-center justify-between pb-3.5 border-b mb-4 ${
                  isDark ? 'border-white/10' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-rose-950/40 text-[#f89847]' : 'bg-rose-50 text-[#96183c]'
                    }`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-black text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Lembretes & Reuniões de Gestão
                      </h3>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                        Fique por dentro das suas lembretes e reuniões importantes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAllRemindersOpen(true)}
                    className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-full border cursor-pointer transition-all shrink-0 ${
                      isDark
                        ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Ver todos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {reminders.length === 0 ? (
                  <div className="py-6 text-center space-y-1.5">
                    <Bell className={`w-7 h-7 mx-auto opacity-30 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Nenhum lembrete ou reunião pendente no momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {reminders.slice(0, 3).map((rem) => {
                      const isTodayRem = rem.date === getTodayDateString();
                      const timeDisplay = isTodayRem ? `Hoje • ${rem.time}` : `${rem.date.split('-').reverse().slice(0, 2).join('/')} • ${rem.time}`;
                      return (
                        <div
                          key={rem.id}
                          onClick={() => setSelectedReminder(rem)}
                          className={`group p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 ${
                            isDark
                              ? 'bg-[#0e1017] border-white/10 hover:bg-white/5 hover:border-[#f89847]/30'
                              : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100 hover:border-[#96183c]/30'
                          }`}
                          title="Clique para abrir detalhes do lembrete"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                            <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {rem.title}
                            </span>
                            <span className={`text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                              isDark
                                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {timeDisplay}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {rem.link && (
                              <a
                                href={rem.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1 bg-gradient-to-r from-[#96183c] to-[#b32047] hover:opacity-95 text-white rounded-full text-xs font-black shrink-0 flex items-center gap-1.5 shadow-xs transition-all"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Entrar</span>
                              </a>
                            )}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 4. BLOCO DE NOTAS PESSOAL DO COLABORADOR PJ (Inalterado) */}
            <PjNotepadSection employeeId={employee.id} isDark={isDark} />
          </div>

          {/* =====================================================================
              COLUNA LATERAL DIREITA: CALENDÁRIO ALINHADO AO TOPO
              ===================================================================== */}
          <div className="xl:col-span-4">
            <div
              className={`rounded-3xl p-5 sm:p-6 transition-all ${
                isDark
                  ? 'bg-[#181920] border border-white/10 text-white shadow-2xl'
                  : 'bg-white border border-slate-200/80 text-slate-800 shadow-md'
              }`}
            >
              {/* Header do Calendário: Ícone + Outubro, 23 Sexta-feira + Setas < > */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2.5">
                  <Calendar className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                  <h3 className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formattedCalendarHeader}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className={`p-1 transition-colors cursor-pointer ${
                      isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Mês anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className={`p-1 transition-colors cursor-pointer ${
                      isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Próximo mês"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Dias da semana em Português: Dom Seg Ter Qua Qui Sex Sáb */}
              <div className="grid grid-cols-7 text-center pt-5 pb-3">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dw, idx) => (
                  <span
                    key={idx}
                    className={`text-xs font-bold ${
                      isDark ? 'text-white/60' : 'text-slate-700'
                    }`}
                  >
                    {dw}
                  </span>
                ))}
              </div>

              {/* Grade de dias numéricos (Neutro com destaque Pontual elegante) */}
              <div className="grid grid-cols-7 gap-y-3.5 text-center text-xs sm:text-sm">
                {calendarGridDays.map((cell, idx) => {
                  const isCurrent = cell.isCurrentMonth;
                  const isSelected = cell.isSelected;
                  const isToday = cell.isToday;
                  const hasItems = cell.hasSchedule || cell.hasReminder;

                  let content;

                  if (isSelected) {
                    content = (
                      <span
                        className="w-8 h-8 rounded-full text-white font-black flex items-center justify-center mx-auto shadow-md"
                        style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                      >
                        {cell.dayNumber}
                      </span>
                    );
                  } else if (isToday) {
                    content = (
                      <span className={`w-8 h-8 rounded-full border-2 border-[#f89847] font-black flex items-center justify-center mx-auto ${
                        isDark ? 'text-white' : 'text-[#96183c]'
                      }`}>
                        {cell.dayNumber}
                      </span>
                    );
                  } else if (hasItems && isCurrent) {
                    content = (
                      <span className={`w-8 h-8 rounded-full font-bold flex flex-col items-center justify-center mx-auto transition-colors ${
                        isDark ? 'text-white hover:bg-white/10' : 'text-slate-900 hover:bg-slate-100'
                      }`}>
                        <span className="leading-none">{cell.dayNumber}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#f89847] mt-0.5" />
                      </span>
                    );
                  } else {
                    content = (
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-medium transition-colors ${
                        !isCurrent
                          ? (isDark ? 'text-white/20' : 'text-slate-400')
                          : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-800 hover:bg-slate-100')
                      }`}>
                        {cell.dayNumber}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(cell.dateString);
                        setSchedDate(cell.dateString);
                      }}
                      className="cursor-pointer p-0 focus:outline-none"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>

              {/* Seção Minha Escala & Tarefas */}
              <div className="pt-7 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <CheckSquare className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                    <h4 className={`font-black text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Minha Escala & Tarefas
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddScheduleOpen((prev) => !prev)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* Formulário de Adicionar Horário */}
                {isAddScheduleOpen && (
                  <form
                    onSubmit={handleAddPrivateSchedule}
                    className={`p-3.5 rounded-2xl border space-y-3 text-xs mb-3 ${
                      isDark ? 'bg-black/30 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                      <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>Novo Horário na Escala</span>
                      <button
                        type="button"
                        onClick={() => setIsAddScheduleOpen(false)}
                        className={`text-xs cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={`text-[10px] font-bold uppercase block mb-1 ${isDark ? 'opacity-75' : 'text-slate-700'}`}>Data</label>
                        <input
                          type="date"
                          required
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-xl border outline-none text-xs ${
                            isDark ? 'bg-[#151822] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-bold uppercase block mb-1 ${isDark ? 'opacity-75' : 'text-slate-700'}`}>Início</label>
                        <input
                          type="time"
                          required
                          value={schedStart}
                          onChange={(e) => setSchedStart(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-xl border outline-none text-xs ${
                            isDark ? 'bg-[#151822] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-bold uppercase block mb-1 ${isDark ? 'opacity-75' : 'text-slate-700'}`}>Fim</label>
                        <input
                          type="time"
                          required
                          value={schedEnd}
                          onChange={(e) => setSchedEnd(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-xl border outline-none text-xs ${
                            isDark ? 'bg-[#151822] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={schedTitle}
                        onChange={(e) => setSchedTitle(e.target.value)}
                        placeholder="Nome da escala/tarefa (ex: Plantão, Turno Manhã...)"
                        className={`flex-1 px-3 py-1.5 rounded-xl border outline-none text-xs ${
                          isDark ? 'bg-[#151822] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white cursor-pointer shrink-0"
                        style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                )}

                {/* Timeline com Horários que Batem 100% e Botão de Excluir */}
                <div className="space-y-4 pt-2">
                  {dayTimelineEntries.length === 0 ? (
                    <div className="space-y-3.5">
                      {['08:00', '12:00', '14:00', '18:00'].map((time) => (
                        <div key={time} className="relative flex items-center h-5">
                          <span className={`font-mono text-[11px] font-bold w-12 shrink-0 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                            {time}
                          </span>
                          <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                        </div>
                      ))}

                      <div className={`p-4 rounded-2xl border text-center space-y-2 ${
                        isDark ? 'bg-white/[0.02] border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                          Nenhum horário cadastrado para este dia.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAddScheduleOpen(true)}
                          className={`text-xs font-bold ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'} hover:underline cursor-pointer inline-flex items-center gap-1`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar horário de trabalho</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Linha guia inicial de referência se o primeiro evento for após as 08:00 */}
                      {dayTimelineEntries[0]?.startTime > '08:00' && (
                        <div className="relative flex items-center h-5">
                          <span className={`font-mono text-[11px] font-bold w-12 shrink-0 ${isDark ? 'text-white/35' : 'text-slate-500'}`}>
                            08:00
                          </span>
                          <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                        </div>
                      )}

                      {/* Itens Reais do Colaborador com Horário Correto e Ação de Excluir */}
                      {dayTimelineEntries.map((entry, idx) => {
                        const isAlt = idx % 2 === 1;

                        // Paleta com cores fortes e visíveis no modo claro e escuro
                        const cardTheme = entry.type === 'reminder'
                          ? (isDark
                              ? 'bg-[#1b1928] border-purple-500/30 text-purple-100'
                              : 'bg-purple-100/90 border-purple-400 text-purple-950 shadow-xs')
                          : isAlt
                          ? (isDark
                              ? 'bg-[#221c17] border-[#f89847]/30 text-amber-100'
                              : 'bg-amber-100/90 border-amber-400 text-amber-950 shadow-xs')
                          : (isDark
                              ? 'bg-[#22151c] border-rose-500/30 text-rose-100'
                              : 'bg-rose-100/90 border-rose-400 text-rose-950 shadow-xs');

                        return (
                          <div key={entry.id} className="relative flex items-center min-h-[50px] group">
                            {/* Horário na Régua: Bate exatamente com a tarefa */}
                            <span className={`font-mono text-xs font-black w-12 shrink-0 ${isDark ? 'text-white/70' : 'text-slate-700'}`}>
                              {entry.startTime}
                            </span>

                            {/* Linha Horizontal Guia */}
                            <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/15' : 'bg-slate-300'}`} />

                            {/* Card do Horário com Botão de Excluir */}
                            <div
                              className={`ml-2 sm:ml-4 rounded-2xl px-3.5 py-2 border shadow-xs flex items-center justify-between gap-3 min-w-[170px] sm:min-w-[190px] max-w-[270px] transition-all hover:shadow-sm ${cardTheme}`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className={`font-black text-xs truncate block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {entry.title}
                                </span>
                                <span className={`text-[10.5px] font-mono font-bold block mt-0.5 ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                                  {entry.endTime ? `${entry.startTime} - ${entry.endTime}` : `${entry.startTime} • Lembrete`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {entry.link && (
                                  <a
                                    href={entry.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                    title="Acessar link da reunião"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {entry.canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePrivateSchedule(entry.id)}
                                    className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 ${
                                      isDark ? 'hover:bg-rose-500/20' : 'hover:bg-rose-100'
                                    } cursor-pointer transition-colors`}
                                    title="Excluir este horário"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Linha guia final de referência se o último evento terminar antes das 18:00 */}
                      {(dayTimelineEntries[dayTimelineEntries.length - 1]?.endTime || '00:00') < '18:00' && (
                        <div className="relative flex items-center h-5">
                          <span className={`font-mono text-[11px] font-bold w-12 shrink-0 ${isDark ? 'text-white/35' : 'text-slate-500'}`}>
                            18:00
                          </span>
                          <div className={`flex-1 h-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubView === 'timesheet' && (
        <>
          {/* Top Banner PJ para Timesheet (Estilo Painel Gestor) */}
          <div
            className={`rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
            style={{
              backgroundColor: isDark ? '#111216' : '#ffffff',
              boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)',
                filter: 'blur(70px)',
              }}
            />

            <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
              <div className="max-w-xl space-y-2">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
                  }`}
                >
                  <span
                    className="w-3.5 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                  />
                  <span>Regime de Prestação de Serviços PJ</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Timesheet &{' '}
                  <span
                    className={`inline-block bg-clip-text text-transparent ${
                      isDark
                        ? 'bg-gradient-to-r from-[#F9DE97] via-[#F59242] to-[#9F243C]'
                        : 'bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242]'
                    }`}
                    style={{
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent',
                    }}
                  >
                    Entregas PJ
                  </span>
                </h1>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Registre suas atividades via Cronômetro Play/Pause ou Entrada Manual e envie o fechamento ao gestor.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 w-full xl:w-auto justify-end">
                <button
                  onClick={() => handleExportOwnTimesheet('xls')}
                  className={`px-4 py-3 rounded-2xl font-bold text-xs border transition-all flex items-center gap-2 cursor-pointer ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' 
                      : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                  }`}
                  title="Exportar planilha Excel (.xls) com todas as suas tarefas"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span>Exportar (.XLS)</span>
                </button>

                  <button
                    onClick={handleOpenClosePeriodModal}
                    className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    style={{
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)',
                    }}
                  >
                    <Send className="w-4 h-4" />
                    <span>Fechar Período e Enviar ao Gestor</span>
                  </button>
                </div>
              </div>
            </div>

          {/* Cronômetro Interativo Play / Pause & Entrada Manual */}
          <PjTimesheetTracker 
            employee={employee}
            isDark={isDark}
            onEntryAdded={handleEntryAdded}
          />

          {/* SEÇÃO: Timesheet do Período em Aberto (Rascunho de Atividades) */}
          <div className={`p-5 sm:p-6 rounded-3xl border transition-all ${
            isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2 flex-wrap">
                  <span>Atividades no Timesheet em Aberto</span>
                  <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                    isDark
                      ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                      : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                  }`}>
                    {draftEntries.length} tarefas ({totalDraftHours}h)
                  </span>
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tarefas registradas via Play/Pause ou manual aguardando o envio de fechamento ao gestor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <History className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Ver Histórico ({reports.length})</span>
                </button>

                {draftEntries.length > 0 && (
                  <button
                    onClick={handleOpenClosePeriodModal}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 16px rgba(100, 12, 30, 0.30)',
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Fechamento ({totalDraftHours}h)</span>
                  </button>
                )}
              </div>
            </div>

            {draftEntries.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Clock className={`w-8 h-8 mx-auto opacity-60 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Nenhuma atividade no timesheet em aberto</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Utilize o cronômetro Play/Pause acima ou clique em "+ Manual" para registrar ID da tarefa, centro de custo, início, pausas e entregas.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">ID Tarefa</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Data</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Centro de Custo</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Projeto / Cliente</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Descrição da Tarefa</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Horário</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Pausas</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Duração</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Evidências</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                    {draftEntries.map((entry, idx) => (
                      <tr key={entry.id} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-md border ${
                            isDark
                              ? 'bg-white/5 text-[#F9DE97] border-[#F59242]/30'
                              : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                          }`}>
                            {entry.taskCode || `TK-${String(draftEntries.length - idx).padStart(3, '0')}`}
                          </span>
                        </td>
                        <td className={`py-3 px-3 font-mono whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            isDark
                              ? 'bg-white/5 text-slate-300 border-white/10'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {entry.costCenter || defaultCC}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            isDark
                              ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                              : 'bg-amber-50 text-[#96183c] border-amber-300'
                          }`}>
                            {entry.project}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs sm:max-w-md">
                          <span className={`font-medium block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={entry.taskDescription}>
                            {entry.taskDescription}
                          </span>
                          {entry.isLiveTracked && (
                            <span className={`inline-flex items-center gap-1 text-[10px] mt-0.5 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              <Check className="w-3 h-3" /> Cronometrado em tempo real
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-3 font-mono text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {entry.startTime} → {entry.endTime}
                        </td>
                        <td className={`py-3 px-3 text-center font-mono whitespace-nowrap font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                          {entry.breakMinutes > 0 ? `${entry.breakMinutes}m` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`font-mono font-bold text-sm ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                            {entry.durationHours}h
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.links?.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`p-1 rounded-md ${
                                  isDark
                                    ? 'bg-[#9F243C]/20 text-[#F9DE97] hover:bg-[#9F243C]/35'
                                    : 'bg-[#96183c]/10 text-[#96183c] hover:bg-[#96183c]/20'
                                }`}
                                title={link.title || link.url}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ))}
                            {entry.images?.map((img, iIdx) => (
                              <button
                                key={iIdx}
                                type="button"
                                onClick={() => setSelectedImage(img)}
                                className={`p-1 rounded-md cursor-pointer ${
                                  isDark
                                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                }`}
                                title="Ver print comprobatório"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            ))}
                            {(!entry.links?.length && !entry.images?.length) && (
                              <span className="text-slate-500 text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteDraftEntry(entry.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remover entrada do timesheet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL DE DETALHES DO LEMBRETE */}
      <ReminderDetailModal
        isOpen={!!selectedReminder}
        onClose={() => setSelectedReminder(null)}
        reminder={selectedReminder}
        employees={employees}
        currentEmployee={employee}
        isLightTheme={!isDark}
      />

      {/* MODAL: Todos os Lembretes & Reuniões de Gestão */}
      {isAllRemindersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-xl rounded-3xl border p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col ${
            isDark ? 'bg-[#151822] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-rose-950/40 text-[#f89847]' : 'bg-rose-50 text-[#96183c]'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg">Lembretes & Reuniões de Gestão</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Todos os lembretes e reuniões cadastrados pela gestão
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllRemindersOpen(false)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 py-1">
              {reminders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum lembrete cadastrado.
                </div>
              ) : (
                reminders.map((rem) => (
                  <div
                    key={rem.id}
                    onClick={() => {
                      setSelectedReminder(rem);
                      setIsAllRemindersOpen(false);
                    }}
                    className={`group p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#0e1017] border-white/10 hover:bg-white/5'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <span className={`text-xs font-bold block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {rem.title}
                        </span>
                        {rem.notes && (
                          <span className={`text-[11px] block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {rem.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                        isDark
                          ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {rem.date} • {rem.time}
                      </span>
                      {rem.link && (
                        <a
                          href={rem.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-gradient-to-r from-[#96183c] to-[#b32047] text-white rounded-full text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Entrar</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end shrink-0 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAllRemindersOpen(false)}
                className="px-4 py-2 rounded-xl font-bold text-xs text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Calculadora de Horas PJ Interativa */}
      {isCalculatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-lg rounded-3xl border p-6 space-y-5 shadow-2xl relative ${
            isDark ? 'bg-[#151822] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg">Calculadora de Horas PJ</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Simule o valor a receber com base nas horas trabalhadas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalculatorModalOpen(false)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block opacity-75">
                  Horas para simulação:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={simulatedHours}
                    onChange={(e) => {
                      setHasUserEditedSimHours(true);
                      setSimulatedHours(e.target.value);
                    }}
                    placeholder="Ex: 160"
                    className={`w-full px-4 py-3 rounded-2xl font-mono text-lg font-black border outline-none ${
                      isDark
                        ? 'bg-[#0e1017] border-white/15 text-white focus:border-[#f89847]'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#96183c]'
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60">
                    horas × {formatBRL(contractedHourlyRate)}/h
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHasUserEditedSimHours(true);
                      setSimulatedHours(String(totalDraftHours));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      isDark
                        ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Em aberto ({totalDraftHours}h)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasUserEditedSimHours(true);
                      setSimulatedHours(String(totalWorkedHoursCombined));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      isDark
                        ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Total trabalhado ({totalWorkedHoursCombined}h)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasUserEditedSimHours(true);
                      setSimulatedHours(String(contractedMonthlyQuota));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      isDark
                        ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Meta mensal ({contractedMonthlyQuota}h)
                  </button>
                </div>
              </div>

              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                    isDark ? 'text-emerald-300/80' : 'text-emerald-800/80'
                  }`}>
                    Valor Calculado ({parsedSimHours}h)
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {formatBRL(simulatedEarnings)}
                  </span>
                </div>
                <div className="text-right text-xs opacity-75 font-mono">
                  {parsedSimHours}h × {formatBRL(contractedHourlyRate)}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCalculatorModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Histórico de Fechamentos Enviados Anteriormente */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-4xl rounded-3xl border p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#10121A] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isDark
                    ? 'bg-[#9F243C]/20 border-[#F59242]/30 text-[#f89847]'
                    : 'bg-[#96183c]/10 border-[#96183c]/25 text-[#96183c]'
                }`}>
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2 flex-wrap">
                    <span>Histórico de Fechamentos Enviados</span>
                    <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                      isDark
                        ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                        : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                    }`}>
                      {reports.length} envio(s)
                    </span>
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Consulte os relatórios submetidos anteriormente, status de homologação e pareceres do gestor.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoading ? (
              <div className={`p-12 text-center rounded-2xl border ${isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-slate-50 border-slate-200'}`}>
                <Clock className={`w-6 h-6 animate-spin mx-auto mb-2 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                <p className="text-xs text-slate-400">Carregando fechamentos...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className={`p-10 text-center rounded-3xl border space-y-3 ${
                isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
                  isDark ? 'bg-[#9F243C]/15 text-[#f89847] border-[#F59242]/25' : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/20'
                }`}>
                  <Briefcase className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base">Nenhum fechamento enviado anteriormente</h3>
                <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Quando você finalizar o período e clicar em <strong>Fechar Período e Enviar ao Gestor</strong>, seus relatórios aparecerão neste histórico.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((rep) => {
                  const isExpanded = expandedReportId === rep.id;
                  const hasTimesheet = Boolean(rep.timesheetEntries && rep.timesheetEntries.length > 0);

                  return (
                    <div
                      key={rep.id}
                      className={`p-5 rounded-3xl border transition-all ${
                        isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-slate-50 border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b ${
                        isDark ? 'border-white/5' : 'border-slate-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold ${
                            isDark
                              ? 'bg-[#9F243C]/20 text-[#f89847] border-[#F59242]/30'
                              : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                          }`}>
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                              <span>Período: {rep.period}</span>
                              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full border ${
                                isDark
                                  ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                                  : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                              }`}>
                                {rep.hoursWorked}h enviadas ({formatBRL(rep.hoursWorked * contractedHourlyRate)})
                              </span>
                            </h3>
                            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Enviado em: {new Date(rep.submittedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {rep.status === 'approved' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDark
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Homologado pelo Gestor
                            </span>
                          ) : rep.status === 'rejected' ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDark
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              Ajustes Solicitados
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isDark
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              Aguardando Homologação
                            </span>
                          )}

                          {hasTimesheet && (
                            <button
                              onClick={() => setExpandedReportId(isExpanded ? null : rep.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                                isDark
                                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <span>Timesheet ({rep.timesheetEntries?.length})</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="py-3.5">
                        <span className={`text-[10px] font-mono uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Síntese de Atividades & Entregas Realizadas:
                        </span>
                        <p className={`text-xs sm:text-sm whitespace-pre-line leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {rep.activitiesDescription}
                        </p>
                      </div>

                      {hasTimesheet && isExpanded && (
                        <div className={`my-3 p-4 rounded-2xl border space-y-3 animate-in fade-in ${
                          isDark ? 'bg-black/40 border-[#F59242]/20' : 'bg-white border-slate-200 shadow-2xs'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-[#F9DE97]' : 'text-[#96183c]'}`}>
                              <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                              Grade Detalhada de Tarefas Submetidas ({rep.timesheetEntries?.length} itens)
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className={`border-b text-[10px] uppercase font-bold ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                                  <th className="py-2 px-2.5">ID Tarefa</th>
                                  <th className="py-2 px-2.5">Data</th>
                                  <th className="py-2 px-2.5">Centro de Custo</th>
                                  <th className="py-2 px-2.5">Projeto / Cliente</th>
                                  <th className="py-2 px-2.5">Descrição da Tarefa</th>
                                  <th className="py-2 px-2.5 text-center">Horário</th>
                                  <th className="py-2 px-2.5 text-center">Pausas</th>
                                  <th className="py-2 px-2.5 text-center">Duração</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                                {rep.timesheetEntries?.map((ts, tIdx) => (
                                  <tr key={tIdx} className={isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}>
                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                      <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                                        isDark
                                          ? 'bg-white/5 text-[#F9DE97] border-[#F59242]/25'
                                          : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                                      }`}>
                                        {ts.taskCode || `TK-${String(tIdx + 1).padStart(3, '0')}`}
                                      </span>
                                    </td>
                                    <td className={`py-2.5 px-2.5 font-mono whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                                      {new Date(ts.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </td>
                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                        isDark
                                          ? 'bg-white/5 text-slate-300 border-white/10'
                                          : 'bg-slate-100 text-slate-700 border-slate-300'
                                      }`}>
                                        {ts.costCenter || defaultCC}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                        isDark
                                          ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                                          : 'bg-amber-50 text-[#96183c] border-amber-300'
                                      }`}>
                                        {ts.project}
                                      </span>
                                    </td>
                                    <td className={`py-2.5 px-2.5 max-w-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={ts.taskDescription}>
                                      {ts.taskDescription}
                                    </td>
                                    <td className={`py-2.5 px-2.5 font-mono text-center whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                                      {ts.startTime} → {ts.endTime}
                                    </td>
                                    <td className={`py-2.5 px-2.5 text-center font-mono whitespace-nowrap font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                      {ts.breakMinutes > 0 ? `${ts.breakMinutes}m` : '-'}
                                    </td>
                                    <td className={`py-2.5 px-2.5 text-center font-mono font-bold whitespace-nowrap ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                                      {ts.durationHours}h
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {rep.links && rep.links.length > 0 && (
                        <div className="py-2.5">
                          <span className={`text-[10px] font-mono uppercase block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Links & Evidências Online:
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {rep.links.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                  isDark
                                    ? 'bg-[#9F243C]/20 hover:bg-[#9F243C]/30 text-[#F9DE97] border-[#F59242]/30'
                                    : 'bg-[#96183c]/10 hover:bg-[#96183c]/20 text-[#96183c] border-[#96183c]/25'
                                }`}
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span>{link.title || link.url}</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {rep.images && rep.images.length > 0 && (
                        <div className="py-2.5">
                          <span className={`text-[10px] font-mono uppercase block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Capturas de Tela & Comprovantes Visuais ({rep.images.length}):
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {rep.images.map((img, iIdx) => (
                              <div
                                key={iIdx}
                                onClick={() => setSelectedImage(img)}
                                className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer hover:border-[#f89847] transition-all shadow-sm"
                              >
                                <img src={img} alt={`Comprovante ${iIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rep.managerFeedback && (
                        <div className={`mt-3 p-3.5 rounded-2xl border text-xs ${
                          rep.status === 'approved'
                            ? isDark
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isDark
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          <strong className="block mb-0.5">Parecer da Gestão:</strong>
                          <span>{rep.managerFeedback}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`flex items-center justify-end pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FECHAMENTO DE PERÍODO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-3xl border p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-[#10121A] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                  style={{ background: 'linear-gradient(135deg, #640C1E, #9F243C, #F59242)' }}
                >
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">Fechar Período e Enviar ao Gestor</h3>
                  <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Consolida {draftEntries.length} atividade(s) do seu timesheet para homologação
                  </span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className={`cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Fechamento submetido ao gestor com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={isDark ? 'text-slate-400' : 'text-slate-600'}>Período de Referência*</label>
                  <input
                    type="text"
                    required
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    placeholder="Ex: Outubro/2026 ou 01 a 15 de Outubro"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white focus:border-[#f89847]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#96183c]'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={isDark ? 'text-slate-400' : 'text-slate-600'}>Total de Horas Líquidas*</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={hoursWorked}
                    onChange={e => setHoursWorked(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none font-mono ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white focus:border-[#f89847]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#96183c]'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500 font-normal block">
                    Valor estimado deste fechamento: <strong className="text-emerald-500">{formatBRL((Number(hoursWorked) || 0) * contractedHourlyRate)}</strong>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={isDark ? 'text-slate-400' : 'text-slate-600'}>Síntese das Atividades & Entregas do Período*</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Relate os projetos desenvolvidos, tarefas concluídas e marcos entregues..."
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                    isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white focus:border-[#f89847]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#96183c]'
                  }`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <LinkIcon className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                    <span>Links de Evidências (GitHub PRs, Figma, Google Docs, etc.)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      isDark ? 'text-[#f89847] hover:text-amber-300' : 'text-[#96183c] hover:text-[#640C1E]'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar Link</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Título (ex: Pull Request #24)"
                        value={link.title}
                        onChange={e => handleLinkChange(idx, 'title', e.target.value)}
                        className={`w-1/3 px-3 py-2 rounded-xl border outline-none text-xs ${
                          isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="https://github.com/... ou link do trabalho"
                        value={link.url}
                        onChange={e => handleLinkChange(idx, 'url', e.target.value)}
                        className={`flex-1 px-3 py-2 rounded-xl border outline-none text-xs ${
                          isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      {links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <ImageIcon className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Imagens Comprobatórias (Prints de tela, relatórios visuais)</span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-4 py-2.5 rounded-xl border border-dashed flex items-center gap-2 cursor-pointer transition-all ${
                      isDark ? 'border-[#F59242]/40 hover:bg-[#9F243C]/15 text-[#F9DE97]' : 'border-[#96183c]/40 hover:bg-[#96183c]/5 text-[#96183c]'
                    }`}
                  >
                    <Upload className={`w-4 h-4 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                    <span>Selecionar Prints de Tela</span>
                  </button>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group">
                        <img src={img} alt="print" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`flex items-center justify-end gap-3 pt-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)',
                  }}
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Enviando...' : 'Enviar Fechamento ao Gestor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEM */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedImage} alt="Evidência Ampliada" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-900 text-white border border-white/20 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
