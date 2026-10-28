import React, { useState, useMemo, useEffect } from 'react';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ExternalLink, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Eye, 
  Check, 
  X, 
  Calendar, 
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Timer,
  FolderGit2,
  FileSpreadsheet,
  Download,
  Building2,
  Hash
} from 'lucide-react';
import { Employee, PjDeliverableReport, PjTimesheetEntry } from '@/types';
import { 
  getPjReportsSupabase, 
  getDraftTimesheet, 
  exportPjTimesheetSpreadsheet,
  ExportTimesheetRow 
} from '@/modules/attendance/services/pjReportService';

interface ManagerPjDeliverablesViewProps {
  employees: Employee[];
  pjReports: PjDeliverableReport[];
  onApproveReport?: (id: string) => void;
  onRejectReport?: (id: string, reason?: string) => void;
  isDark?: boolean;
  isRh?: boolean;
}

export const ManagerPjDeliverablesView: React.FC<ManagerPjDeliverablesViewProps> = ({
  employees,
  pjReports = [],
  onApproveReport,
  onRejectReport,
  isDark = true,
  isRh = false,
}) => {
  const [localReports, setLocalReports] = useState<PjDeliverableReport[]>(pjReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [expandedReportDetails, setExpandedReportDetails] = useState<Record<string, boolean>>({});

  // Sincroniza relatórios com o serviço ao montar ou quando pjReports mudar
  useEffect(() => {
    setLocalReports(pjReports);
  }, [pjReports]);

  useEffect(() => {
    let active = true;
    getPjReportsSupabase().then(fresh => {
      if (active && fresh && fresh.length > 0) {
        // Mescla garantindo que entradas recém criadas em memória também apareçam
        setLocalReports(prev => {
          const map = new Map<string, PjDeliverableReport>();
          fresh.forEach(r => map.set(r.id, r));
          prev.forEach(r => {
            const existing = map.get(r.id);
            if (!existing) {
              map.set(r.id, r);
            } else if ((!existing.timesheetEntries || existing.timesheetEntries.length === 0) && r.timesheetEntries?.length) {
              map.set(r.id, { ...existing, timesheetEntries: r.timesheetEntries });
            }
          });
          return Array.from(map.values());
        });
      }
    });
    return () => { active = false; };
  }, []);

  // Lista de todos os prestadores PJ (ou colaboradores que possuem relatórios PJ enviados)
  const pjEmployees = useMemo(() => {
    const reportEmpIds = new Set(localReports.map(r => r.employeeId));
    return employees.filter(e => e.contractType === 'PJ' || reportEmpIds.has(e.id));
  }, [employees, localReports]);

  // Agrupamento organizado por Colaborador PJ (estilo planilha/tabela do colaborador)
  const collaboratorGroups = useMemo(() => {
    // Conjunto de IDs de colaboradores a exibir
    const empIds = new Set<string>();
    pjEmployees.forEach(e => empIds.add(e.id));
    localReports.forEach(r => empIds.add(r.employeeId));

    return Array.from(empIds).map(empId => {
      const emp = employees.find(e => e.id === empId);
      const empReports = localReports.filter(r => r.employeeId === empId);
      const draftEntries = getDraftTimesheet(empId);

      const defaultCC = emp?.department
        ? `CC-${emp.department.toUpperCase().slice(0, 4)}-01 • ${emp.department}`
        : 'CC-TI-01 • Tecnologia & Dev';

      // Consolida todas as tarefas do timesheet (dos relatórios enviados + rascunhos em aberto no navegador)
      const allTimesheetRows: (ExportTimesheetRow & { reportId?: string })[] = [];

      // 1. Entradas em aberto (se o colaborador registrou no timesheet e ainda não fechou o mês)
      draftEntries.forEach((d, idx) => {
        allTimesheetRows.push({
          ...d,
          taskCode: d.taskCode || `TK-${String(draftEntries.length - idx).padStart(3, '0')}`,
          costCenter: d.costCenter || defaultCC,
          periodLabel: 'Em Aberto (Atual)',
          reportStatus: 'open',
        });
      });

      // 2. Entradas submetidas dentro de relatórios de fechamento
      empReports.forEach(rep => {
        if (rep.timesheetEntries && rep.timesheetEntries.length > 0) {
          rep.timesheetEntries.forEach((ts, idx) => {
            allTimesheetRows.push({
              ...ts,
              taskCode: ts.taskCode || `TK-${String(idx + 1).padStart(3, '0')}`,
              costCenter: ts.costCenter || defaultCC,
              periodLabel: rep.period,
              reportStatus: rep.status,
              reportId: rep.id,
            });
          });
        } else {
          // Caso seja um relatório enviado sem sub-itens de timesheet, cria uma linha representativa para a tabela
          allTimesheetRows.push({
            id: `rep-row-${rep.id}`,
            taskCode: `FECH-${rep.id.slice(-3).toUpperCase()}`,
            costCenter: defaultCC,
            date: rep.submittedAt ? rep.submittedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
            project: rep.period || 'Fechamento Periódico',
            taskDescription: rep.activitiesDescription,
            startTime: '09:00',
            endTime: '18:00',
            breakMinutes: 0,
            durationHours: Number(rep.hoursWorked) || 0,
            links: rep.links || [],
            images: rep.images || [],
            isLiveTracked: false,
            periodLabel: rep.period,
            reportStatus: rep.status,
            reportId: rep.id,
          });
        }
      });

      const totalHoursLogged = Number(
        allTimesheetRows.reduce((acc, r) => acc + (Number(r.durationHours) || 0), 0).toFixed(2)
      );

      const approvedHours = Number(
        empReports
          .filter(r => r.status === 'approved')
          .reduce((acc, r) => acc + (Number(r.hoursWorked) || 0), 0)
          .toFixed(2)
      );

      const pendingReports = empReports.filter(r => r.status === 'pending');

      return {
        employeeId: empId,
        employeeName: emp?.name || empReports[0]?.employeeName || 'Prestador PJ',
        employeeRole: emp?.role || 'Prestador de Serviços PJ',
        employeeDept: emp?.department || 'Tecnologia & Operações',
        defaultCostCenter: defaultCC,
        employeeAvatar:
          emp?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(emp?.name || 'PJ')}&background=96183c&color=fff`,
        quota: emp?.monthlyHoursQuota || 160,
        reports: empReports,
        pendingReports,
        timesheetRows: allTimesheetRows,
        totalHoursLogged,
        approvedHours,
      };
    });
  }, [pjEmployees, employees, localReports]);

  // Filtro de busca, colaborador e status
  const filteredGroups = useMemo(() => {
    return collaboratorGroups
      .map(group => {
        if (selectedEmployeeId !== 'all' && group.employeeId !== selectedEmployeeId) {
          return null;
        }

        // Filtra relatórios pelo statusFilter
        const matchingReports =
          statusFilter === 'all'
            ? group.reports
            : group.reports.filter(r => r.status === statusFilter);

        // Filtra linhas do timesheet pela busca e status
        const matchingRows = group.timesheetRows.filter(row => {
          if (statusFilter !== 'all' && row.reportStatus !== statusFilter) return false;
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            group.employeeName.toLowerCase().includes(q) ||
            (row.taskCode || '').toLowerCase().includes(q) ||
            (row.costCenter || '').toLowerCase().includes(q) ||
            (row.project || '').toLowerCase().includes(q) ||
            (row.taskDescription || '').toLowerCase().includes(q)
          );
        });

        if (statusFilter !== 'all' && matchingReports.length === 0 && matchingRows.length === 0) {
          return null;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatches = group.employeeName.toLowerCase().includes(q);
          if (!nameMatches && matchingRows.length === 0) return null;
        }

        return {
          ...group,
          reports: matchingReports,
          timesheetRows: matchingRows,
        };
      })
      .filter(Boolean) as typeof collaboratorGroups;
  }, [collaboratorGroups, selectedEmployeeId, statusFilter, searchQuery]);

  // Contadores Globais
  const pendingCount = localReports.filter(r => r.status === 'pending').length;
  const approvedCount = localReports.filter(r => r.status === 'approved').length;
  const totalApprovedHours = Number(
    localReports
      .filter(r => r.status === 'approved')
      .reduce((acc, curr) => acc + (Number(curr.hoursWorked) || 0), 0)
      .toFixed(2)
  );

  const handleApprove = (reportId: string) => {
    setLocalReports(prev => prev.map(r => (r.id === reportId ? { ...r, status: 'approved' } : r)));
    if (onApproveReport) onApproveReport(reportId);
  };

  const handleConfirmRejection = () => {
    if (rejectionModalId) {
      const reason = rejectionFeedback.trim() || 'Ajustes solicitados pelo gestor.';
      setLocalReports(prev =>
        prev.map(r => (r.id === rejectionModalId ? { ...r, status: 'rejected', managerFeedback: reason } : r))
      );
      if (onRejectReport) onRejectReport(rejectionModalId, reason);
      setRejectionModalId(null);
      setRejectionFeedback('');
    }
  };

  // Exportar planilha consolidada de um colaborador específico
  const handleExportCollaboratorSheet = (
    group: (typeof collaboratorGroups)[0],
    format: 'xls' | 'csv'
  ) => {
    if (group.timesheetRows.length === 0) {
      alert(`O prestador ${group.employeeName} ainda não possui tarefas registradas para exportar.`);
      return;
    }

    exportPjTimesheetSpreadsheet({
      employeeName: group.employeeName,
      employeeRole: group.employeeRole,
      defaultCostCenter: group.defaultCostCenter,
      periodTitle: group.reports[0]?.period || 'Consolidado do Período',
      quotaHours: group.quota,
      entries: group.timesheetRows,
      format,
    });
  };

  return (
    <div className={`space-y-6 animate-in fade-in duration-200 select-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Hero Banner com Resumo Executivo */}
      <div 
        className={`rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
        style={{ 
          backgroundColor: isDark ? '#111216' : '#ffffff',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)'
        }}
      >
        <div 
          className="absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)',
            filter: 'blur(70px)',
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
            }`}>
              <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
              <span>Gestão de Contratos & Timesheet PJ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Timesheet, Entregas &{' '}
              <span
                className={`bg-clip-text text-transparent ${
                  isDark
                    ? 'bg-gradient-to-r from-[#F9DE97] via-[#F59242] to-[#9F243C]'
                    : 'bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242]'
                }`}
                style={{
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Planilhas PJ
              </span>
            </h1>
            <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Acompanhe de forma organizada todas as tarefas de cada prestador PJ com <strong>ID da Tarefa</strong>, <strong>Centro de Custo</strong>, <strong>Projeto/Cliente</strong>, horários e evidências. Homologue fechamentos e exporte a planilha individual em Excel (`.xls`) ou `.csv`.
            </p>
          </div>

          {/* KPIs Rápidos */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className={`p-3.5 rounded-2xl border text-center min-w-[105px] ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-mono uppercase block font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Pendentes</span>
              <span className={`text-2xl font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{pendingCount}</span>
            </div>

            <div className={`p-3.5 rounded-2xl border text-center min-w-[105px] ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-mono uppercase block font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Homologados</span>
              <span className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{approvedCount}</span>
            </div>

            <div className={`p-3.5 rounded-2xl border text-center min-w-[115px] ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-mono uppercase block font-bold ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>Horas Aprov.</span>
              <span className={`text-2xl font-black ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>{totalApprovedHours}h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Informativo para Perfil RH (Modo Consulta - RH não homologa PJ) */}
      {isRh && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${
          isDark ? 'bg-amber-500/10 border-amber-500/25 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="leading-relaxed">
            <strong>Perfil RH (Modo Consulta):</strong> A homologação e aprovação de entregas PJ cabem exclusivamente ao <strong>Gestor de Setor</strong> responsável. O RH pode acompanhar as atividades, evidências e exportar relatórios para faturamento.
          </p>
        </div>
      )}

      {/* Barra de Filtros: Busca, Seleção de Prestador PJ e Status */}
      <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 ${
        isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID da tarefa, centro de custo, projeto ou colaborador..."
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border outline-none transition-all ${
                isDark 
                  ? 'bg-[#0b0d13] border-[#252A3A] text-white focus:border-[#f89847]' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#96183c]'
              }`}
            />
          </div>

          {/* Seletor de Colaborador PJ */}
          <select
            value={selectedEmployeeId}
            onChange={e => setSelectedEmployeeId(e.target.value)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
              isDark 
                ? 'bg-[#0b0d13] border-[#252A3A] text-white focus:border-[#f89847]' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#96183c]'
            }`}
          >
            <option value="all">Todos os Prestadores PJ ({collaboratorGroups.length})</option>
            {collaboratorGroups.map(g => (
              <option key={g.employeeId} value={g.employeeId}>
                {g.employeeName} — {g.totalHoursLogged}h registradas
              </option>
            ))}
          </select>
        </div>

        {/* Botões de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {([
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: `Pendentes (${pendingCount})` },
            { id: 'approved', label: 'Homologados' },
            { id: 'rejected', label: 'Com Ajustes' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'text-white shadow-md'
                  : isDark
                  ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={
                statusFilter === tab.id
                  ? { background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)' }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA ORGANIZADA POR COLABORADOR PJ (Com a mesma tabela limpa da visão do Colaborador) */}
      {filteredGroups.length === 0 ? (
        <div className={`p-12 text-center rounded-3xl border space-y-3 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
            isDark ? 'bg-[#9F243C]/15 text-[#f89847] border-[#F59242]/25' : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/20'
          }`}>
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base">Nenhum registro PJ encontrado para este filtro</h3>
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Assim que os prestadores PJ registrarem tarefas no Timesheet ou enviarem o fechamento do período, eles aparecerão organizados aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(group => (
            <div
              key={group.employeeId}
              className={`p-5 sm:p-6 rounded-3xl border transition-all space-y-5 ${
                isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              {/* TABELA DE ATIVIDADES NO TIMESHEET (Idêntica à organização limpa da visão do Colaborador) */}
              <div className={`p-4 sm:p-5 rounded-2xl border ${
                isDark ? 'bg-[#0e1017] border-white/10' : 'bg-slate-50/70 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isDark ? 'bg-[#9F243C]/20 text-[#f89847]' : 'bg-[#96183c]/10 text-[#96183c]'
                    }`}>
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                      <span>Atividades Registradas no Timesheet</span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                        isDark
                          ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                          : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                      }`}>
                        {group.timesheetRows.length} tarefas ({group.totalHoursLogged}h)
                      </span>
                    </h3>
                  </div>
                </div>

                {group.timesheetRows.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Nenhuma tarefa detalhada registrada por este prestador PJ até o momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">ID Tarefa</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Data</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Centro de Custo</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Projeto / Cliente</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Descrição da Tarefa</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Horário</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Pausas</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-center">Duração</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Evidências</th>
                          <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                        {group.timesheetRows.map((entry, idx) => (
                          <tr key={entry.id || idx} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-white'} transition-colors`}>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-md border ${
                                isDark
                                  ? 'bg-white/5 text-[#F9DE97] border-[#F59242]/30'
                                  : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                              }`}>
                                {entry.taskCode || `TK-${String(idx + 1).padStart(3, '0')}`}
                              </span>
                            </td>
                            <td className={`py-3 px-3 font-mono whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {entry.date ? formatDateBR(entry.date) : '-'}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                isDark
                                  ? 'bg-white/5 text-slate-300 border-white/10'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {entry.costCenter || group.defaultCostCenter}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                isDark
                                  ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                                  : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                              }`}>
                                {entry.project}
                              </span>
                            </td>
                            <td className="py-3 px-3 max-w-xs sm:max-w-md">
                              <span className={`font-medium block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={entry.taskDescription}>
                                {entry.taskDescription}
                              </span>
                              {entry.isLiveTracked ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                  <Check className="w-3 h-3" /> Cronometrado em tempo real
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  Registro manual
                                </span>
                              )}
                            </td>
                            <td className={`py-3 px-3 font-mono text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {entry.startTime} → {entry.endTime}
                            </td>
                            <td className={`py-3 px-3 text-center font-mono whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
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
                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                    }`}
                                    title="Ver print comprobatório"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                  </button>
                                ))}
                                {!entry.links?.length && !entry.images?.length && (
                                  <span className="text-slate-500 text-[11px]">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {entry.reportStatus === 'approved' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}>
                                  Homologado
                                </span>
                              ) : entry.reportStatus === 'rejected' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDark ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-100 text-rose-700 border-rose-200'
                                }`}>
                                  Com Ajuste
                                </span>
                              ) : entry.reportStatus === 'pending' ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                  Aguardando
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isDark ? 'bg-white/10 text-slate-300 border-white/15' : 'bg-slate-200 text-slate-700 border-slate-300'
                                }`}>
                                  Em Aberto
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* CABEÇALHO DO COLABORADOR PJ + BOTÕES DE EXPORTAR PLANILHA */}
              <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-3.5">
                  <img
                    src={group.employeeAvatar}
                    alt={group.employeeName}
                    className="w-12 h-12 rounded-2xl object-cover border border-[#F59242]/30 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black">{group.employeeName}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isDark
                          ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                          : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                      }`}>
                        Prestador PJ
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                        isDark
                          ? 'bg-white/5 text-slate-300 border-white/10'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {group.defaultCostCenter}
                      </span>
                    </div>
                    <div className={`flex items-center gap-3 text-xs mt-1 flex-wrap ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      <span>{group.employeeRole}</span>
                      <span>•</span>
                      <span>
                        Atividades no Timesheet:{' '}
                        <strong className={`font-mono ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                          {group.timesheetRows.length} tarefa(s) ({group.totalHoursLogged}h)
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Cota Mensal: <strong className={`font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{group.quota}h</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Exportação de Planilha por Colaborador PJ */}
                <div className="flex items-center gap-2 self-end lg:self-center shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleExportCollaboratorSheet(group, 'xls')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
                    style={{
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 16px rgba(100, 12, 30, 0.30)'
                    }}
                    title={`Baixar planilha Excel (.xls) de ${group.employeeName}`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Exportar Planilha (.XLS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportCollaboratorSheet(group, 'csv')}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title={`Baixar arquivo CSV de ${group.employeeName}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* BARRA DE FECHAMENTOS SUBMETIDOS (Para Aprovar ou Solicitar Ajustes) */}
              {group.reports.length > 0 && (
                <div className="space-y-3">
                  {group.reports.map(rep => {
                    const isDetailsOpen = Boolean(expandedReportDetails[rep.id]);
                    return (
                      <div
                        key={rep.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          rep.status === 'pending'
                            ? isDark
                              ? 'bg-[#640C1E]/20 border-[#F59242]/30'
                              : 'bg-amber-50/60 border-amber-200'
                            : isDark
                            ? 'bg-black/25 border-white/10'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                              isDark ? 'bg-[#9F243C]/20 text-[#f89847] border-[#F59242]/30' : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                            }`}>
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm">
                                  Fechamento: {rep.period}
                                </span>
                                <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  isDark
                                    ? 'bg-[#9F243C]/20 text-[#F9DE97] border-[#F59242]/30'
                                    : 'bg-[#96183c]/10 text-[#96183c] border-[#96183c]/25'
                                }`}>
                                  {rep.hoursWorked}h enviadas
                                </span>
                                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  • Enviado em{' '}
                                  {formatDateTimeBR(rep.submittedAt)}
                                </span>
                              </div>
                              <p className={`text-xs mt-1 line-clamp-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {rep.activitiesDescription}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReportDetails(prev => ({
                                  ...prev,
                                  [rep.id]: !prev[rep.id],
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                                isDark
                                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span>Resumo & Anexos</span>
                              {isDetailsOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {rep.status === 'approved' ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                                isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Homologado
                              </span>
                            ) : rep.status === 'rejected' ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                                isDark ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-100 text-rose-700 border-rose-200'
                              }`}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                Ajustes Solicitados
                              </span>
                            ) : isRh ? (
                              /* Restrição RH: Apenas Gestor homologa entregas PJ */
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                                  isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                                title="A homologação de entregas PJ cabe exclusivamente ao Gestor responsável"
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>Aguardando Gestor</span>
                              </span>
                            ) : (
                              /* Perfil Gestor: Botões de homologação e pedido de ajuste */
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectionModalId(rep.id);
                                    setRejectionFeedback('');
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                    isDark
                                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Pedir Ajuste</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(rep.id)}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
                                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Homologar ({rep.hoursWorked}h)</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Detalhes Expandidos do Fechamento (Síntese, Links Gerais e Galeria de Prints) */}
                        {isDetailsOpen && (
                          <div className={`mt-3 pt-3 border-t space-y-3 animate-in fade-in ${
                            isDark ? 'border-white/10' : 'border-slate-200'
                          }`}>
                            <p className={`text-xs whitespace-pre-line p-3 rounded-xl border ${
                              isDark ? 'text-slate-200 bg-black/30 border-white/5' : 'text-slate-700 bg-white border-slate-200'
                            }`}>
                              {rep.activitiesDescription}
                            </p>

                            {rep.links && rep.links.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {rep.links.map((link, lIdx) => (
                                  <a
                                    key={lIdx}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border ${
                                      isDark
                                        ? 'bg-[#9F243C]/20 hover:bg-[#9F243C]/30 text-[#F9DE97] border-[#F59242]/30'
                                        : 'bg-[#96183c]/10 hover:bg-[#96183c]/20 text-[#96183c] border-[#96183c]/25'
                                    }`}
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    <span>{link.title || link.url}</span>
                                    <ExternalLink className="w-3 h-3 opacity-70" />
                                  </a>
                                ))}
                              </div>
                            )}

                            {rep.images && rep.images.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                                {rep.images.map((img, iIdx) => (
                                  <div
                                    key={iIdx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`group relative aspect-video rounded-xl overflow-hidden border cursor-pointer hover:border-[#f89847] ${
                                      isDark ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-slate-100'
                                    }`}
                                  >
                                    <img src={img} alt="Print" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Eye className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {rep.managerFeedback && (
                              <div className={`p-2.5 rounded-xl border text-xs ${
                                isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                              }`}>
                                <strong>Parecer do Gestor:</strong> {rep.managerFeedback}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}



            </div>
          ))}
        </div>
      )}

      {/* MODAL PARA SOLICITAR AJUSTES / REJEIÇÃO */}
      {rejectionModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-[#10121A] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <h3 className={`font-bold text-base flex items-center gap-2 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                <AlertCircle className="w-5 h-5" />
                <span>Solicitar Ajustes no Fechamento PJ</span>
              </h3>
              <button onClick={() => setRejectionModalId(null)} className={`cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Descreva abaixo o motivo da devolução ou quais comprovações/links o prestador PJ precisa complementar:
            </p>

            <textarea
              rows={4}
              value={rejectionFeedback}
              onChange={e => setRejectionFeedback(e.target.value)}
              placeholder="Ex: Favor anexar o link da PR do módulo de relatórios e especificar o centro de custo..."
              className={`w-full p-3 rounded-xl border text-xs outline-none ${
                isDark ? 'bg-[#0b0d13] border-[#252A3A] text-white focus:border-rose-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-600'
              }`}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModalId(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg cursor-pointer"
              >
                Confirmar Devolução
              </button>
            </div>
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
