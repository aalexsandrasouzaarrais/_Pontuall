import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Clock,
  Calendar,
  MapPin,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Employee, Shift } from '@/types';
import {
  formatDateBR,
  getTodayDateString,
  normalizeDateToISO,
  parseDateSortTimestamp,
  matchesDateSearchQuery,
} from '@/shared/utils/dateUtils';
import { showPolishedToast } from '@/components/ui/halo-toast';

export interface AttendanceReportRow {
  date: string;
  avatar: string;
  name: string;
  role: string;
  dept: string;
  scheduledShift: string;
  punchReal: string;
  time: string;
  hours: string;
  status: 'Presente' | 'Atrasado' | 'Ausente' | 'Justificado' | 'Pendente';
  isDecisionPending: boolean;
  type: string;
  apuracao: string;
  apuracaoKind: 'overtime' | 'deficit' | 'regular' | 'falta' | 'pending';
  checkInLocation?: Shift['checkInLocation'];
  checkOutLocation?: Shift['checkOutLocation'];
  isGpsOutside: boolean;
  gpsDist: string;
  cleanObs: string;
  obsFull: string;
  obs: string;
}

interface AttendanceReportTabProps {
  employees: Employee[];
  shifts: Shift[];
  reportRows: AttendanceReportRow[];
  departments: string[];
  expiringAttendanceInfo: { count: number; daysLeft: number } | null;
  isDark: boolean;
  onOpenExportAttendance: () => void;
  onExportCsv: (targetMonth?: string, targetDept?: string) => void;
}

/**
 * Aba Relatório de Presenças da equipe (contexto de frequência / attendance).
 */
export const AttendanceReportTab: React.FC<AttendanceReportTabProps> = ({
  employees,
  shifts,
  reportRows,
  departments,
  expiringAttendanceInfo,
  isDark,
  onOpenExportAttendance,
  onExportCsv,
}) => {
  const [relatorioSearch, setRelatorioSearch] = useState('');
  const [relatorioDate] = useState('');
  const [relatorioStatus, setRelatorioStatus] = useState('all');
  const [relatorioDept, setRelatorioDept] = useState('all');
  const [relatorioDateSort, setRelatorioDateSort] = useState<'desc' | 'asc'>('desc');

  const monthClosingInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    if (day < 25 && day > 3) return null;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const targetDate = day <= 3 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
    const targetMonthName = monthNames[targetDate.getMonth()];
    const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      isStartOfNextMonth: day <= 3,
      monthName: targetMonthName,
      monthKey: targetKey,
    };
  }, []);

  const [isRetentionNoticeDismissed, setIsRetentionNoticeDismissed] = useState<boolean>(() => {
    try {
      const dismissedUntil = localStorage.getItem('pontuall_retention_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return true;
      }
    } catch {
      // Ignora erro de acesso a localStorage
    }
    return false;
  });

  const handleDismissRetentionNotice = () => {
    setIsRetentionNoticeDismissed(true);
    try {
      localStorage.setItem('pontuall_retention_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // Ignora erro de acesso a localStorage
    }
  };

  const kpis = useMemo(() => {
    const todayIso = getTodayDateString();
    const todayShiftsList = shifts.filter(s => normalizeDateToISO(s.date) === todayIso);
    const todayWithPunch = todayShiftsList.filter(s => Boolean(s.checkInTime)).length;
    const evaluatedRelRows = reportRows.filter(r => r.status !== 'Pendente');
    const unexcusedRelAbsences = evaluatedRelRows.filter(r => r.status === 'Ausente').length;
    const presencaPct =
      evaluatedRelRows.length > 0
        ? Math.round(((evaluatedRelRows.length - unexcusedRelAbsences) / evaluatedRelRows.length) * 100)
        : null;
    const periodAbsenceRows = reportRows.filter(
      r => r.status === 'Ausente' || (r.status === 'Justificado' && r.punchReal === 'Sem registro')
    );
    const periodJustifiedAbsences = periodAbsenceRows.filter(r => r.status === 'Justificado').length;

    return [
      {
        label: 'Taxa de Presença',
        value: presencaPct !== null ? `${presencaPct}%` : '—',
        sub: presencaPct === null ? 'Sem turnos apurados' : presencaPct >= 95 ? '▲ Meta atingida (≥ 95%)' : 'Abaixo da meta (95%)',
        dotColor: '#49d982',
        dotGlow: '#49d982',
      },
      {
        label: 'Colaboradores Ativos',
        value: String(employees.length).padStart(2, '0'),
        sub: 'Total cadastrado na base',
        dotColor: '#F59242',
        dotGlow: '#F59242',
      },
      {
        label: 'Escalas Hoje',
        value: String(todayShiftsList.length).padStart(2, '0'),
        sub: todayShiftsList.length > 0 ? `${todayWithPunch} com ponto registrado` : 'Nenhuma escala para hoje',
        dotColor: '#F9DE97',
        dotGlow: '#F9DE97',
      },
      {
        label: 'Faltas no Período',
        value: String(periodAbsenceRows.length).padStart(2, '0'),
        sub: periodJustifiedAbsences > 0 ? `${periodJustifiedAbsences} abonada(s) c/ justificativa` : 'Nenhuma falta abonada no período',
        dotColor: '#9F243C',
        dotGlow: '#9F243C',
      },
    ];
  }, [employees.length, reportRows, shifts]);

  const filteredRows = useMemo(() => {
    return reportRows
      .filter(row => {
        if (relatorioDate) {
          if (normalizeDateToISO(row.date) !== normalizeDateToISO(relatorioDate)) {
            return false;
          }
        }

        if (relatorioSearch.trim()) {
          const q = relatorioSearch.toLowerCase().trim();
          const matchName = (row.name || '').toLowerCase().includes(q);
          const matchDept = (row.dept || '').toLowerCase().includes(q);
          const matchRole = (row.role || '').toLowerCase().includes(q);
          const matchDate = matchesDateSearchQuery(row.date, q);
          const matchApuracao = (row.apuracao || '').toLowerCase().includes(q);
          if (!matchName && !matchDept && !matchRole && !matchDate && !matchApuracao) {
            return false;
          }
        }

        const matchDept = relatorioDept === 'all' || row.dept === relatorioDept;
        const matchStatus =
          relatorioStatus === 'all' ||
          (relatorioStatus === 'present' && row.status === 'Presente') ||
          (relatorioStatus === 'late' && row.status === 'Atrasado') ||
          (relatorioStatus === 'absent' && row.status === 'Ausente') ||
          (relatorioStatus === 'justified' && row.status === 'Justificado') ||
          (relatorioStatus === 'pending' && row.status === 'Pendente');
        return matchDept && matchStatus;
      })
      .sort((a, b) => {
        const timeA = parseDateSortTimestamp(a.date);
        const timeB = parseDateSortTimestamp(b.date);
        if (timeA !== timeB) {
          return relatorioDateSort === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [reportRows, relatorioDate, relatorioSearch, relatorioDept, relatorioStatus, relatorioDateSort]);

  return (
    <div className="attendance-report space-y-6 animate-in fade-in duration-200 relative">
      {/* Efeito Glow de Fundo */}
      <div
        className="attendance-report-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      {/* Hero Banner */}
      <div
        className={`approvals-hero attendance-report-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
        style={{
          backgroundColor: isDark ? '#111216' : '#ffffff',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="attendance-report-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
              : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="attendance-report-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className={`attendance-report-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
            }`}>
              <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
              <span>GESTÃO INTELIGENTE DE EQUIPES</span>
            </div>
            <h1 className={`attendance-report-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Relatório de{' '}
              <span style={{
                background: isDark
                  ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)'
                  : 'linear-gradient(90deg, #640C1E 0%, #9F243C 52%, #F59242 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Presenças
              </span>
            </h1>
            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Consolidação em tempo real de jornadas, faltas justificadas, assiduidade e histórico operacional.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenExportAttendance}
              className="attendance-report-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)',
              }}
            >
              <Download className="w-4 h-4" /> Exportar Relatório CSV
            </button>
          </div>
        </div>
      </div>

      {/* Micro-aviso Sutil e Condicional: Fechamento de Mês OU Retenção de 60 Dias */}
      {(monthClosingInfo || expiringAttendanceInfo) && !isRetentionNoticeDismissed && (
        <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 text-xs relative z-10 transition-colors animate-in fade-in duration-300 ${
          isDark
            ? 'bg-amber-950/25 border-amber-500/25 text-amber-200/90'
            : 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-xs'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {monthClosingInfo ? (
                <>
                  <strong className="font-semibold">Fechamento Mensal:</strong>{' '}
                  {monthClosingInfo.isStartOfNextMonth
                    ? `Lembre-se de salvar a folha de presenças do mês de ${monthClosingInfo.monthName} para o arquivo da empresa.`
                    : `O mês de ${monthClosingInfo.monthName} está encerrando. Exporte a folha mensal consolidada.`}
                </>
              ) : (
                <>
                  <strong className="font-semibold">Aviso de Retenção:</strong> Registros mais antigos expiram em cerca de {expiringAttendanceInfo?.daysLeft} {expiringAttendanceInfo?.daysLeft === 1 ? 'dia' : 'dias'}. Lembre-se de exportar a folha mensal.
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                if (monthClosingInfo) {
                  onExportCsv(monthClosingInfo.monthKey);
                  showPolishedToast({
                    title: 'Folha mensal exportada!',
                    description: `A folha consolidada de ${monthClosingInfo.monthName} foi baixada em CSV.`,
                    rimVariant: 'success',
                  });
                } else {
                  onOpenExportAttendance();
                }
              }}
              className="font-bold underline hover:no-underline text-amber-600 dark:text-amber-400 shrink-0 cursor-pointer text-xs"
            >
              {monthClosingInfo ? `Exportar ${monthClosingInfo.monthName}` : 'Exportar CSV'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDismissRetentionNotice}
            className={`p-1 rounded-md transition-colors shrink-0 cursor-pointer ${
              isDark ? 'text-amber-400/60 hover:text-amber-200 hover:bg-white/5' : 'text-amber-800/60 hover:text-amber-950 hover:bg-amber-100'
            }`}
            title="Dispensar aviso por 7 dias"
            aria-label="Dispensar aviso de retenção"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Relatório de Presenças da Equipe */}
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* KPI Cards */}
        <div className="attendance-report-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className={`approval-kpi attendance-report-kpi p-5 rounded-2xl border space-y-2 transition-transform hover:-translate-y-1 ${
                isDark
                  ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]'
                  : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              }`}
              style={{ boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className={`attendance-report-kpi-label text-[11px] font-semibold uppercase tracking-wider block ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>{kpi.label}</span>
                <span
                  className="attendance-report-kpi-dot w-2.5 h-2.5 rounded-full"
                  style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                />
              </div>
              <div className={`attendance-report-kpi-value text-3xl font-extrabold font-sans ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>{kpi.value}</div>
              <span className={`attendance-report-kpi-sub text-[11px] font-medium block ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>{kpi.sub}</span>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div
          className={`approval-filter-bar attendance-report-filters p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
            isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`} />
              <input
                type="text"
                value={relatorioSearch}
                onChange={(e) => setRelatorioSearch(e.target.value)}
                placeholder="Filtrar por colaborador, setor ou data (ex: 26-10-2026)..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors ${
                  isDark
                    ? 'bg-[#0e0f12] text-white placeholder:text-slate-500 border border-[#282a33] focus:border-[#F59242]'
                    : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-[#9F243C]'
                }`}
              />
            </div>

            <select
              value={relatorioStatus}
              onChange={(e) => setRelatorioStatus(e.target.value)}
              className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer ${
                isDark
                  ? 'bg-[#0e0f12] text-white border border-[#282a33]'
                  : 'bg-slate-50 text-slate-900 border border-slate-200'
              }`}
            >
              <option value="all">Todos os Status</option>
              <option value="present">Presente</option>
              <option value="late">Atrasado</option>
              <option value="absent">Ausente</option>
              <option value="justified">Justificado</option>
              <option value="pending">Pendente</option>
            </select>

            <select
              value={relatorioDept}
              onChange={(e) => setRelatorioDept(e.target.value)}
              className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer ${
                isDark
                  ? 'bg-[#0e0f12] text-white border border-[#282a33]'
                  : 'bg-slate-50 text-slate-900 border border-slate-200'
              }`}
            >
              <option value="all">Todos os Departamentos</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div
          className={`attendance-report-table rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
            isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
            <thead>
              <tr className={`border-b font-mono text-[10px] uppercase transition-colors ${
                isDark
                  ? 'border-[#282a33] bg-[#101115] text-slate-400'
                  : 'border-[#640C1E]/30 bg-gradient-to-r from-[#640C1E] to-[#9F243C] text-[#F9DE97] shadow-sm'
              }`}>
                <th
                  className="p-3.5 font-bold tracking-wider cursor-pointer select-none transition-opacity hover:opacity-80"
                  onClick={() => setRelatorioDateSort(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                  title="Clique para alternar ordem por data (mais recente / mais antigo)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>DATA</span>
                    {relatorioDateSort === 'desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-[#F9DE97] dark:text-amber-400" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-[#F9DE97] dark:text-amber-400" />
                    )}
                  </div>
                </th>
                <th className="p-3.5 font-bold tracking-wider">COLABORADOR</th>
                <th className="p-3.5 font-bold tracking-wider">DEPARTAMENTO</th>
                <th className="p-3.5 font-bold tracking-wider">ESCALA PREVISTA</th>
                <th className="p-3.5 font-bold tracking-wider">PONTO REALIZADO</th>
                <th className="p-3.5 font-bold tracking-wider">CARGA</th>
                <th className="p-3.5 font-bold tracking-wider text-center">STATUS</th>
                <th className="p-3.5 font-bold tracking-wider">APURAÇÃO / SALDO</th>
                <th className="p-3.5 font-bold tracking-wider">OBSERVAÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b transition-colors ${
                    isDark
                      ? 'border-white/5 hover:bg-white/[0.03] text-slate-200'
                      : 'border-slate-100 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <td className={`p-3.5 font-mono text-[11px] whitespace-nowrap ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] ${
                      isDark ? 'bg-white/5 border border-white/5 text-slate-300' : 'bg-slate-100 border border-slate-200 text-slate-700'
                    }`}>
                      <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span>{formatDateBR(row.date)}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full p-[1.5px] shrink-0"
                        style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                      >
                        <img
                          src={row.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                          alt={row.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div>
                        <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</span>
                        <span className={`block text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{row.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`p-3.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.dept}</td>
                  <td className={`p-3.5 font-mono text-[11px] whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span>{row.scheduledShift}</span>
                  </td>
                  <td className={`p-3.5 font-mono text-[11px] whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className={row.punchReal === 'Sem registro' ? (isDark ? 'text-slate-500 italic' : 'text-slate-400 italic') : ''}>
                      {row.punchReal}
                    </span>
                  </td>
                  <td className={`p-3.5 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.hours}</td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center">
                      <span
                        className="w-3 h-3 rounded-full inline-block cursor-help transition-transform hover:scale-125"
                        style={{
                          background: row.status === 'Presente'
                            ? (row.isGpsOutside ? '#f97316' : '#49d982')
                            : row.status === 'Atrasado' ? '#fbbf24' : row.status === 'Ausente' ? '#ef4444' : row.status === 'Justificado' ? '#38bdf8' : '#94a3b8',
                          boxShadow: `0 0 8px ${row.status === 'Presente' ? (row.isGpsOutside ? '#f97316' : '#49d982') : row.status === 'Atrasado' ? '#fbbf24' : row.status === 'Ausente' ? '#ef4444' : row.status === 'Justificado' ? '#38bdf8' : '#94a3b8'}`,
                        }}
                        title={
                          row.status === 'Presente' && row.isGpsOutside
                            ? `Presente (Fora do Posto${row.gpsDist ? ` • ${row.gpsDist}` : ''})`
                            : row.status === 'Presente'
                            ? 'Presente (No Posto)'
                            : row.status
                        }
                      />
                    </div>
                  </td>
                  <td className="p-3.5 text-[11px] whitespace-nowrap">
                    {row.apuracaoKind === 'overtime' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {row.apuracao}
                      </span>
                    ) : row.apuracaoKind === 'deficit' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {row.apuracao}
                      </span>
                    ) : row.apuracaoKind === 'falta' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {row.apuracao}
                      </span>
                    ) : row.apuracaoKind === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        {row.apuracao}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                        isDark ? 'bg-white/5 text-slate-300 border border-white/10' : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {row.apuracao}
                      </span>
                    )}
                  </td>
                  <td className={`p-3.5 text-[11px] max-w-[280px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <div className="flex items-center gap-2 truncate" title={row.obsFull || row.cleanObs}>
                      {row.isGpsOutside && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <MapPin className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          <span>Fora do posto {row.gpsDist ? `(${row.gpsDist})` : ''}</span>
                        </span>
                      )}
                      <span className="truncate text-slate-400 text-[11px]">{row.cleanObs}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
