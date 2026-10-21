import { Shift, TimeOffRequest, AbsenceJustification } from '@/types';

export interface ShiftConflictResult {
  hasConflict: boolean;
  conflictingShift: Shift;
  message: string;
}

export interface AbsenceConflictResult {
  hasConflict: boolean;
  type: 'time_off' | 'swap' | 'justification';
  reason: string;
  message: string;
}

export interface InterjornadaResult {
  hasWarning: boolean;
  restHours: number;
  conflictingShift: Shift;
  isPriorShift: boolean; // true se o conflito for com o turno anterior, false se com o posterior
  message: string;
}

/**
 * Converte data (YYYY-MM-DD) e hora (HH:mm) para minutos absolutos desde a epoch Unix
 */
export function getAbsoluteShiftMinutes(dateStr: string, timeStr: string, isNextDay: boolean = false): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const dateObj = new Date(y, m - 1, d);
  if (isNextDay) {
    dateObj.setDate(dateObj.getDate() + 1);
  }
  
  return Math.floor(dateObj.getTime() / 60000) + (hours * 60 + minutes);
}

/**
 * Retorna os minutos de início e fim de um turno, tratando turnos noturnos que cruzam a meia-noite
 */
export function getShiftRangeMinutes(dateStr: string, startTime: string, endTime: string): { startMin: number; endMin: number } {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  
  const startTotalMinutes = sh * 60 + sm;
  const endTotalMinutes = eh * 60 + em;
  
  // Se o horário final for menor que o inicial, o turno cruza a meia-noite
  const crossesMidnight = endTotalMinutes < startTotalMinutes;
  
  const startMin = getAbsoluteShiftMinutes(dateStr, startTime, false);
  const endMin = getAbsoluteShiftMinutes(dateStr, endTime, crossesMidnight);
  
  return { startMin, endMin };
}

/**
 * Verifica se dois intervalos se sobrepõem no tempo.
 * Dois turnos A e B colidem se: InícioA < FimB E FimA > InícioB.
 * Observação: Se FimA == InícioB (turnos consecutivos colados), NÃO é sobreposição.
 */
export function doIntervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

/**
 * Procura se o colaborador já possui algum turno ativo com choque de horário
 */
export function findShiftOverlapConflict(
  target: { employeeId?: string; date?: string; startTime?: string; endTime?: string; id?: string },
  allShifts: Shift[],
  employees?: any[]
): ShiftConflictResult | null {
  if (!target.employeeId || !target.date || !target.startTime || !target.endTime) {
    return null;
  }

  const { startMin: targetStart, endMin: targetEnd } = getShiftRangeMinutes(
    target.date,
    target.startTime,
    target.endTime
  );

  // Turno zerado (ex: 08:00 às 08:00)
  if (targetStart === targetEnd) {
    return {
      hasConflict: true,
      conflictingShift: target as any,
      message: 'O horário de início e fim não podem ser idênticos (duração zerada).',
    };
  }

  for (const shift of allShifts) {
    // Ignora turnos de outros colaboradores ou o próprio turno em edição
    if (shift.employeeId !== target.employeeId) continue;
    if (target.id && shift.id === target.id) continue;

    // Compara apenas turnos com datas próximas (mesmo dia, dia anterior ou dia seguinte)
    const { startMin: existingStart, endMin: existingEnd } = getShiftRangeMinutes(
      shift.date,
      shift.startTime,
      shift.endTime
    );

    if (doIntervalsOverlap(targetStart, targetEnd, existingStart, existingEnd)) {
      const shiftName = shift.title || 'Turno sem título';
      return {
        hasConflict: true,
        conflictingShift: shift,
        message: `O colaborador já está escalado em "${shiftName}" das ${shift.startTime} às ${shift.endTime} (data: ${shift.date}).`,
      };
    }
  }

  return null;
}

/**
 * Verifica se o colaborador possui solicitação de folga, férias ou atestado médico aprovado para o dia
 */
export function checkTimeOffConflict(
  targetOrEmpId: string | { employeeId?: string; date?: string },
  dateOrRequests?: string | TimeOffRequest[],
  requestsOrJustifications?: TimeOffRequest[] | AbsenceJustification[],
  justificationsParam?: AbsenceJustification[]
): AbsenceConflictResult | null {
  const employeeId = typeof targetOrEmpId === 'string' ? targetOrEmpId : targetOrEmpId?.employeeId;
  const dateStr = typeof targetOrEmpId === 'string' ? (dateOrRequests as string) : targetOrEmpId?.date;
  const requests = typeof targetOrEmpId === 'string' ? (requestsOrJustifications as TimeOffRequest[]) : (dateOrRequests as TimeOffRequest[]);
  const justifications = typeof targetOrEmpId === 'string' ? justificationsParam : (requestsOrJustifications as AbsenceJustification[]);

  if (!employeeId || !dateStr) return null;

  // 1. Verifica solicitações de folga / férias aprovadas
  if (requests && requests.length > 0) {
    const approvedRequest = requests.find(
      r => r.employeeId === employeeId && r.date === dateStr && r.status === 'approved'
    );
    if (approvedRequest) {
      const label = approvedRequest.type === 'time_off' ? 'Folga / Férias' : 'Troca de Turno';
      return {
        hasConflict: true,
        type: approvedRequest.type,
        reason: approvedRequest.reason || 'Ausência aprovada pela gestão',
        message: `O colaborador possui solicitação de ${label} APROVADA para este dia (${approvedRequest.reason || 'Sem justificativa adicional'}).`,
      };
    }
  }

  // 2. Verifica justificativas / atestados médicos aprovados
  if (justifications && justifications.length > 0) {
    const approvedJustification = justifications.find(
      j => j.employeeId === employeeId && j.date === dateStr && (j.status === 'approved' || j.status === 'pendente' as any)
    );
    if (approvedJustification && approvedJustification.status === 'approved') {
      return {
        hasConflict: true,
        type: 'justification',
        reason: approvedJustification.reason || 'Atestado médico aprovado',
        message: `O colaborador possui Atestado Médico / Ausência APROVADA para esta data (${approvedJustification.reason}).`,
      };
    }
  }

  return null;
}

/**
 * Verifica intervalo interjornada (CLT Art. 66: Mínimo de 11 horas consecutivas de descanso)
 */
export function checkInterjornadaRest(
  target: { employeeId: string; date: string; startTime: string; endTime: string; id?: string },
  allShifts: Shift[]
): InterjornadaResult | null {
  if (!target.employeeId || !target.date || !target.startTime || !target.endTime) {
    return null;
  }

  const { startMin: targetStart, endMin: targetEnd } = getShiftRangeMinutes(
    target.date,
    target.startTime,
    target.endTime
  );

  const MIN_REST_MINUTES = 11 * 60; // 660 minutos = 11 horas

  for (const shift of allShifts) {
    if (shift.employeeId !== target.employeeId) continue;
    if (target.id && shift.id === target.id) continue;

    const { startMin: existingStart, endMin: existingEnd } = getShiftRangeMinutes(
      shift.date,
      shift.startTime,
      shift.endTime
    );

    // Caso 1: Turno existente termina ANTES do início do novo turno
    if (existingEnd <= targetStart) {
      const restMinutes = targetStart - existingEnd;
      if (restMinutes < MIN_REST_MINUTES) {
        const restHours = (restMinutes / 60).toFixed(1);
        return {
          hasWarning: true,
          restHours: parseFloat(restHours),
          conflictingShift: shift,
          isPriorShift: true,
          message: `Aviso CLT (Art. 66): O descanso entre o turno anterior (${shift.date} até ${shift.endTime}) e este será de apenas ${restHours}h. O mínimo legal é de 11 horas consecutivas.`,
        };
      }
    }

    // Caso 2: Novo turno termina ANTES do início de um turno já cadastrado
    if (targetEnd <= existingStart) {
      const restMinutes = existingStart - targetEnd;
      if (restMinutes < MIN_REST_MINUTES) {
        const restHours = (restMinutes / 60).toFixed(1);
        return {
          hasWarning: true,
          restHours: parseFloat(restHours),
          conflictingShift: shift,
          isPriorShift: false,
          message: `Aviso CLT (Art. 66): O descanso entre este turno e o próximo (${shift.date} às ${shift.startTime}) será de apenas ${restHours}h. O mínimo legal é de 11 horas consecutivas.`,
        };
      }
    }
  }

  return null;
}
