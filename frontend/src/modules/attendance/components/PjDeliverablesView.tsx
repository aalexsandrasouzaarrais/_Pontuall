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
  FileText, 
  Upload, 
  X, 
  Eye, 
  Send,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  Timer,
  Check,
  Download,
  FileSpreadsheet,
  History
} from 'lucide-react';
import { Employee, PjDeliverableReport, PjReportLink, PjTimesheetEntry } from '@/types';
import { 
  getPjReportsSupabase, 
  createPjReportSupabase,
  getDraftTimesheet,
  deleteDraftTimesheetEntry,
  clearDraftTimesheet,
  exportPjTimesheetSpreadsheet
} from '@/modules/attendance/services/pjReportService';
import { PjTimesheetTracker } from './PjTimesheetTracker';

interface PjDeliverablesViewProps {
  employee: Employee;
  isDark?: boolean;
  onReportCreated?: (report: PjDeliverableReport) => void;
}

export const PjDeliverablesView: React.FC<PjDeliverablesViewProps> = ({
  employee,
  isDark = true,
  onReportCreated,
}) => {
  const [reports, setReports] = useState<PjDeliverableReport[]>([]);
  const [draftEntries, setDraftEntries] = useState<PjTimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

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
      const data = await getPjReportsSupabase(employee.id);
      setReports(data);
      const drafts = getDraftTimesheet(employee.id);
      setDraftEntries(drafts);
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
    setDraftEntries(prev => [newEntry, ...prev.filter(e => e.id !== newEntry.id)]);
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

  // Preparar fechamento a partir do timesheet em aberto
  const handleOpenClosePeriodModal = () => {
    setFormError(null);
    setPeriod(formattedDefaultPeriod);
    const initialHours = totalDraftHours > 0 ? totalDraftHours : (employee.monthlyHoursQuota || 160);
    setHoursWorked(String(initialHours));

    // Pré-sintetiza descrição com base nas atividades do timesheet
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

      // Agrupa links e imagens de todas as entradas
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

    Array.from(files).forEach(file => {
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

      // Expande automaticamente o relatório recém enviado
      setExpandedReportId(created.id);

      // Limpa os rascunhos locais após submeter com sucesso
      clearDraftTimesheet(employee.id);
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
      quotaHours: employee.monthlyHoursQuota || 160,
      entries: allEntries,
      format,
    });
  };

  // Métricas
  const totalHoursApproved = Number(
    reports
      .filter(r => r.status === 'approved')
      .reduce((acc, curr) => acc + curr.hoursWorked, 0)
      .toFixed(2)
  );

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const approvedCount = reports.filter(r => r.status === 'approved').length;

  return (
    <div className={`space-y-6 animate-in fade-in duration-200 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Top Banner Informativo PJ */}
      <div
        className={`p-6 sm:p-7 rounded-3xl border relative overflow-hidden transition-all ${
          isDark
            ? 'border-white/10 shadow-2xl'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
        style={
          isDark
            ? {
                backgroundColor: '#111216',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              }
            : undefined
        }
      >
        <div
          className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
              : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.14) 0%, rgba(150, 24, 60, 0.10) 45%, transparent 75%)',
            filter: 'blur(65px)',
          }}
        />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDark
                ? 'text-slate-300 border-white/10 bg-white/5'
                : 'text-[#96183c] border-[#96183c]/20 bg-[#96183c]/5'
            }`}>
              <span
                className="w-3.5 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
              />
              <span>Regime de Prestação de Serviços PJ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Timesheet & Relatórios de Entregas{' '}
              <span
                style={{
                  background: isDark
                    ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)'
                    : 'linear-gradient(90deg, #96183C 0%, #F59242 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                PJ
              </span>
            </h1>
            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Registre suas atividades com <strong>ID da Tarefa</strong>, <strong>Centro de Custo</strong>, <strong>Projeto/Cliente</strong> e <strong>cronômetro Play/Pause em tempo real</strong>. Ao final do período, consolide e envie ao gestor ou exporte sua planilha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
              <span>Exportar Planilha (.XLS)</span>
            </button>

            <button
              onClick={handleOpenClosePeriodModal}
              className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
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

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            isDark
              ? 'bg-[#9F243C]/20 border-[#F59242]/30 text-[#f89847]'
              : 'bg-[#96183c]/10 border-[#96183c]/20 text-[#96183c]'
          }`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-[11px] font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Cota Contratual Mensal
            </span>
            <span className="text-2xl font-black">
              {employee.monthlyHoursQuota || 160}h <span className="text-xs font-semibold opacity-70">/ mês</span>
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            isDark
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
              : 'bg-amber-100 border-amber-300 text-amber-700'
          }`}>
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-[11px] font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              No Timesheet em Aberto
            </span>
            <span className={`text-2xl font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              {totalDraftHours}h <span className="text-xs font-semibold opacity-75">({draftEntries.length} tarefas)</span>
            </span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            isDark
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-emerald-100 border-emerald-300 text-emerald-700'
          }`}>
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-[11px] font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Horas Homologadas (Gestor)
            </span>
            <span className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {totalHoursApproved}h
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO: Timesheet do Período em Aberto (Rascunho de Atividades) */}
      <div className={`p-5 sm:p-6 rounded-3xl border transition-all ${
        isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${
          isDark ? 'border-white/5' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-[#9F243C]/20 text-[#f89847]' : 'bg-[#96183c]/10 text-[#96183c]'
            }`}>
              <FolderGit2 className="w-4 h-4" />
            </div>
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
                                {rep.hoursWorked}h enviadas
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

                      {/* Descrição Sintética */}
                      <div className="py-3.5">
                        <span className={`text-[10px] font-mono uppercase block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Síntese de Atividades & Entregas Realizadas:
                        </span>
                        <p className={`text-xs sm:text-sm whitespace-pre-line leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {rep.activitiesDescription}
                        </p>
                      </div>

                      {/* Visualização da Grade Detalhada do Timesheet (Se Expandido) */}
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

                      {/* Links de Comprovação */}
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

                      {/* Imagens de Comprovação */}
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

                      {/* Feedback do Gestor */}
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
                    Aceita frações exatas (ex: 0.04h, 0.5h, 40h) somadas do timesheet
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

              {/* Links de Comprovação */}
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

              {/* Upload de Imagens / Comprovantes */}
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
