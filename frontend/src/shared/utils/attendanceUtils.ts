/**
 * Seleciona o turno ativo do dia quando há múltiplos turnos escalados na mesma data.
 */
export function selectActiveTodayShift<
  T extends { id: string; startTime?: string; checkInTime?: string; checkOutTime?: string }
>(todayShifts: T[], selectedShiftId?: string | null): T | undefined {
  if (!todayShifts.length) return undefined;
  if (selectedShiftId) {
    const chosen = todayShifts.find(s => s.id === selectedShiftId);
    if (chosen) return chosen;
  }
  const inProgress = todayShifts.find(s => Boolean(s.checkInTime) && !s.checkOutTime);
  if (inProgress) return inProgress;
  const uncompleted = todayShifts.find(s => !s.checkInTime || !s.checkOutTime);
  if (uncompleted) return uncompleted;
  return todayShifts[todayShifts.length - 1];
}

/**
 * Verifica se um texto de justificativa de esquecimento corresponde à direção da batida (entrada ou saída).
 */
export function isDirectionalForgetfulnessMatch(text: string, direction: 'entry' | 'exit'): boolean {
  const lower = (text || '').toLowerCase();
  const hasEntry = lower.includes('esquecimento de entrada');
  const hasExit = lower.includes('esquecimento de saída') || lower.includes('esquecimento de saida');
  if (!hasEntry && !hasExit) return true; // registros legados sem direção
  return direction === 'entry' ? hasEntry : hasExit;
}

export interface AttendanceReportResolutionInput {
  hasWorkedPunch: boolean;
  attendanceStatus?: string;
  notes?: string;
  isPast24h: boolean;
  justifications: Array<{ status?: string; reason?: string }>;
}

export interface AttendanceReportResolutionResult {
  status: 'Presente' | 'Atrasado' | 'Ausente' | 'Justificado' | 'Pendente';
  isDecisionPending: boolean;
  cleanObs: string;
}

/**
 * Resolve o status e a observação concisa de um turno no Relatório de Presenças.
 * Garante que dias efetivamente trabalhados não sejam classificados como "Ausência abonada".
 */
export function resolveAttendanceReportStatusAndObs(
  input: AttendanceReportResolutionInput
): AttendanceReportResolutionResult {
  const { hasWorkedPunch, attendanceStatus, notes = '', isPast24h, justifications } = input;
  const statusMap: Record<string, AttendanceReportResolutionResult['status']> = {
    present: 'Presente',
    late: 'Atrasado',
    absent: 'Ausente',
    justified: 'Justificado',
    pending: 'Pendente',
  };

  const hasApprovedJust = justifications.some(j => j.status === 'approved');
  const pendingJust = justifications.find(j => j.status === 'pending');
  const hasRejectedJust = justifications.some(j => j.status === 'rejected');

  if (hasWorkedPunch) {
    const delayAbonado =
      notes.includes('[ABONO GESTOR: Atraso') ||
      notes.includes('Esquecimento de Entrada Homologado');
    const status: AttendanceReportResolutionResult['status'] =
      attendanceStatus === 'late' && !delayAbonado ? 'Atrasado' : 'Presente';

    let cleanObs = '';
    if (notes.includes('AJUSTE GESTOR')) {
      cleanObs = 'Ajustado p/ horário normal';
    } else if (notes.includes('HOMOLOGADO GESTOR') || notes.includes('ABONO GESTOR') || hasApprovedJust) {
      cleanObs = 'Homologado no banco';
    } else if (notes.includes('Esquecimento de Entrada')) {
      cleanObs = 'Esquecimento de entrada';
    } else if (notes.includes('Esquecimento de Saída') || notes.includes('Esquecimento de Saida')) {
      cleanObs = 'Esquecimento de saída';
    } else if (notes.includes('Esquecimento')) {
      cleanObs = 'Esquecimento de ponto';
    } else if (notes) {
      cleanObs = notes.replace(/\[.*?\]/g, '').trim() || notes;
    }

    return { status, isDecisionPending: false, cleanObs };
  }

  // Sem batida de ponto registrada
  if (attendanceStatus === 'justified' || hasApprovedJust) {
    return { status: 'Justificado', isDecisionPending: false, cleanObs: 'Ausência abonada' };
  }
  if (attendanceStatus === 'present' || attendanceStatus === 'late') {
    return { status: attendanceStatus === 'late' ? 'Atrasado' : 'Presente', isDecisionPending: false, cleanObs: '' };
  }
  if (justifications.length > 0) {
    if (pendingJust) {
      const status = isPast24h || attendanceStatus === 'absent' ? 'Ausente' : 'Pendente';
      const cleanObs = status === 'Ausente' ? `Justificativa: "${pendingJust?.reason || 'Em análise'}"` : '';
      return { status, isDecisionPending: true, cleanObs };
    }
    if (hasRejectedJust) {
      return { status: 'Ausente', isDecisionPending: false, cleanObs: 'Não bateu ponto' };
    }
  }
  if (isPast24h || attendanceStatus === 'absent') {
    return { status: 'Ausente', isDecisionPending: true, cleanObs: 'Não bateu ponto' };
  }

  return {
    status: statusMap[attendanceStatus || 'pending'] || 'Pendente',
    isDecisionPending: false,
    cleanObs: '',
  };
}
