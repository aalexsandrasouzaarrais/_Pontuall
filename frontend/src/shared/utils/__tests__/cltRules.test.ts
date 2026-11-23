import { describe, it, expect } from 'vitest';
import {
  evaluatePunchTolerance,
  parseDateSortTimestamp,
  normalizeDateToISO,
  formatDateBR,
  matchesDateSearchQuery,
  isShiftPast24hWithoutPunch,
} from '@/shared/utils/dateUtils';
import {
  selectActiveTodayShift,
  isDirectionalForgetfulnessMatch,
  resolveAttendanceReportStatusAndObs,
} from '@/shared/utils/attendanceUtils';

describe('evaluatePunchTolerance (CLT Art. 58 § 1º)', () => {
  it('detects late entry beyond 10-min tolerance', () => {
    const res = evaluatePunchTolerance('08:00', '08:35', 'entrada', 10);
    expect(res.isLate).toBe(true);
    expect(res.isOntime).toBe(false);
    expect(res.diffMinutes).toBe(35);
  });

  it('treats entry within 10-min tolerance as on time', () => {
    const res = evaluatePunchTolerance('08:00', '08:10', 'entrada', 10);
    expect(res.isOntime).toBe(true);
    expect(res.isLate).toBe(false);
    expect(res.isEarly).toBe(false);
  });

  it('detects early entry beyond 10-min tolerance', () => {
    const res = evaluatePunchTolerance('08:00', '07:40', 'entrada', 10);
    expect(res.isEarly).toBe(true);
    expect(res.diffMinutes).toBe(20);
  });

  it('detects overtime exit minute by minute', () => {
    const res = evaluatePunchTolerance('17:00', '17:17', 'saida', 10);
    expect(res.isOvertime).toBe(true);
    expect(res.diffMinutes).toBe(17);
  });

  it('detects early leave beyond tolerance', () => {
    const res = evaluatePunchTolerance('17:00', '16:40', 'saida', 10);
    expect(res.isEarlyLeave).toBe(true);
    expect(res.diffMinutes).toBe(20);
  });
});

describe('Date normalization, formatting and chronological sorting', () => {
  it('normalizes mixed formats and formats to DD/MM/AAAA', () => {
    expect(normalizeDateToISO('16/10/2026')).toBe('2026-10-16');
    expect(normalizeDateToISO('23-11-2026')).toBe('2026-11-23');
    expect(formatDateBR('2026-11-23')).toBe('23/11/2026');
    expect(formatDateBR('23-11-2026')).toBe('23/11/2026');
  });

  it('sorts chronologically across different months with identical day numbers', () => {
    const input = ['16/11/2026', '16/10/2026', '2026-11-17', '10/11/2026'];
    const asc = [...input].sort((a, b) => parseDateSortTimestamp(a) - parseDateSortTimestamp(b));
    const desc = [...input].sort((a, b) => parseDateSortTimestamp(b) - parseDateSortTimestamp(a));
    expect(asc).toEqual(['16/10/2026', '10/11/2026', '16/11/2026', '2026-11-17']);
    expect(desc).toEqual(['2026-11-17', '16/11/2026', '10/11/2026', '16/10/2026']);
  });
});

describe('matchesDateSearchQuery', () => {
  it('matches slash, dash, ISO and partial queries', () => {
    expect(matchesDateSearchQuery('2026-11-23', '23/11/2026')).toBe(true);
    expect(matchesDateSearchQuery('2026-11-23', '23-11-2026')).toBe(true);
    expect(matchesDateSearchQuery('2026-11-23', '2026-11-23')).toBe(true);
    expect(matchesDateSearchQuery('2026-11-23', '11-2026')).toBe(true);
    expect(matchesDateSearchQuery('2026-11-23', '20-11-2026')).toBe(false);
    expect(matchesDateSearchQuery('2026-11-23', '')).toBe(false);
  });
});

describe('isDirectionalForgetfulnessMatch', () => {
  it('isolates exit forgetfulness from entry punches and vice-versa', () => {
    const exitNote = '[Esquecimento de Saída: Saída real no horário previsto (15:48)]';
    const entryNote = '[Esquecimento de Entrada: Chegada real no horário previsto (08:00)]';
    const legacyNote = '[Esquecimento de Ponto] Esqueci de bater';

    expect(isDirectionalForgetfulnessMatch(exitNote, 'exit')).toBe(true);
    expect(isDirectionalForgetfulnessMatch(exitNote, 'entry')).toBe(false);
    expect(isDirectionalForgetfulnessMatch(entryNote, 'entry')).toBe(true);
    expect(isDirectionalForgetfulnessMatch(entryNote, 'exit')).toBe(false);
    expect(isDirectionalForgetfulnessMatch(legacyNote, 'entry')).toBe(true);
    expect(isDirectionalForgetfulnessMatch(legacyNote, 'exit')).toBe(true);
  });
});

describe('selectActiveTodayShift', () => {
  it('selects open second shift after first is completed and respects explicit choice', () => {
    const s1Done = { id: 's1', startTime: '08:00', checkInTime: '08:02', checkOutTime: '12:00' };
    const s1InProgress = { id: 's1', startTime: '08:00', checkInTime: '08:02' };
    const s2Open = { id: 's2', startTime: '14:00' };
    const s2Done = { id: 's2', startTime: '14:00', checkInTime: '14:01', checkOutTime: '18:00' };

    expect(selectActiveTodayShift([s1Done])?.id).toBe('s1');
    expect(selectActiveTodayShift([s1Done, s2Open])?.id).toBe('s2');
    expect(selectActiveTodayShift([s1InProgress, s2Open])?.id).toBe('s1');
    expect(selectActiveTodayShift([s1Done, s2Open], 's1')?.id).toBe('s1');
    expect(selectActiveTodayShift([s1Done, s2Done])?.id).toBe('s2');
  });
});

describe('isShiftPast24hWithoutPunch', () => {
  it('flags missing punch only after 24h from shift start', () => {
    const now = new Date(2026, 10, 23, 16, 0, 0);
    expect(isShiftPast24hWithoutPunch({ date: '2026-11-22', startTime: '15:00' }, now)).toBe(true);
    expect(isShiftPast24hWithoutPunch({ date: '2026-11-22', startTime: '15:00', checkInTime: '15:05' }, now)).toBe(false);
    expect(isShiftPast24hWithoutPunch({ date: '2026-11-23', startTime: '08:00' }, now)).toBe(false);
  });
});

describe('resolveAttendanceReportStatusAndObs', () => {
  it('keeps worked day as Presente/Homologado no banco when deviation justification is approved', () => {
    const res = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: true,
      attendanceStatus: 'present',
      notes: '[Esquecimento de Saída: Saída real no horário previsto (15:05) - Batida às 15:23] | [HOMOLOGADO GESTOR: Esquecimento de Saída Homologado / Horário Normal Ajustado]',
      isPast24h: false,
      justifications: [{ status: 'approved', reason: '[Esquecimento de Saída]' }],
    });
    expect(res.status).toBe('Presente');
    expect(res.cleanObs).toBe('Homologado no banco');
  });

  it('promotes late punch to Presente when delay is abono-approved', () => {
    const res = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: true,
      attendanceStatus: 'late',
      notes: '[Atraso 35m: consulta] | [ABONO GESTOR: Atraso Abonado]',
      isPast24h: false,
      justifications: [{ status: 'approved' }],
    });
    expect(res.status).toBe('Presente');
    expect(res.cleanObs).toBe('Homologado no banco');
  });

  it('distinguishes pending entry forgetfulness from exit forgetfulness on worked shifts', () => {
    const entryRes = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: true,
      attendanceStatus: 'late',
      notes: '[Esquecimento de Entrada: Chegada real no horário previsto (08:00) - Batida às 08:35]',
      isPast24h: false,
      justifications: [{ status: 'pending' }],
    });
    expect(entryRes.status).toBe('Atrasado');
    expect(entryRes.cleanObs).toBe('Esquecimento de entrada');

    const exitRes = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: true,
      attendanceStatus: 'present',
      notes: '[Esquecimento de Saída: Saída real no horário previsto (17:00) - Batida às 17:20]',
      isPast24h: false,
      justifications: [{ status: 'pending' }],
    });
    expect(exitRes.status).toBe('Presente');
    expect(exitRes.cleanObs).toBe('Esquecimento de saída');
  });

  it('classifies unworked shift with approved justification as Justificado / Ausência abonada', () => {
    const res = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: false,
      attendanceStatus: 'justified',
      isPast24h: true,
      justifications: [{ status: 'approved' }],
    });
    expect(res.status).toBe('Justificado');
    expect(res.cleanObs).toBe('Ausência abonada');
  });

  it('classifies unworked shift past 24h without justification as Ausente', () => {
    const res = resolveAttendanceReportStatusAndObs({
      hasWorkedPunch: false,
      attendanceStatus: 'pending',
      isPast24h: true,
      justifications: [],
    });
    expect(res.status).toBe('Ausente');
    expect(res.isDecisionPending).toBe(true);
    expect(res.cleanObs).toBe('Não bateu ponto');
  });
});
