import { describe, it, expect } from 'vitest';
import {
  ApprovalItem,
  matchesApprovalTypeFilter,
  matchesDatePeriodRange,
  filterAndSortApprovals,
} from '../approvalFilters';

const makeItem = (overrides: Partial<ApprovalItem>): ApprovalItem => ({
  id: '1',
  employeeName: 'Ana Souza',
  employeeRole: 'Analista',
  employeeDept: 'Operações',
  employeeAvatar: '',
  type: 'Atraso de Entrada',
  reason: 'Trânsito',
  date: '2026-11-23',
  status: 'Pendente',
  feedback: '',
  ...overrides,
});

describe('matchesApprovalTypeFilter', () => {
  it('matches Esquecimentos chip exclusively for forgetfulness occurrences', () => {
    const forgetIn = makeItem({ id: 'f1', type: 'Esquecimento de Entrada' });
    const forgetOut = makeItem({ id: 'f2', type: 'Esquecimento de Saída' });
    const delay = makeItem({ id: 'd1', type: 'Atraso de Entrada' });
    const overtime = makeItem({ id: 'o1', type: 'Hora Extra' });

    expect(matchesApprovalTypeFilter(forgetIn, 'forgetfulness')).toBe(true);
    expect(matchesApprovalTypeFilter(forgetOut, 'forgetfulness')).toBe(true);
    expect(matchesApprovalTypeFilter(delay, 'forgetfulness')).toBe(false);
    expect(matchesApprovalTypeFilter(overtime, 'forgetfulness')).toBe(false);
  });
});

describe('matchesDatePeriodRange', () => {
  it('filters inclusive date bounds across ISO and BR formats', () => {
    expect(matchesDatePeriodRange('2026-11-23')).toBe(true);
    expect(matchesDatePeriodRange('2026-11-23', '2026-11-20')).toBe(true);
    expect(matchesDatePeriodRange('2026-11-19', '2026-11-20')).toBe(false);
    expect(matchesDatePeriodRange('2026-11-24', undefined, '2026-11-23')).toBe(false);
    expect(matchesDatePeriodRange('23/11/2026', '2026-11-23', '2026-11-23')).toBe(true);
    expect(matchesDatePeriodRange('', '2026-11-01', '2026-11-30')).toBe(false);
  });
});

describe('filterAndSortApprovals', () => {
  const items: ApprovalItem[] = [
    makeItem({ id: 'a', employeeName: 'Carlos', employeeDept: 'TI', type: 'Esquecimento de Saída', date: '2026-11-23', status: 'Pendente' }),
    makeItem({ id: 'b', employeeName: 'Ana', employeeDept: 'TI', type: 'Esquecimento de Entrada', date: '2026-11-16', status: 'Aprovado' }),
    makeItem({ id: 'c', employeeName: 'Bruno', employeeDept: 'RH', type: 'Hora Extra', date: '2026-10-16', status: 'Pendente' }),
  ];

  it('combines forgetfulness chip, period De/Até, and dash date search', () => {
    const filtered = filterAndSortApprovals(items, {
      typeFilter: 'forgetfulness',
      dateFrom: '2026-11-15',
      dateTo: '2026-11-25',
      search: '23-11-2026',
    });
    expect(filtered.map(i => i.id)).toEqual(['a']);
  });

  it('sorts chronologically across different months in asc and desc order', () => {
    const desc = filterAndSortApprovals(items, { dateSort: 'desc' });
    const asc = filterAndSortApprovals(items, { dateSort: 'asc' });
    expect(desc.map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(asc.map(i => i.id)).toEqual(['c', 'b', 'a']);
  });
});
