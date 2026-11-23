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
