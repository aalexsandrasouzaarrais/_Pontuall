/**
 * Formata uma data como YYYY-MM-DD usando o fuso horário LOCAL.
 * Nunca use `toISOString().split('T')[0]` para isso: ele converte para UTC
 * e, no Brasil (UTC-3), após as 21h retorna o dia seguinte.
 */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return toLocalDateString(new Date());
}

/** Soma (ou subtrai) dias de uma data sem alterar a original. */
export function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Retorna a segunda-feira (00:00 local) da semana da data informada. */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0 = Domingo
  return addDaysLocal(d, day === 0 ? -6 : 1 - day);
}

/** Retorna o domingo (00:00 local) da semana da data informada. */
export function startOfWeekSunday(d: Date): Date {
  return addDaysLocal(d, -d.getDay());
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr;
}

export function calculateShiftDurationHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  return Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);
}

/** Formata minutos para formato relógio elegante (ex: 29h 54m ou 8h) */
export function formatMinutesToHoursString(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Converte horas decimais para minutos inteiros seguros */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/** Calcula os minutos reais trabalhados entre entrada e saída */
export function calculatePunchDurationMinutes(checkInTime?: string, checkOutTime?: string, breakMinutes: number = 0): number {
  if (!checkInTime || !checkOutTime) return 0;
  const [inH, inM] = checkInTime.split(':').map(Number);
  const [outH, outM] = checkOutTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
  
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }
  return Math.max(0, outMinutes - inMinutes - breakMinutes);
}

export interface PunchToleranceResult {
  isOntime: boolean;
  isLate: boolean;
  isEarly: boolean;
  isOvertime: boolean;
  isEarlyLeave: boolean;
  diffMinutes: number;
  message: string;
}

/** Avalia tolerância de ponto conforme CLT (Art. 58 § 1º: padrão 10 minutos) */
export function evaluatePunchTolerance(
  scheduledTime: string,
  actualTime: string,
  type: 'entrada' | 'saida',
  toleranceMinutes: number = 10
): PunchToleranceResult {
  if (!scheduledTime || !actualTime) {
    return {
      isOntime: true,
      isLate: false,
      isEarly: false,
      isOvertime: false,
      isEarlyLeave: false,
      diffMinutes: 0,
      message: 'No horário',
    };
  }

  const [sH, sM] = scheduledTime.split(':').map(Number);
  const [aH, aM] = actualTime.split(':').map(Number);
  const scheduledMin = sH * 60 + sM;
  const actualMin = aH * 60 + aM;
  const diff = actualMin - scheduledMin;

  if (type === 'entrada') {
    if (diff > toleranceMinutes) {
      return {
        isOntime: false,
        isLate: true,
        isEarly: false,
        isOvertime: false,
        isEarlyLeave: false,
        diffMinutes: diff,
        message: `Atraso de ${diff} min`,
      };
    } else if (diff < -toleranceMinutes) {
      return {
        isOntime: false,
        isLate: false,
        isEarly: true,
        isOvertime: false,
        isEarlyLeave: false,
        diffMinutes: Math.abs(diff),
        message: `Entrada antecipada em ${Math.abs(diff)} min`,
      };
    }
    return {
      isOntime: true,
      isLate: false,
      isEarly: false,
      isOvertime: false,
      isEarlyLeave: false,
      diffMinutes: Math.abs(diff),
      message: 'Entrada dentro da tolerância',
    };
  } else {
    // saída
    if (diff > toleranceMinutes) {
      return {
        isOntime: false,
        isLate: false,
        isEarly: false,
        isOvertime: true,
        isEarlyLeave: false,
        diffMinutes: diff,
        message: `Hora extra: +${diff} min após o expediente`,
      };
    } else if (diff < -toleranceMinutes) {
      return {
        isOntime: false,
        isLate: false,
        isEarly: false,
        isOvertime: false,
        isEarlyLeave: true,
        diffMinutes: Math.abs(diff),
        message: `Saída antecipada em ${Math.abs(diff)} min`,
      };
    }
    return {
      isOntime: true,
      isLate: false,
      isEarly: false,
      isOvertime: false,
      isEarlyLeave: false,
      diffMinutes: Math.abs(diff),
      message: 'Saída dentro da tolerância',
    };
  }
}


export function getWeekDates(startDate: Date): { date: Date; dateString: string; dayName: string; dayShort: string; isToday: boolean }[] {
  const current = new Date(startDate);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diff));
  
  const days = [];
  const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  const dayShorts = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  
  const todayStr = getTodayDateString();

  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + i);
    
    const year = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    const d = String(nextDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${m}-${d}`;
    
    days.push({
      date: nextDate,
      dateString,
      dayName: dayNames[i],
      dayShort: dayShorts[i],
      isToday: dateString === todayStr,
    });
  }
  
  return days;
}

export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
}

export function formatFullDatePt(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Verifica se um turno está sem registro de ponto após mais de 24 horas da data/horário de início.
 */
export function isShiftPast24hWithoutPunch(
  shift: {
    date: string;
    startTime?: string;
    checkInTime?: string;
    attendanceStatus?: string;
  },
  now: Date = new Date()
): boolean {
  if (!shift || !shift.date) return false;
  if (shift.checkInTime) return false;
  if (shift.attendanceStatus === 'present' || shift.attendanceStatus === 'late') return false;

  try {
    const parts = shift.date.split(/[-/]/).map(Number);
    let year = parts[0];
    let month = parts[1];
    let day = parts[2];
    if (day > 1000) {
      // Formato DD-MM-YYYY
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
    const [startH, startM] = (shift.startTime || '08:00').split(':').map(Number);
    const shiftDateTime = new Date(year, month - 1, day, startH || 8, startM || 0);
    if (isNaN(shiftDateTime.getTime())) return false;

    const diffMs = now.getTime() - shiftDateTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 24;
  } catch {
    return false;
  }
}
