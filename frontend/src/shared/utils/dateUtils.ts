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
 * Formata qualquer data (string YYYY-MM-DD, ISO, timestamp ou Date) para o padrão brasileiro DD/MM/AAAA.
 * Não sofre com problemas de timezone UTC-3 para strings contendo apenas ano-mês-dia.
 */
export function formatDateBR(val?: string | Date | number | null): string {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const clean = String(val).trim();
  if (!clean) return '';

  // Se já for DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }
  // Se for DD-MM-AAAA
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    return clean.replace(/-/g, '/');
  }
  // Se começar com YYYY-MM-DD ou YYYY/MM/DD (com ou sem horário posterior)
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Se for timestamp ou string ISO com fuso
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return clean;
}

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD para comparações estritas em filtros
 * e valores de <input type="date">.
 */
export function normalizeDateToISO(val?: string | Date | number | null): string {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return toLocalDateString(val);
  }
  const clean = String(val).trim();
  if (!clean) return '';

  // Se começar com YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // Se for DD/MM/AAAA ou DD-MM-AAAA
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return toLocalDateString(d);
  }

  return clean;
}

/**
 * Compara se duas datas representam o mesmo dia civil, independentemente do formato
 * (DD/MM/AAAA, YYYY-MM-DD, Date, ISO).
 */
export function isSameDate(d1?: string | Date | number | null, d2?: string | Date | number | null): boolean {
  const iso1 = normalizeDateToISO(d1);
  const iso2 = normalizeDateToISO(d2);
  if (!iso1 || !iso2) return false;
  return iso1 === iso2;
}

/**
 * Formata data e hora no padrão brasileiro: DD/MM/AAAA às HH:mm (ou DD/MM/AAAA HH:mm)
 */
export function formatDateTimeBR(val?: string | Date | null, withAt: boolean = false): string {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) {
    return formatDateBR(val);
  }
  const datePart = formatDateBR(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return withAt ? `${datePart} às ${hh}:${mm}` : `${datePart} ${hh}:${mm}`;
}
