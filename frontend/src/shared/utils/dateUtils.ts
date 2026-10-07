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
