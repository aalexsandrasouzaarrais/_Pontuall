import { normalizeDateToISO, parseDateSortTimestamp, matchesDateSearchQuery } from '@/shared/utils/dateUtils';

export type ApprovalTypeFilter =
  | 'all'
  | 'swap'
  | 'medical'
  | 'delay'
  | 'overtime'
  | 'forgetfulness'
  | 'absent'
  | 'justified'
  | 'time_off';

export type ApprovalStatusTab = 'all' | 'pending' | 'approved' | 'rejected';

export interface ApprovalItem {
  id: string;
  shiftId?: string;
  employeeId?: string;
  employeeName: string;
  employeeRole: string;
  employeeDept: string;
  employeeAvatar: string;
  type: string;
  reason: string;
  date: string;
  diffMinutes?: number;
  documentName?: string;
  documentUrl?: string;
  status: 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente';
  actionText?: string;
  feedback: string;
}

/**
 * Avalia se uma ocorrência da Central de Aprovações corresponde ao filtro de categoria selecionado.
 */
export function matchesApprovalTypeFilter(row: ApprovalItem, filter: ApprovalTypeFilter): boolean {
  if (filter === 'all') return true;
  const t = (row.type || '').toLowerCase();

  if (filter === 'swap') {
    return t.includes('troca');
  }
  if (filter === 'medical') {
    return t.includes('atestado') || t.includes('médico') || t.includes('ausência');
  }
  if (filter === 'forgetfulness') {
    return t.includes('esquecimento');
  }
  if (filter === 'delay') {
    return t.includes('atraso') || t.includes('antecipada');
  }
  if (filter === 'overtime') {
    return t.includes('hora extra') || t.includes('extra');
  }
  if (filter === 'absent') {
    const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
    const isNaoJustificada = isExplicitNao || (t.includes('falta') && !t.includes('falta justificada'));
    return isNaoJustificada && row.status !== 'Aprovado' && !row.actionText?.toLowerCase().includes('abonad');
  }
  if (filter === 'justified') {
    const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
    return (
      (!isExplicitNao && (t === 'falta justificada' || t === 'justificado')) ||
      Boolean(row.actionText?.toLowerCase().includes('abonad')) ||
      (row.status === 'Aprovado' && (t.includes('falta') || t.includes('atraso') || t.includes('antecipada')))
    );
  }
  if (filter === 'time_off') {
    return t.includes('folga') || t.includes('dispensa');
  }
  return true;
}

/**
 * Verifica se a data de uma ocorrência está dentro do intervalo inclusivo [fromDate, toDate].
 */
export function matchesDatePeriodRange(
  rowDate: string | undefined | null,
  fromDate?: string,
  toDate?: string
): boolean {
  const fromIso = fromDate ? normalizeDateToISO(fromDate) : '';
  const toIso = toDate ? normalizeDateToISO(toDate) : '';
  if (!fromIso && !toIso) return true;

  const rowIso = normalizeDateToISO(rowDate);
  if (!rowIso) return false;
  if (fromIso && rowIso < fromIso) return false;
  if (toIso && rowIso > toIso) return false;
  return true;
}

export interface ApprovalFilterOptions {
  search?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  typeFilter?: ApprovalTypeFilter;
  statusTab?: ApprovalStatusTab;
  dateSort?: 'desc' | 'asc';
}

/**
 * Filtra e ordena ocorrências da Central de Aprovações preservando a análise individual caso a caso.
 */
export function filterAndSortApprovals(
  items: ApprovalItem[],
  options: ApprovalFilterOptions = {}
): ApprovalItem[] {
  const {
    search = '',
    department = 'all',
    dateFrom = '',
    dateTo = '',
    typeFilter = 'all',
    statusTab = 'all',
    dateSort = 'desc',
  } = options;

  const q = search.toLowerCase().trim();

  return items
    .filter(row => {
      if (q) {
        const matchName = (row.employeeName || '').toLowerCase().includes(q);
        const matchRole = (row.employeeRole || '').toLowerCase().includes(q);
        const matchDept = (row.employeeDept || '').toLowerCase().includes(q);
        const matchType = (row.type || '').toLowerCase().includes(q);
        const matchReason = (row.reason || '').toLowerCase().includes(q);
        const matchDate = matchesDateSearchQuery(row.date, q);
        if (!matchName && !matchRole && !matchDept && !matchType && !matchReason && !matchDate) {
          return false;
        }
      }

      if (department !== 'all' && row.employeeDept !== department) {
        return false;
      }

      if (!matchesDatePeriodRange(row.date, dateFrom, dateTo)) {
        return false;
      }

      if (!matchesApprovalTypeFilter(row, typeFilter)) {
        return false;
      }

      if (statusTab === 'pending') return row.status === 'Pendente';
      if (statusTab === 'approved') return row.status === 'Aprovado';
      if (statusTab === 'rejected') return row.status === 'Recusado / Falta' || row.status === 'Falta Lançada';
      return true;
    })
    .sort((a, b) => {
      const timeA = parseDateSortTimestamp(a.date);
      const timeB = parseDateSortTimestamp(b.date);
      if (timeA !== timeB) {
        return dateSort === 'desc' ? timeB - timeA : timeA - timeB;
      }
      return (a.employeeName || '').localeCompare(b.employeeName || '');
    });
}
