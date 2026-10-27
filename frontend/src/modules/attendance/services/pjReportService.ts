import { supabase } from '@/shared/services/supabase';
import { safeStorage } from '@/shared/utils/safeStorage';
import { PjDeliverableReport, PjReportLink, PjTimesheetEntry, PjActiveTimerState } from '@/types';

const STORAGE_KEY_PJ_REPORTS = 'pontual_pj_reports';
const STORAGE_KEY_PJ_DRAFT_PREFIX = 'pontual_pj_draft_timesheet_';
const STORAGE_KEY_PJ_TIMER_PREFIX = 'pontual_pj_active_timer_';

function getLocalReports(): PjDeliverableReport[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_PJ_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: PjDeliverableReport[]): void {
  try {
    safeStorage.setItem(STORAGE_KEY_PJ_REPORTS, JSON.stringify(reports));
  } catch {}
}

/**
 * Retorna os relatórios cadastrados no Supabase (com fallback no LocalStorage)
 */
export async function getPjReportsSupabase(employeeId?: string): Promise<PjDeliverableReport[]> {
  try {
    let query = supabase
      .from('TAB_Relatorio_Pj')
      .select('*, TAB_Colaborador(Nme_Colaborador)')
      .order('Dta_Envio', { ascending: false });

    if (employeeId) {
      query = query.eq('Idf_Colaborador', employeeId);
    }

    const { data, error } = await query;

    if (!error && data) {
      const localCache = getLocalReports();
      const mapped: PjDeliverableReport[] = data.map((row: any) => {
        let timesheetParsed: PjTimesheetEntry[] = [];
        if (Array.isArray(row.Des_Timesheet_Json)) {
          timesheetParsed = row.Des_Timesheet_Json;
        } else if (typeof row.Des_Timesheet_Json === 'string') {
          try {
            timesheetParsed = JSON.parse(row.Des_Timesheet_Json);
          } catch {}
        }

        const rawLinks: any[] = Array.isArray(row.Des_Links_Json) ? row.Des_Links_Json : [];
        const metaItem = rawLinks.find(l => l && l.title === '__TIMESHEET_META__');
        if ((!timesheetParsed || timesheetParsed.length === 0) && metaItem?.url) {
          try {
            timesheetParsed = JSON.parse(metaItem.url);
          } catch {}
        }
        const cleanLinks: PjReportLink[] = rawLinks.filter(l => l && l.title !== '__TIMESHEET_META__');

        // Fallback adicional: se ainda estiver vazio, recupera do cache local
        const cachedMatch = localCache.find(c => c.id === row.Idf_Relatorio_Pj);
        if ((!timesheetParsed || timesheetParsed.length === 0) && cachedMatch?.timesheetEntries?.length) {
          timesheetParsed = cachedMatch.timesheetEntries;
        }

        return {
          id: row.Idf_Relatorio_Pj,
          employeeId: row.Idf_Colaborador,
          employeeName: row.TAB_Colaborador?.Nme_Colaborador || cachedMatch?.employeeName || 'Colaborador PJ',
          period: row.Des_Periodo_Referencia,
          hoursWorked: Number(row.Num_Horas_Trabalhadas) || 0,
          activitiesDescription: row.Des_Atividades || '',
          timesheetEntries: timesheetParsed,
          links: cleanLinks.length > 0 ? cleanLinks : (cachedMatch?.links || []),
          images: Array.isArray(row.Des_Imagens_Json) ? row.Des_Imagens_Json : (cachedMatch?.images || []),
          status: row.Tpo_Status || 'pending',
          managerFeedback: row.Des_Parecer_Gestor || undefined,
          submittedAt: row.Dta_Envio,
          evaluatedAt: row.Dta_Avaliacao || undefined,
        };
      });

      // Atualiza o cache local preservando relatórios de outros colaboradores se filtrado por employeeId
      if (employeeId) {
        const others = localCache.filter(c => c.employeeId !== employeeId);
        saveLocalReports([...mapped, ...others]);
      } else {
        saveLocalReports(mapped);
      }
      return mapped;
    }

    if (error) {
      console.warn('Aviso ao carregar TAB_Relatorio_Pj do Supabase (utilizando fallback local):', error.message);
    }
  } catch (err: any) {
    console.warn('Erro de conexão com TAB_Relatorio_Pj:', err?.message || err);
  }

  // Fallback local
  const local = getLocalReports();
  if (employeeId) {
    return local.filter(r => r.employeeId === employeeId);
  }
  return local;
}

/**
 * Cria um novo fechamento/relatório de entregas com timesheet detalhado
 */
export async function createPjReportSupabase(report: {
  employeeId: string;
  employeeName?: string;
  period: string;
  hoursWorked: number;
  activitiesDescription: string;
  timesheetEntries?: PjTimesheetEntry[];
  links: PjReportLink[];
  images: string[];
}): Promise<PjDeliverableReport> {
  const localId = `pjr-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newReport: PjDeliverableReport = {
    id: localId,
    employeeId: report.employeeId,
    employeeName: report.employeeName || 'Colaborador PJ',
    period: report.period,
    hoursWorked: report.hoursWorked,
    activitiesDescription: report.activitiesDescription,
    timesheetEntries: report.timesheetEntries || [],
    links: report.links,
    images: report.images,
    status: 'pending',
    submittedAt: nowIso,
  };

  try {
    const linksWithMeta =
      report.timesheetEntries && report.timesheetEntries.length > 0
        ? [
            ...report.links,
            { title: '__TIMESHEET_META__', url: JSON.stringify(report.timesheetEntries) },
          ]
        : report.links;

    const payload: any = {
      Idf_Colaborador: report.employeeId,
      Des_Periodo_Referencia: report.period,
      Num_Horas_Trabalhadas: report.hoursWorked,
      Des_Atividades: report.activitiesDescription,
      Des_Timesheet_Json: report.timesheetEntries || [],
      Des_Links_Json: linksWithMeta,
      Des_Imagens_Json: report.images,
      Tpo_Status: 'pending',
    };

    let { data, error } = await supabase
      .from('TAB_Relatorio_Pj')
      .insert(payload)
      .select()
      .single();

    // Fallback gracioso caso a coluna Des_Timesheet_Json ainda não exista no banco remoto
    if (error && (error.message?.includes('Des_Timesheet_Json') || error.code === 'PGRST204')) {
      delete payload.Des_Timesheet_Json;
      const retryResult = await supabase
        .from('TAB_Relatorio_Pj')
        .insert(payload)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (!error && data) {
      newReport.id = data.Idf_Relatorio_Pj;
      newReport.submittedAt = data.Dta_Envio;
    } else if (error) {
      console.warn('Erro ao inserir em TAB_Relatorio_Pj no Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Exceção ao inserir em TAB_Relatorio_Pj:', err);
  }

  // Salva no storage local
  const current = getLocalReports();
  saveLocalReports([newReport, ...current.filter(r => r.id !== newReport.id)]);

  return newReport;
}

/**
 * Atualiza status da entrega (Aprovado / Rejeitado)
 */
export async function updatePjReportStatusSupabase(
  reportId: string,
  status: 'approved' | 'rejected',
  managerFeedback?: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('TAB_Relatorio_Pj')
      .update({
        Tpo_Status: status,
        Des_Parecer_Gestor: managerFeedback || null,
        Dta_Avaliacao: nowIso,
      })
      .eq('Idf_Relatorio_Pj', reportId);

    if (error) {
      console.warn('Aviso ao atualizar status em TAB_Relatorio_Pj:', error.message);
    }
  } catch (err) {
    console.warn('Exceção ao atualizar status em TAB_Relatorio_Pj:', err);
  }

  // Atualiza cache local
  const current = getLocalReports();
  const updated = current.map(r => {
    if (r.id === reportId) {
      return {
        ...r,
        status,
        managerFeedback,
        evaluatedAt: nowIso,
      };
    }
    return r;
  });
  saveLocalReports(updated);

  return true;
}

// ============================================================================
// GERENCIAMENTO LOCAL DE TIMESHEET RASCUNHO / ATIVIDADES PENDENTES DE ENVIO
// ============================================================================

export function getDraftTimesheet(employeeId: string): PjTimesheetEntry[] {
  try {
    const raw = safeStorage.getItem(`${STORAGE_KEY_PJ_DRAFT_PREFIX}${employeeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraftTimesheet(employeeId: string, entries: PjTimesheetEntry[]): void {
  try {
    safeStorage.setItem(`${STORAGE_KEY_PJ_DRAFT_PREFIX}${employeeId}`, JSON.stringify(entries));
  } catch {}
}

export async function syncDraftTimesheetFromSupabase(employeeId: string): Promise<PjTimesheetEntry[]> {
  const local = getDraftTimesheet(employeeId);
  if (!isUuid(employeeId)) return local;

  try {
    const { data, error } = await supabase
      .from('TAB_Relatorio_Pj')
      .select('*')
      .eq('Idf_Colaborador', employeeId)
      .eq('Des_Periodo_Referencia', '__DRAFT_TIMESHEET__')
      .maybeSingle();

    if (!error && data) {
      let entries: PjTimesheetEntry[] = [];
      const rawLinks: any[] = Array.isArray(data.Des_Links_Json) ? data.Des_Links_Json : [];
      const meta = rawLinks.find(l => l && l.title === '__TIMESHEET_META__');
      if (meta?.url) {
        try {
          entries = JSON.parse(meta.url);
        } catch {}
      }
      if (Array.isArray(entries) && entries.length > 0) {
        saveDraftTimesheet(employeeId, entries);
        return entries;
      }
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar rascunho de timesheet:', err);
  }
  return local;
}

export async function saveDraftTimesheetToSupabase(
  employeeId: string,
  entries: PjTimesheetEntry[]
): Promise<void> {
  saveDraftTimesheet(employeeId, entries);
  if (!isUuid(employeeId)) return;

  try {
    const key = '__DRAFT_TIMESHEET__';
    const totalHours = Number(
      entries.reduce((acc, curr) => acc + (Number(curr.durationHours) || 0), 0).toFixed(2)
    );
    const payload = {
      Num_Horas_Trabalhadas: totalHours,
      Des_Atividades: `Timesheet em aberto - ${entries.length} atividade(s)`,
      Des_Links_Json: [{ title: '__TIMESHEET_META__', url: JSON.stringify(entries) }],
      Tpo_Status: 'draft',
    };

    const { data: existing } = await supabase
      .from('TAB_Relatorio_Pj')
      .select('Idf_Relatorio_Pj')
      .eq('Idf_Colaborador', employeeId)
      .eq('Des_Periodo_Referencia', key)
      .maybeSingle();

    if (existing?.Idf_Relatorio_Pj) {
      await supabase
        .from('TAB_Relatorio_Pj')
        .update(payload)
        .eq('Idf_Relatorio_Pj', existing.Idf_Relatorio_Pj);
    } else {
      await supabase
        .from('TAB_Relatorio_Pj')
        .insert({
          ...payload,
          Idf_Colaborador: employeeId,
          Des_Periodo_Referencia: key,
        });
    }
  } catch (err) {
    console.warn('Aviso ao persistir rascunho de timesheet no Supabase:', err);
  }
}

export function addDraftTimesheetEntry(employeeId: string, entry: PjTimesheetEntry): PjTimesheetEntry[] {
  const current = getDraftTimesheet(employeeId);
  const updated = [entry, ...current.filter(e => e.id !== entry.id)];
  saveDraftTimesheet(employeeId, updated);
  saveDraftTimesheetToSupabase(employeeId, updated).catch(() => {});
  return updated;
}

export function deleteDraftTimesheetEntry(employeeId: string, entryId: string): PjTimesheetEntry[] {
  const current = getDraftTimesheet(employeeId);
  const updated = current.filter(e => e.id !== entryId);
  saveDraftTimesheet(employeeId, updated);
  saveDraftTimesheetToSupabase(employeeId, updated).catch(() => {});
  return updated;
}

export async function clearDraftTimesheetSupabase(employeeId: string): Promise<void> {
  clearDraftTimesheet(employeeId);
  if (!isUuid(employeeId)) return;
  try {
    await supabase
      .from('TAB_Relatorio_Pj')
      .delete()
      .eq('Idf_Colaborador', employeeId)
      .eq('Des_Periodo_Referencia', '__DRAFT_TIMESHEET__');
  } catch {}
}

export function clearDraftTimesheet(employeeId: string): void {
  try {
    safeStorage.removeItem(STORAGE_KEY_PJ_DRAFT_PREFIX + employeeId);
  } catch {}
}

// ============================================================================
// CRONÔMETRO PLAY / PAUSE PERSISTENTE
// ============================================================================

export function getActiveTimer(employeeId: string): PjActiveTimerState | null {
  try {
    const raw = safeStorage.getItem(`${STORAGE_KEY_PJ_TIMER_PREFIX}${employeeId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveTimer(employeeId: string, state: PjActiveTimerState | null): void {
  try {
    if (!state) {
      safeStorage.removeItem(`${STORAGE_KEY_PJ_TIMER_PREFIX}${employeeId}`);
    } else {
      safeStorage.setItem(`${STORAGE_KEY_PJ_TIMER_PREFIX}${employeeId}`, JSON.stringify(state));
    }
  } catch {}
}

// ============================================================================
// EXPORTAÇÃO DE PLANILHA (EXCEL .XLS E .CSV) POR COLABORADOR PJ
// ============================================================================

export interface ExportTimesheetRow extends PjTimesheetEntry {
  periodLabel?: string;
  reportStatus?: string;
}

export function exportPjTimesheetSpreadsheet(params: {
  employeeName: string;
  employeeRole?: string;
  defaultCostCenter?: string;
  periodTitle?: string;
  quotaHours?: number;
  entries: ExportTimesheetRow[];
  format?: 'xls' | 'csv';
}): void {
  const {
    employeeName,
    employeeRole = 'Prestador de Serviços PJ',
    defaultCostCenter = 'CC-GERAL',
    periodTitle = 'Consolidado Geral',
    quotaHours = 160,
    entries,
    format = 'xls',
  } = params;

  const safeFileName = employeeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const dateStamp = new Date().toISOString().slice(0, 10);
  const totalHours = entries.reduce((acc, e) => acc + (Number(e.durationHours) || 0), 0);
  const totalBreakMins = entries.reduce((acc, e) => acc + (Number(e.breakMinutes) || 0), 0);

  if (format === 'csv') {
    const headers = [
      'ID da Tarefa',
      'Data',
      'Centro de Custo',
      'Projeto / Cliente',
      'Descricao da Tarefa',
      'Inicio',
      'Termino',
      'Pausas (min)',
      'Duracao Liquida (h)',
      'Modalidade',
      'Status / Fechamento',
      'Links de Comprovacao',
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = entries.map((e, idx) => {
      const taskCode = e.taskCode || `TK-${String(idx + 1).padStart(3, '0')}`;
      const costCenter = e.costCenter || defaultCostCenter;
      const formattedDate = e.date
        ? new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '-';
      const linksStr = e.links?.map(l => l.url).join(' | ') || '';
      const statusLabel =
        e.reportStatus === 'approved'
          ? 'Homologado'
          : e.reportStatus === 'rejected'
          ? 'Ajustes Solicitados'
          : e.reportStatus === 'pending'
          ? 'Aguardando Aprovacao'
          : 'Timesheet em Aberto';

      return [
        escapeCsv(taskCode),
        escapeCsv(formattedDate),
        escapeCsv(costCenter),
        escapeCsv(e.project || 'Projeto Geral'),
        escapeCsv(e.taskDescription || ''),
        escapeCsv(e.startTime || ''),
        escapeCsv(e.endTime || ''),
        escapeCsv(e.breakMinutes || 0),
        escapeCsv(String(Number(e.durationHours || 0).toFixed(2)).replace('.', ',')),
        escapeCsv(e.isLiveTracked ? 'Play/Pause Tempo Real' : 'Manual'),
        escapeCsv(statusLabel),
        escapeCsv(linksStr),
      ].join(';');
    });

    const totalRow = [
      escapeCsv('TOTAL GERAL'),
      escapeCsv(`${entries.length} tarefas`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(totalBreakMins),
      escapeCsv(String(totalHours.toFixed(2)).replace('.', ',')),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
    ].join(';');

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows, totalRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Timesheet_PJ_${safeFileName}_${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Formato Excel (.xls com tabela HTML estilizada compatível com Microsoft Excel / LibreOffice / Google Sheets)
  const escapeHtml = (val: any) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rowsHtml = entries
    .map((e, idx) => {
      const taskCode = e.taskCode || `TK-${String(idx + 1).padStart(3, '0')}`;
      const costCenter = e.costCenter || defaultCostCenter;
      const formattedDate = e.date
        ? new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '-';
      const linksStr = e.links?.map(l => `${l.title ? l.title + ': ' : ''}${l.url}`).join(' | ') || '-';
      const statusLabel =
        e.reportStatus === 'approved'
          ? 'Homologado'
          : e.reportStatus === 'rejected'
          ? 'Ajustes Solicitados'
          : e.reportStatus === 'pending'
          ? 'Aguardando Homologação'
          : 'Timesheet em Aberto';

      const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${bgRow};">
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-family: Consolas, monospace; font-weight: bold; color: #9F243C; text-align: center;">${escapeHtml(taskCode)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${escapeHtml(formattedDate)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: 600; color: #0f172a;">${escapeHtml(costCenter)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-weight: bold; color: #640C1E;">${escapeHtml(e.project || 'Projeto Geral')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #1e293b;">${escapeHtml(e.taskDescription || '')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${escapeHtml(e.startTime || '')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${escapeHtml(e.endTime || '')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; color: #b45309;">${Number(e.breakMinutes || 0)} min</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-weight: bold; color: #047857;">${String(Number(e.durationHours || 0).toFixed(2)).replace('.', ',')} h</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${e.isLiveTracked ? 'Play/Pause (Tempo Real)' : 'Manual'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">${escapeHtml(statusLabel)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px; color: #475569;">${escapeHtml(linksStr)}</td>
        </tr>
      `;
    })
    .join('');

  const htmlExcel = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Timesheet PJ - ${escapeHtml(employeeName.slice(0, 18))}</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body style="font-family: Segoe UI, Arial, sans-serif; font-size: 12px;">
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td colspan="12" style="background-color: #640C1E; color: #ffffff; font-size: 16px; font-weight: bold; padding: 12px; text-align: left;">
            PONTUALL • PLANILHA DE TIMESHEET E ENTREGAS PJ
          </td>
        </tr>
        <tr>
          <td colspan="3" style="background-color: #fff7ed; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Prestador PJ:</strong> ${escapeHtml(employeeName)}</td>
          <td colspan="3" style="background-color: #fff7ed; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Cargo:</strong> ${escapeHtml(employeeRole)}</td>
          <td colspan="3" style="background-color: #fff7ed; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Centro de Custo Padrão:</strong> ${escapeHtml(defaultCostCenter)}</td>
          <td colspan="3" style="background-color: #fff7ed; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Período:</strong> ${escapeHtml(periodTitle)}</td>
        </tr>
        <tr>
          <td colspan="3" style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Total de Tarefas:</strong> ${entries.length}</td>
          <td colspan="3" style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Total de Pausas:</strong> ${totalBreakMins} min</td>
          <td colspan="3" style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Total Horas Líquidas:</strong> ${String(totalHours.toFixed(2)).replace('.', ',')}h (Cota: ${quotaHours}h)</td>
          <td colspan="3" style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px;"><strong>Exportado em:</strong> ${new Date().toLocaleString('pt-BR')}</td>
        </tr>
        <tr><td colspan="12" style="height: 8px;"></td></tr>
        <tr style="background-color: #111216; color: #ffffff; font-weight: bold; text-align: center;">
          <th style="border: 1px solid #475569; padding: 8px 10px;">ID da Tarefa</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Data</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Centro de Custo</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Projeto / Cliente</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Descrição da Tarefa</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Início</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Término</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Pausas</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Horas Líquidas</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Modalidade</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Status</th>
          <th style="border: 1px solid #475569; padding: 8px 10px;">Links / Comprovantes</th>
        </tr>
        ${rowsHtml}
        <tr style="background-color: #fef3c7; font-weight: bold;">
          <td colspan="7" style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; color: #640C1E;">TOTAL CONSOLIDADO DO COLABORADOR PJ (${entries.length} atividades):</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; color: #b45309;">${totalBreakMins} min</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; color: #047857; font-size: 13px;">${String(totalHours.toFixed(2)).replace('.', ',')} h</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px 10px;"></td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + htmlExcel], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Planilha_Timesheet_PJ_${safeFileName}_${dateStamp}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

