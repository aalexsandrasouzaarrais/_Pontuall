import { Employee, Shift, TimeOffRequest, AbsenceJustification, NotificationItem, ManagerReminder } from '../types';
import { getTodayDateString, getWeekDates } from '@/shared/utils/dateUtils';
import { ORBIT_COLORS } from '@/modules/shifts/components/OrbitShiftModal';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'mgr-2',
    name: 'Roberto Alves',
    role: 'Gestor de TI & Atendimento',
    department: 'Tecnologia & Atendimento',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    email: 'gestor.ti@pontual.com',
    phone: '(11) 97777-8888',
    standardHoursPerWeek: 44,
    contractType: 'CLT',
    workplace: 'Sede Employer - Matriz',
    isRh: false,
    roleType: 'gestor',
  },
  {
    id: 'emp-1',
    name: 'Lucas Silva',
    role: 'Analista de Atendimento',
    department: 'Atendimento',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email: 'colaborador@pontual.com',
    phone: '(11) 98765-4321',
    standardHoursPerWeek: 40,
    contractType: 'CLT',
    workplace: 'Sede Employer - Matriz',
    isRh: false,
    roleType: 'colaborador',
    managerIds: ['mgr-2'],
  }
];

export const MANAGER_PROFILE: Employee = {
  id: 'mgr-1',
  name: 'Camila Duarte',
  role: 'Gerente de RH & Gestão Geral',
  department: 'Recursos Humanos',
  avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
  email: 'gestor@pontual.com',
  phone: '(11) 91111-2222',
  standardHoursPerWeek: 44,
  isRh: true,
  isMasterManager: true,
  roleType: 'rh',
};

export function getInitialShifts(): Shift[] {
  const weekDays = getWeekDates(new Date());
  const todayStr = getTodayDateString();
  const shifts: Shift[] = [];

  if (weekDays[0]) {
    shifts.push({
      id: 'shift-1',
      employeeId: 'emp-1',
      date: weekDays[0].dateString,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      status: 'published',
      attendanceStatus: 'present',
      type: 'regular',
      title: 'Atendimento Geral - Turno Manhã',
      notes: 'Realizar triagem das filas de espera prioritárias.',
      color: ORBIT_COLORS[0], // Coral
      workplace: 'Sede Employer - Matriz',
      checkInTime: '07:58',
      checkInLocation: {
        latitude: -23.5505,
        longitude: -46.6333,
        address: 'Sede Employer - Av. Paulista, 1000 - SP',
        gpsValidated: true
      }
    });
  }

  if (weekDays[1]) {
    shifts.push({
      id: 'shift-5',
      employeeId: 'emp-1',
      date: weekDays[1].dateString,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      status: 'published',
      attendanceStatus: 'present',
      type: 'regular',
      title: 'Atendimento Geral',
      color: ORBIT_COLORS[0],
      workplace: 'Sede Employer - Matriz'
    });
  }

  if (weekDays[2]) {
    shifts.push({
      id: 'shift-9',
      employeeId: 'emp-1',
      date: weekDays[2].dateString,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      status: 'published',
      attendanceStatus: weekDays[2].dateString === todayStr ? 'present' : 'pending',
      type: 'regular',
      title: 'Atendimento & Suporte Chat',
      color: ORBIT_COLORS[0],
      workplace: 'Sede Employer - Matriz'
    });
  }

  if (weekDays[3]) {
    shifts.push({
      id: 'shift-13',
      employeeId: 'emp-1',
      date: weekDays[3].dateString,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      status: 'published',
      attendanceStatus: 'pending',
      type: 'regular',
      title: 'Atendimento Telefônico & WhatsApp',
      color: ORBIT_COLORS[0],
      workplace: 'Sede Employer - Matriz'
    });
  }

  if (weekDays[4]) {
    shifts.push({
      id: 'shift-16',
      employeeId: 'emp-1',
      date: weekDays[4].dateString,
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      status: 'published',
      attendanceStatus: 'pending',
      type: 'meeting',
      title: 'Retrospectiva Semanal de Equipe',
      meetingLink: 'https://meet.google.com/retrospectiva-equipe-shift',
      notes: 'Revisão dos resultados da semana e alinhamento.',
      color: ORBIT_COLORS[4],
      workplace: 'Sede Employer - Matriz'
    });
  }

  return shifts;
}

export const INITIAL_REQUESTS: TimeOffRequest[] = [];

export const INITIAL_JUSTIFICATIONS: AbsenceJustification[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Escala Oficial Publicada',
    message: 'A escala da semana foi oficializada pela gestão. Confira seus horários.',
    type: 'shift_change',
    timestamp: 'Há 2 horas',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Ponto Registrado via GPS',
    message: 'Presença confirmada às 07:58 (Localização validada com sucesso).',
    type: 'system',
    timestamp: 'Hoje às 07:58',
    read: true,
  }
];

export const INITIAL_REMINDERS: ManagerReminder[] = [
  {
    id: 'rem-1',
    title: 'Alinhamento Semanal de Metas Q3',
    description: 'Revisão dos indicadores de NPS e tempo de resposta da equipe.',
    date: '2026-08-28',
    time: '14:00',
    type: 'meeting',
    link: 'https://meet.google.com/emp-alinhamento-metas',
    projectTag: 'Metas Corporativas',
    assignedEmployeeIds: ['emp-1']
  }
];
