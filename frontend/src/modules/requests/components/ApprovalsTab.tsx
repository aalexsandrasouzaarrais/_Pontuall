import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Calendar,
  X,
  Paperclip,
  Eye,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Employee } from '@/types';
import { formatDateBR, getTodayDateString, normalizeDateToISO } from '@/shared/utils/dateUtils';
import { openDocumentSafe } from '@/shared/services/storageService';
import { AttendanceReportRow } from '@/modules/attendance/components/AttendanceReportTab';
import {
  ApprovalItem,
  ApprovalStatusTab,
  ApprovalTypeFilter,
  matchesApprovalTypeFilter,
  matchesDatePeriodRange,
  filterAndSortApprovals,
} from '../utils/approvalFilters';

interface ApprovalsTabProps {
  approvalsData: ApprovalItem[];
  reportRows: AttendanceReportRow[];
  departments: string[];
  employees: Employee[];
  isDark: boolean;
  isRh?: boolean;
  onApproveOccurrence: (id: string) => void | Promise<void>;
  onRejectOccurrence: (id: string) => void | Promise<void>;
  onUpdateFeedback: (id: string, feedback: string) => void | Promise<void>;
  onAddOccurrence: (item: ApprovalItem) => void;
  onOpenExportApprovals: () => void;
}

const CATEGORY_CHIPS: Array<{ id: ApprovalTypeFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'delay', label: 'Atrasos / Antecipações' },
  { id: 'overtime', label: 'Horas Extras' },
  { id: 'forgetfulness', label: 'Esquecimentos' },
  { id: 'medical', label: 'Atestados Médicos' },
  { id: 'absent', label: 'Faltas Não Justificadas' },
  { id: 'justified', label: 'Justificados' },
  { id: 'swap', label: 'Trocas de Turno' },
  { id: 'time_off', label: 'Folgas / Dispensas' },
];

/**
 * Aba Central de Aprovações e Faltas para análise individual caso a caso (contexto de solicitações/justificativas).
 */
export const ApprovalsTab: React.FC<ApprovalsTabProps> = ({
  approvalsData,
  reportRows,
  departments,
  employees,
  isDark,
  onApproveOccurrence,
  onRejectOccurrence,
  onUpdateFeedback,
  onAddOccurrence,
  onOpenExportApprovals,
}) => {
  const [approvalsFilterTab] = useState<ApprovalStatusTab>('all');
  const [approvalsSearch, setApprovalsSearch] = useState('');
  const [approvalsDept, setApprovalsDept] = useState('all');
  const [approvalsDateFrom, setApprovalsDateFrom] = useState('');
  const [approvalsDateTo, setApprovalsDateTo] = useState('');
  const [approvalsTypeFilter, setApprovalsTypeFilter] = useState<ApprovalTypeFilter>('all');
  const [approvalsDateSort, setApprovalsDateSort] = useState<'desc' | 'asc'>('desc');
  const [isNewOccurrenceModalOpen, setIsNewOccurrenceModalOpen] = useState(false);
  const [selectedDetailOccurrence, setSelectedDetailOccurrence] = useState<ApprovalItem | null>(null);
  const [newOccurrenceForm, setNewOccurrenceForm] = useState({
    employeeId: 'emp-1',
    type: 'Atestado Médico',
    date: new Date().toLocaleDateString('pt-BR'),
    reason: '',
    documentName: '',
    status: 'Pendente' as ApprovalItem['status'],
    feedback: '',
  });

  // Sincroniza modal de detalhes se approvalsData hidratar ou atualizar com ele aberto
  useEffect(() => {
    setSelectedDetailOccurrence(prev => {
      if (!prev) return null;
      const exactMatch = approvalsData.find(a => a.id === prev.id);
      const fallbackMatch =
        !exactMatch && prev.id.startsWith('shift-occ-')
          ? approvalsData.find(
              a =>
                !a.id.startsWith('shift-occ-') &&
                a.employeeId === prev.employeeId &&
                a.date === prev.date &&
                a.type === prev.type
            )
          : undefined;
      const latest = exactMatch || fallbackMatch;
      if (!latest) return prev;
      if (
        latest.id === prev.id &&
        latest.status === prev.status &&
        latest.reason === prev.reason &&
        latest.actionText === prev.actionText &&
        latest.documentUrl === prev.documentUrl
      ) {
        return prev;
      }
      return {
        ...prev,
        ...latest,
        feedback: prev.feedback || latest.feedback,
      };
    });
  }, [approvalsData]);

  const handleSaveNewOccurrence = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(em => em.id === newOccurrenceForm.employeeId) || employees[0];
    const newItem: ApprovalItem = {
      id: `ap-${Date.now()}`,
      employeeId: emp?.id,
      employeeName: emp?.name || 'Colaborador',
      employeeRole: emp?.role || 'Colaborador',
      employeeDept: emp?.department || 'Geral',
      employeeAvatar:
        emp?.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: newOccurrenceForm.type,
      reason: newOccurrenceForm.reason || 'Ocorrência registrada manualmente pelo gestor',
      date: newOccurrenceForm.date,
      documentName: newOccurrenceForm.documentName || 'Não se aplica',
      status: newOccurrenceForm.status,
      actionText:
        newOccurrenceForm.status === 'Aprovado'
          ? 'Homologado'
          : newOccurrenceForm.status === 'Pendente'
            ? 'Aguardando decisão'
            : 'Registrado em folha',
      feedback: newOccurrenceForm.feedback,
    };
    onAddOccurrence(newItem);
    setIsNewOccurrenceModalOpen(false);
    setNewOccurrenceForm({
      employeeId: employees[0]?.id || 'emp-1',
      type: 'Atestado Médico',
      date: new Date().toLocaleDateString('pt-BR'),
      reason: '',
      documentName: '',
      status: 'Pendente',
      feedback: '',
    });
  };

  // KPI calculations
  const pendingCount = approvalsData.filter(i => i.status === 'Pendente').length;
  const atestadosCount = approvalsData.filter(i =>
    Boolean(i.documentUrl && i.documentUrl.trim() !== '' && i.documentUrl !== 'null' && i.documentUrl !== 'undefined')
  ).length;
  const currentMonthPrefix = getTodayDateString().slice(0, 7);
  const faltasMesRows = approvalsData.filter(
    i =>
      (i.type === 'Falta Não Justificada' ||
        i.type === 'Falta Justificada' ||
        i.status === 'Falta Lançada' ||
        i.status === 'Recusado / Falta') &&
      normalizeDateToISO(i.date || '').startsWith(currentMonthPrefix)
  );
  const faltasJustificadasMes = faltasMesRows.filter(i => i.type === 'Falta Justificada' || i.status === 'Aprovado').length;
  const evaluatedReportRows = reportRows.filter(r => r.status !== 'Pendente');
  const unexcusedReportAbsences = evaluatedReportRows.filter(r => r.status === 'Ausente').length;
  const assiduidadePct =
    evaluatedReportRows.length > 0
      ? Math.round(((evaluatedReportRows.length - unexcusedReportAbsences) / evaluatedReportRows.length) * 100)
      : null;

  const filteredApprovals = useMemo(
    () =>
      filterAndSortApprovals(approvalsData, {
        search: approvalsSearch,
        department: approvalsDept,
        dateFrom: approvalsDateFrom,
        dateTo: approvalsDateTo,
        typeFilter: approvalsTypeFilter,
        statusTab: approvalsFilterTab,
        dateSort: approvalsDateSort,
      }),
    [
      approvalsData,
      approvalsSearch,
      approvalsDept,
      approvalsDateFrom,
      approvalsDateTo,
      approvalsTypeFilter,
      approvalsFilterTab,
      approvalsDateSort,
    ]
  );

  const hasPeriodFilter = Boolean(approvalsDateFrom || approvalsDateTo);

  return (
    <div className="approvals-page approvals-attendance-page w-full space-y-6 animate-in fade-in duration-200 relative">
      {/* Efeito Glow de Fundo */}
      <div
        className="approvals-light-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      {/* Hero Banner */}
      <div
        className={`approvals-hero approvals-light-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
        style={{
          backgroundColor: isDark ? '#111216' : '#ffffff',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="approvals-light-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
              : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="approvals-light-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="approvals-light-hero-copy max-w-xl space-y-2">
            <div className={`approvals-light-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
            }`}>
              <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
              CENTRAL DE GESTÃO & AUDITORIA DE PONTO
            </div>
            <h1 className={`approvals-light-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Aprovações e{' '}
              <span style={{
                background: 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Faltas
              </span>
            </h1>

            <p className={`approvals-light-description text-xs sm:text-sm leading-relaxed ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Central unificada para análise de atestados médicos, gestão de ocorrências, homologação de justificativas e aprovação de trocas de escala em tempo real.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenExportApprovals}
              className="approvals-light-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)',
              }}
              title="Exportar folha mensal consolidada de aprovações e faltas em CSV"
            >
              <Download className="w-4 h-4" /> Exportar Relatório CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="approvals-light-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {[
          {
            label: 'Pendentes de Aprovação',
            value: String(pendingCount).padStart(2, '0'),
            sub: 'Requer atenção imediata',
            dotColor: '#ff601f',
            dotGlow: '#ff601f',
            hasDotInSub: true,
          },
          {
            label: 'Faltas Registradas no Mês',
            value: String(faltasMesRows.length).padStart(2, '0'),
            sub: faltasJustificadasMes > 0 ? `${faltasJustificadasMes} abonada(s) no mês` : 'Ocorrências no mês atual',
            dotColor: '#e90045',
            dotGlow: '#e90045',
            hasDotInSub: false,
          },
          {
            label: 'Atestados Anexados',
            value: String(atestadosCount).padStart(2, '0'),
            sub: 'Comprovantes anexados pelo colaborador',
            dotColor: '#38bdf8',
            dotGlow: '#38bdf8',
            hasDotInSub: false,
          },
          {
            label: 'Taxa de Assiduidade',
            value: assiduidadePct !== null ? `${assiduidadePct}%` : '—',
            sub: assiduidadePct === null ? 'Sem turnos apurados' : assiduidadePct >= 95 ? '▲ Meta atingida (≥ 95%)' : 'Abaixo da meta (95%)',
            dotColor: '#49d982',
            dotGlow: '#49d982',
            hasDotInSub: false,
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`approval-kpi approvals-light-kpi p-5 rounded-2xl border space-y-2 transition-transform hover:-translate-y-1 ${
              isDark
                ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]'
                : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
            }`}
            style={{ boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between">
              <span className={`approvals-light-kpi-label text-[11px] font-semibold uppercase tracking-wider block ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>{kpi.label}</span>
              <span
                className="approvals-light-kpi-dot w-2.5 h-2.5 rounded-full"
                style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
              />
            </div>
            <div className={`approvals-light-kpi-value text-3xl font-extrabold font-sans ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>{kpi.value}</div>
            <span className={`approvals-light-kpi-sub text-[11px] font-medium flex items-center gap-1.5 ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
              {kpi.hasDotInSub && <span className="w-1.5 h-1.5 rounded-full bg-[#F59242]" />}
              {kpi.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Filter Bar (Busca, Departamentos e Período De / Até) */}
      <div
        className={`approval-filter-bar approvals-light-filter p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
          isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className={`approvals-light-search-icon w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={approvalsSearch}
              onChange={(e) => setApprovalsSearch(e.target.value)}
              placeholder="Filtrar por colaborador, setor ou data (ex: 26-10-2026)..."
              className={`approvals-light-search w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors border ${
                isDark
                  ? 'bg-[#0e0f12] text-white placeholder:text-slate-500 border-[#282a33] focus:border-[#F59242]'
                  : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border-slate-200 focus:border-[#96183c]'
              }`}
            />
          </div>

          <select
            value={approvalsDept}
            onChange={(e) => setApprovalsDept(e.target.value)}
            className={`approvals-light-department py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer border ${
              isDark
                ? 'bg-[#0e0f12] text-white border-[#282a33]'
                : 'bg-slate-50 text-slate-800 border-slate-200'
            }`}
            style={{ colorScheme: isDark ? 'dark' : 'light' }}
          >
            <option value="all" className={isDark ? 'bg-[#0e0f12] text-white' : 'bg-white text-slate-800'}>Todos os Departamentos</option>
            {departments.map(d => (
              <option key={d} value={d} className={isDark ? 'bg-[#0e0f12] text-white' : 'bg-white text-slate-800'}>
                {d}
              </option>
            ))}
          </select>

          {/* Filtro por Período (De / Até) */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <span>De</span>
              <input
                type="date"
                aria-label="Data inicial do período"
                value={approvalsDateFrom}
                onChange={(e) => setApprovalsDateFrom(e.target.value)}
                className={`py-1.5 px-3 text-xs rounded-full outline-none border font-mono ${
                  isDark
                    ? 'bg-[#0e0f12] text-white border-[#282a33] focus:border-[#F59242]'
                    : 'bg-slate-50 text-slate-800 border-slate-200 focus:border-[#96183c]'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </label>

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <span>Até</span>
              <input
                type="date"
                aria-label="Data final do período"
                value={approvalsDateTo}
                onChange={(e) => setApprovalsDateTo(e.target.value)}
                className={`py-1.5 px-3 text-xs rounded-full outline-none border font-mono ${
                  isDark
                    ? 'bg-[#0e0f12] text-white border-[#282a33] focus:border-[#F59242]'
                    : 'bg-slate-50 text-slate-800 border-slate-200 focus:border-[#96183c]'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </label>

            {hasPeriodFilter && (
              <button
                type="button"
                onClick={() => {
                  setApprovalsDateFrom('');
                  setApprovalsDateTo('');
                }}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Limpar filtro de período"
              >
                <X className="w-3 h-3" />
                <span>Limpar período</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pílulas de Categoria Rápida */}
      <div className="flex flex-wrap items-center gap-2 relative z-10">
        {CATEGORY_CHIPS.map(cat => {
          const isActive = approvalsTypeFilter === cat.id;
          const count = approvalsData.filter(
            row =>
              matchesDatePeriodRange(row.date, approvalsDateFrom, approvalsDateTo) &&
              matchesApprovalTypeFilter(row, cat.id)
          ).length;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setApprovalsTypeFilter(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isActive
                  ? 'text-white border-[#80142B] font-black'
                  : isDark
                  ? 'bg-[#15161b] text-slate-400 hover:text-white border-[#282a33] hover:border-[#3b3e4c]'
                  : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:border-slate-300'
              }`}
              style={
                isActive
                  ? { background: 'linear-gradient(135deg, #640C1E 0%, #9F243C 100%)', boxShadow: '0 4px 14px rgba(100, 12, 30, 0.35)' }
                  : undefined
              }
            >
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                isActive
                  ? 'bg-black/25 text-[#F9DE97]'
                  : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <div
        className={`approval-table-card approvals-light-table rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
          isDark ? 'bg-[#15161b] border-[#282a33] shadow-xl' : 'bg-white border-slate-200 shadow-md'
        }`}
      >
        <table className="approvals-light-data w-full border-collapse text-left text-xs font-sans min-w-[780px]">
          <thead>
            <tr
              className={`border-b font-mono text-[10px] uppercase ${
                isDark ? 'border-[#282a33] text-slate-400 bg-[#101115]' : 'border-slate-200 text-slate-500 bg-slate-50'
              }`}
            >
              <th className="p-3">COLABORADOR</th>
              <th className="p-3">TIPO & JUSTIFICATIVA</th>
              <th
                className="p-3 cursor-pointer select-none transition-colors hover:text-[#f89847] dark:hover:text-amber-400"
                onClick={() => setApprovalsDateSort(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                title="Clique para alternar ordem por data (mais recente / mais antigo)"
              >
                <div className="flex items-center gap-1">
                  <span>DATA</span>
                  {approvalsDateSort === 'desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              </th>
              <th className="p-3 text-center">COMPROVANTE</th>
              <th className="p-3 text-center">STATUS</th>
              <th className="p-3">OBSERVAÇÃO / FEEDBACK</th>
              <th
                className={`p-3 text-right pr-4 sticky right-0 z-20 shadow-[-6px_0_12px_rgba(0,0,0,0.08)] ${
                  isDark ? 'bg-[#101115]' : 'bg-slate-50'
                }`}
              >
                AÇÕES
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredApprovals.length === 0 ? (
              <tr>
                <td colSpan={7} className={`p-8 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nenhuma solicitação ou ocorrência encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filteredApprovals.map((row) => (
                <tr
                  key={row.id}
                  className={`approvals-light-row border-b transition-colors ${
                    isDark
                      ? 'border-white/5 hover:bg-white/[0.03] text-slate-200'
                      : 'border-slate-100 hover:bg-slate-50/80 text-slate-800'
                  }`}
                >
                  {/* Colaborador */}
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={row.employeeAvatar}
                        alt={row.employeeName}
                        className={`w-8 h-8 rounded-full object-cover shrink-0 ring-2 ${
                          isDark ? 'ring-white/10' : 'ring-slate-200'
                        }`}
                      />
                      <div>
                        <span className={`font-bold block text-xs leading-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}>{row.employeeName}</span>
                        <span className={`block text-[10.5px] font-normal leading-tight mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>{row.employeeRole}</span>
                      </div>
                    </div>
                  </td>

                  {/* Tipo & Justificativa */}
                  <td className="p-3 align-top">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold block text-xs leading-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}>{row.type}</span>
                        {row.type === 'Atraso de Entrada' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30">
                            -{row.diffMinutes || (row.reason.match(/(\d+)\s*min/)?.[1]) || 15} min
                          </span>
                        )}
                        {row.type === 'Hora Extra' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                            +{row.diffMinutes || (row.reason.match(/\+(\d+)\s*min/)?.[1]) || (row.reason.match(/(\d+)\s*min/)?.[1]) || 15} min
                          </span>
                        )}
                        {row.type === 'Saída Antecipada' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/15 text-orange-500 dark:text-orange-300 border border-orange-500/30">
                            -{row.diffMinutes || (row.reason.match(/-(\d+)\s*min/)?.[1]) || (row.reason.match(/(\d+)\s*min/)?.[1]) || 15} min
                          </span>
                        )}
                        {(row.type === 'Esquecimento de Saída' || row.type === 'Esquecimento de Entrada' || row.type === 'Esquecimento de Ponto') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                            Esquecimento
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedDetailOccurrence(row)}
                          className={`p-1 rounded-md transition-all cursor-pointer shadow-xs ${
                            isDark
                              ? 'text-[#f89847] hover:text-[#faf0ac] bg-[#f89847]/10 hover:bg-[#f89847]/20 border border-[#f89847]/30'
                              : 'text-[#9F243C] hover:text-[#640C1E] bg-[#9F243C]/10 hover:bg-[#9F243C]/20 border border-[#9F243C]/25'
                          }`}
                          title="Visualizar justificativa e histórico completo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="group/reason">
                        <p className={`text-[11px] font-normal leading-relaxed max-w-[220px] truncate ${
                          isDark ? 'text-slate-300' : 'text-slate-600'
                        }`} title={row.reason}>
                          {row.reason}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Data / Período */}
                  <td className="p-3 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-mono text-[11px] ${
                      isDark ? 'bg-white/5 border-white/5 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <Calendar className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span>{formatDateBR(row.date)}</span>
                    </div>
                  </td>

                  {/* Comprovante */}
                  <td className="p-3 text-center">
                    {row.documentUrl && row.documentUrl.trim() !== '' && row.documentUrl !== 'null' && row.documentUrl !== 'undefined' ? (
                      <button
                        type="button"
                        onClick={() => openDocumentSafe(row.documentUrl, row.documentName)}
                        className={`approvals-light-proof p-1.5 rounded-lg border hover:scale-110 active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs ${
                          isDark
                            ? 'text-[#f89847] bg-[#f89847]/10 border-[#f89847]/25 hover:bg-[#f89847]/25'
                            : 'text-[#96183c] bg-[#96183c]/10 border-[#96183c]/25 hover:bg-[#96183c]/20'
                        }`}
                        title={`Abrir comprovante: ${row.documentName || 'Anexo'}`}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs font-mono select-none" title="Sem anexo">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center">
                      {row.status === 'Aprovado' && (
                        <span
                          className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] inline-block cursor-help transition-transform hover:scale-125"
                          title="Aprovado"
                        />
                      )}
                      {row.status === 'Recusado / Falta' && (
                        <span
                          className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] inline-block cursor-help transition-transform hover:scale-125"
                          title="Recusado / Falta"
                        />
                      )}
                      {row.status === 'Falta Lançada' && (
                        <span
                          className="w-3 h-3 rounded-full bg-rose-600 shadow-[0_0_8px_#e11d48] inline-block cursor-help transition-transform hover:scale-125"
                          title="Falta Lançada"
                        />
                      )}
                      {row.status === 'Pendente' && (
                        <span
                          className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse inline-block cursor-help transition-transform hover:scale-125"
                          title="Pendente de Homologação"
                        />
                      )}
                    </div>
                  </td>

                  {/* Observação / Feedback */}
                  <td className="p-3">
                    <input
                      type="text"
                      value={row.feedback}
                      onChange={(e) => onUpdateFeedback(row.id, e.target.value)}
                      placeholder="Observação (opcional)..."
                      className={`approvals-light-feedback w-full min-w-[120px] max-w-[180px] px-2.5 py-1.5 rounded-xl text-xs outline-none transition-colors border ${
                        isDark
                          ? 'bg-[#0e0f12] border-[#282a33] focus:border-[#ff601f] text-slate-200 placeholder:text-slate-600'
                          : 'bg-slate-50 border-slate-200 focus:border-[#96183c] text-slate-800 placeholder:text-slate-400'
                      }`}
                    />
                  </td>

                  {/* Ações */}
                  <td
                    className={`p-3 text-right pr-4 sticky right-0 z-10 ${
                      isDark
                        ? 'bg-[#15161b] shadow-[-6px_0_12px_rgba(0,0,0,0.35)]'
                        : 'bg-white shadow-[-6px_0_12px_rgba(0,0,0,0.06)]'
                    }`}
                  >
                    {row.status === 'Pendente' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {row.type === 'Falta Não Justificada' ? (
                          <button
                            type="button"
                            onClick={() => onRejectOccurrence(row.id)}
                            title="Descontar Falta: Confirma falta injustificada para desconto em folha (1 dia de salário + perda de DSR semanal)"
                            className="approvals-light-reject px-3 py-1.5 border border-rose-500/40 text-rose-500 dark:text-rose-300 hover:bg-rose-500/15 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 shadow-xs"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                            <span>Descontar</span>
                          </button>
                        ) : row.type === 'Atraso de Entrada' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onApproveOccurrence(row.id)}
                              title="Abonar Atraso: Justifica e abona os minutos de atraso (sem débito)"
                              className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Abonar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectOccurrence(row.id)}
                              title="Debitar Atraso: Confirma débito de atraso para compensação no Banco de Horas"
                              className="approvals-light-reject px-2 py-1.5 border border-rose-500/30 text-rose-500 dark:text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Debitar</span>
                            </button>
                          </>
                        ) : row.type === 'Hora Extra' || row.type?.includes('Esquecimento') ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onApproveOccurrence(row.id)}
                              title={
                                row.type?.includes('Esquecimento')
                                  ? 'Homologar Esquecimento: Ajusta para o horário contratual sem gerar débito ou hora extra indevida'
                                  : 'Homologar Hora Extra: Aprova para crédito no Banco de Horas ou pagamento em Folha'
                              }
                              className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Homologar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectOccurrence(row.id)}
                              title="Ajustar Horário Normal: Trata para a jornada contratual sem gerar HE indevida (Art. 4º CLT)"
                              className="approvals-light-reject px-2 py-1.5 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Ajustar</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onApproveOccurrence(row.id)}
                              title="Aprovar Solicitação"
                              className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectOccurrence(row.id)}
                              title="Recusar Solicitação"
                              className="approvals-light-reject px-2 py-1.5 border border-rose-500/30 text-rose-500 dark:text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Recusar</span>
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px] italic">
                        {row.actionText || 'Processado'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes da Solicitação / Justificativa Completa */}
      {selectedDetailOccurrence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedDetailOccurrence(null)}
        >
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden relative flex flex-col my-auto transition-all animate-in zoom-in-95 ${
              isDark ? 'bg-[#15161b] border-white/10 text-white' : 'bg-white border-[#E8DCCB] text-slate-800'
            }`}
            style={{
              boxShadow: isDark
                ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(150, 24, 60, 0.2)'
                : '0 20px 40px -10px rgba(100, 12, 30, 0.15)',
              maxHeight: '92vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #96183c, #f89847, #faf0ac)' }} />

            {/* Header */}
            <div
              className={`p-5 flex items-center justify-between border-b ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #190a12 0%, #170d18 50%, #20101c 100%)'
                  : 'linear-gradient(135deg, #FFFDF8 0%, #FCFAF5 100%)',
              }}
            >
              <div className="flex items-center gap-3.5">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${
                    isDark ? 'text-white' : 'text-[#640C1E]'
                  }`}>
                    {selectedDetailOccurrence.type === 'Falta Não Justificada'
                      ? 'Registro de Falta Não Justificada'
                      : selectedDetailOccurrence.type === 'Atraso de Entrada'
                      ? 'Registro de Atraso de Entrada'
                      : selectedDetailOccurrence.type === 'Hora Extra'
                      ? 'Registro de Hora Extra'
                      : 'Detalhes da Solicitação'}
                  </h3>
                  <p className={`text-xs mt-0.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {selectedDetailOccurrence.type === 'Falta Não Justificada'
                      ? 'Ocorrência apurada automaticamente após 24h sem ponto'
                      : 'Justificativa completa enviada pelo colaborador'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDetailOccurrence(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedDetailOccurrence.employeeAvatar}
                    alt={selectedDetailOccurrence.employeeName}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-[#f89847]/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className={`font-bold text-sm block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedDetailOccurrence.employeeName}
                    </span>
                    <span className={`text-xs block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {selectedDetailOccurrence.employeeRole} • {selectedDetailOccurrence.employeeDept}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {selectedDetailOccurrence.status === 'Aprovado' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                      Aprovado
                    </span>
                  )}
                  {selectedDetailOccurrence.status === 'Recusado / Falta' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                      Recusado
                    </span>
                  )}
                  {selectedDetailOccurrence.status === 'Falta Lançada' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                      Falta Lançada
                    </span>
                  )}
                  {selectedDetailOccurrence.status === 'Pendente' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
                      Pendente
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                    TIPO DE SOLICITAÇÃO
                  </span>
                  <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedDetailOccurrence.type}
                  </span>
                </div>

                <div className={`p-3 rounded-xl border ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                    DATA / PERÍODO
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                    <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatDateBR(selectedDetailOccurrence.date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#f89847] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    {selectedDetailOccurrence.type === 'Falta Não Justificada'
                      ? 'SITUAÇÃO DO REGISTRO DE PONTO'
                      : 'JUSTIFICATIVA DO COLABORADOR'}
                  </span>
                </label>
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed whitespace-pre-wrap ${
                  isDark ? 'bg-[#0e0f12] border-white/10 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  {selectedDetailOccurrence.reason ||
                    (selectedDetailOccurrence.type === 'Falta Não Justificada'
                      ? 'Turno encerrado há mais de 24 horas sem registro de ponto e sem envio de atestado/justificativa pelo colaborador.'
                      : 'Nenhuma justificativa detalhada foi fornecida.')}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                  COMPROVANTE / DOCUMENTO ANEXO
                </label>
                {selectedDetailOccurrence.documentUrl &&
                selectedDetailOccurrence.documentUrl.trim() !== '' &&
                selectedDetailOccurrence.documentUrl !== 'null' &&
                selectedDetailOccurrence.documentUrl !== 'undefined' ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-[#f89847]/30 bg-[#f89847]/10">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-[#f89847]" />
                      <span className="text-xs font-mono font-bold text-[#f89847]">
                        {selectedDetailOccurrence.documentName || 'Comprovante'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDocumentSafe(selectedDetailOccurrence.documentUrl, selectedDetailOccurrence.documentName)}
                      className="text-xs font-bold text-white bg-[#f89847] hover:bg-[#ff601f] px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      Abrir Anexo
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sem comprovante anexado</p>
                )}
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                  OBSERVAÇÃO / FEEDBACK DO GESTOR
                </label>
                <textarea
                  rows={2}
                  value={selectedDetailOccurrence.feedback || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateFeedback(selectedDetailOccurrence.id, val);
                    setSelectedDetailOccurrence(prev => (prev ? { ...prev, feedback: val } : null));
                  }}
                  placeholder="Insira uma observação ou orientação que o colaborador verá no portal dele..."
                  className={`w-full p-3 rounded-xl border text-xs outline-none transition-all resize-none ${
                    isDark
                      ? 'bg-[#0e0f12] border-white/10 text-white placeholder:text-slate-600 focus:border-[#f89847]'
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#f89847]'
                  }`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
              isDark ? 'border-white/10 bg-[#121318]' : 'border-slate-200 bg-slate-50'
            }`}>
              <button
                type="button"
                onClick={() => setSelectedDetailOccurrence(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Fechar
              </button>

              {selectedDetailOccurrence.status === 'Pendente' ? (
                <div className="flex items-center gap-2">
                  {selectedDetailOccurrence.type === 'Falta Não Justificada' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRejectOccurrence(selectedDetailOccurrence.id);
                        setSelectedDetailOccurrence(prev =>
                          prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Desconto em Folha' } : null
                        );
                      }}
                      className="px-4 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Descontar Falta</span>
                    </button>
                  ) : selectedDetailOccurrence.type === 'Atraso de Entrada' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onRejectOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Debitado' } : null
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Debitar Atraso</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onApproveOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Aprovado', actionText: 'Abonado' } : null
                          );
                        }}
                        className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Abonar Atraso</span>
                      </button>
                    </>
                  ) : selectedDetailOccurrence.type === 'Hora Extra' || selectedDetailOccurrence.type?.includes('Esquecimento') ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onRejectOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Ajustado' } : null
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Ajustar Horário Contratual</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onApproveOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Aprovado', actionText: 'Homologado' } : null
                          );
                        }}
                        className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{selectedDetailOccurrence.type?.includes('Esquecimento') ? 'Homologar Esquecimento' : 'Homologar Hora Extra'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onRejectOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Recusado agora' } : null
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Recusar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onApproveOccurrence(selectedDetailOccurrence.id);
                          setSelectedDetailOccurrence(prev =>
                            prev ? { ...prev, status: 'Aprovado', actionText: 'Homologado agora' } : null
                          );
                        }}
                        className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aprovar Solicitação</span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs font-mono text-slate-400 italic">
                  Solicitação já processada ({selectedDetailOccurrence.status})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Solicitação / Lançar Falta */}
      {isNewOccurrenceModalOpen && (
        <div className="approvals-light-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className="approval-modal approvals-light-modal w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl relative"
            style={{ background: '#15161b' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#e90045]" />
                <h3 className="text-base font-bold text-white">Nova Solicitação / Lançar Falta</h3>
              </div>
              <button
                onClick={() => setIsNewOccurrenceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewOccurrence} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Colaborador</label>
                <select
                  value={newOccurrenceForm.employeeId}
                  onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.department})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipo da Ocorrência</label>
                  <select
                    value={newOccurrenceForm.type}
                    onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                  >
                    <option value="Atestado Médico">Atestado Médico</option>
                    <option value="Troca de Turno">Troca de Turno</option>
                    <option value="Folga Compensatória">Folga Compensatória</option>
                    <option value="Falta Injustificada">Falta Injustificada</option>
                    <option value="Abono Especial">Abono Especial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Data / Período</label>
                  <input
                    type="text"
                    value={newOccurrenceForm.date}
                    onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, date: e.target.value })}
                    placeholder="Ex: 21/09/2026"
                    className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Motivo / Descrição</label>
                <textarea
                  rows={2}
                  value={newOccurrenceForm.reason}
                  onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, reason: e.target.value })}
                  placeholder="Descreva o motivo informado pelo colaborador ou justificativa..."
                  className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Comprovante / Anexo</label>
                  <input
                    type="text"
                    value={newOccurrenceForm.documentName}
                    onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, documentName: e.target.value })}
                    placeholder="Ex: atestado.pdf ou Não se aplica"
                    className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Status Inicial</label>
                  <select
                    value={newOccurrenceForm.status}
                    onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, status: e.target.value as ApprovalItem['status'] })}
                    className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Falta Lançada">Falta Lançada</option>
                    <option value="Recusado / Falta">Recusado / Falta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Observação ou Feedback para o Colaborador</label>
                <input
                  type="text"
                  value={newOccurrenceForm.feedback}
                  onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, feedback: e.target.value })}
                  placeholder="Observação ou feedback para o colaborador (opcional)..."
                  className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewOccurrenceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer hover:scale-105"
                  style={{ background: 'linear-gradient(90deg, #e90045 0%, #ff601f 100%)' }}
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
