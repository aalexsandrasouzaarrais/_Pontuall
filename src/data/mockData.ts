import { Employee, Shift, TimeOffRequest, AbsenceJustification, NotificationItem, ManagerReminder } from '../types';
import { getTodayDateString, getWeekDates } from '../utils/dateUtils';
import { ORBIT_COLORS } from '../components/OrbitShiftModal';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Lucas Silva',
    role: 'Analista de Atendimento',
    department: 'Atendimento',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    email: 'lucas.silva@employer.com.br',
    phone: '(11) 98765-4321',
    standardHoursPerWeek: 40,
    contractType: 'CLT',
    workplace: 'Sede Employer - Matriz',
  },
  {
    id: 'emp-2',
    name: 'Beatriz Santos',
    role: 'Especialista de Suporte',
    department: 'Suporte Técnico',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    email: 'beatriz.santos@employer.com.br',
    phone: '(11) 97654-3210',
    standardHoursPerWeek: 40,
    contractType: 'PJ',
    monthlyHoursQuota: 160,
    hourlyRate: 45.0,
    workplace: 'Call Center / Remoto',
  },
  {
    id: 'emp-3',
    name: 'Rafael Mendes',
    role: 'Operador de Escala',
    department: 'Operações',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    email: 'rafael.mendes@employer.com.br',
    phone: '(11) 96543-2109',
    standardHoursPerWeek: 44,
    contractType: 'CLT',
    workplace: 'Logística - Galpão 01',
  },
  {
    id: 'emp-4',
    name: 'Mariana Costa',
    role: 'Consultora de Vendas',
    department: 'Comercial',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    email: 'mariana.costa@employer.com.br',
    phone: '(11) 95432-1098',
    standardHoursPerWeek: 40,
    contractType: 'CLT',
    workplace: 'Sede Employer - Matriz',
  },
  {
    id: 'emp-5',
    name: 'Thiago Oliveira',
    role: 'Desenvolvedor Frontend',
    department: 'Tecnologia',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    email: 'thiago.oliveira@employer.com.br',
    phone: '(11) 94321-0987',
    standardHoursPerWeek: 40,
    contractType: 'PJ',
    monthlyHoursQuota: 160,
    hourlyRate: 65.0,
    workplace: 'Tech Lab / Remoto',
  },
  {
    id: 'emp-6',
    name: 'Juliana Lima',
    role: 'Supervisora de Operações',
    department: 'Operações',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    email: 'juliana.lima@employer.com.br',
    phone: '(11) 93210-9876',
    standardHoursPerWeek: 44,
    contractType: 'CLT',
    workplace: 'Logística - Galpão 01',
  }
];

export const MANAGER_PROFILE = {
  id: 'mgr-1',
  name: 'Camila Duarte',
  role: 'Gerente Geral de Escalas',
  department: 'Gestão de Pessoas & Operações',
  avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
  email: 'camila.duarte@employer.com.br',
};

export function getInitialShifts(): Shift[] {
  const weekDays = getWeekDates(new Date());
  const todayStr = getTodayDateString();
  const shifts: Shift[] = [];

  if (weekDays[0]) {
    shifts.push(
      {
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
      },
      {
        id: 'shift-2',
        employeeId: 'emp-2',
        date: weekDays[0].dateString,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'present',
        type: 'meeting',
        title: 'Alinhamento Semanal + Suporte N2',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        notes: 'Apresentar métricas de SLA do suporte do mês anterior.',
        projectTag: 'Projeto Onboarding',
        color: ORBIT_COLORS[4], // Violeta
        workplace: 'Call Center / Remoto',
        checkInTime: '08:55',
        checkInLocation: {
          latitude: -23.5505,
          longitude: -46.6333,
          address: 'Sede Employer - Av. Paulista, 1000 - SP',
          gpsValidated: true
        }
      },
      {
        id: 'shift-3',
        employeeId: 'emp-3',
        date: weekDays[0].dateString,
        startTime: '07:00',
        endTime: '16:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'present',
        type: 'regular',
        title: 'Operações de Campo',
        color: ORBIT_COLORS[2], // Esmeralda
        workplace: 'Logística - Galpão 01',
        checkInTime: '06:58'
      },
      {
        id: 'shift-4',
        employeeId: 'emp-4',
        date: weekDays[0].dateString,
        startTime: '08:30',
        endTime: '17:30',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'justified',
        type: 'regular',
        title: 'Prospecção Ativa',
        color: ORBIT_COLORS[1], // Âmbar
        workplace: 'Sede Employer - Matriz',
        notes: 'Consulta médica agendada no período matutino - Atestado enviado.'
      }
    );
  }

  if (weekDays[1]) {
    shifts.push(
      {
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
      },
      {
        id: 'shift-6',
        employeeId: 'emp-2',
        date: weekDays[1].dateString,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'absent',
        type: 'regular',
        title: 'Suporte N2',
        color: ORBIT_COLORS[3], // Azul Oceano
        workplace: 'Call Center / Remoto',
        notes: 'Não compareceu ao turno (No-show registrado pelo sistema)'
      },
      {
        id: 'shift-7',
        employeeId: 'emp-3',
        date: weekDays[1].dateString,
        startTime: '07:00',
        endTime: '16:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'present',
        type: 'regular',
        title: 'Operações Logística',
        color: ORBIT_COLORS[2],
        workplace: 'Logística - Galpão 01'
      },
      {
        id: 'shift-8',
        employeeId: 'emp-5',
        date: weekDays[1].dateString,
        startTime: '10:00',
        endTime: '19:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'present',
        type: 'meeting',
        title: 'Sprint Planning Tech + Deploy',
        meetingLink: 'https://meet.google.com/tech-sprint-planning',
        notes: 'Revisão das entregas do frontend e teste de carga.',
        projectTag: 'Tech Core',
        color: ORBIT_COLORS[4],
        workplace: 'Tech Lab / Remoto'
      }
    );
  }

  if (weekDays[2]) {
    shifts.push(
      {
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
      },
      {
        id: 'shift-10',
        employeeId: 'emp-2',
        date: weekDays[2].dateString,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'regular',
        title: 'Plantão Suporte Avançado',
        color: ORBIT_COLORS[3],
        workplace: 'Call Center / Remoto'
      },
      {
        id: 'shift-11',
        employeeId: 'emp-4',
        date: weekDays[2].dateString,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'meeting',
        title: 'Apresentação de Proposta Comercial',
        meetingLink: 'https://zoom.us/j/9876543210',
        notes: 'Reunião de fechamento comercial.',
        projectTag: 'Contratos Q3',
        color: ORBIT_COLORS[5], // Rosa Magenta
        workplace: 'Sede Employer - Matriz'
      }
    );
  }

  if (weekDays[3]) {
    shifts.push(
      {
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
      },
      {
        id: 'shift-14',
        employeeId: 'emp-3',
        date: weekDays[3].dateString,
        startTime: '07:00',
        endTime: '16:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'regular',
        title: 'Ronda Operacional Externa',
        color: ORBIT_COLORS[2],
        workplace: 'Logística - Galpão 01'
      },
      {
        id: 'shift-15',
        employeeId: 'emp-5',
        date: weekDays[3].dateString,
        startTime: '10:00',
        endTime: '19:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'regular',
        title: 'Desenvolvimento Frontend',
        color: ORBIT_COLORS[4],
        workplace: 'Tech Lab / Remoto'
      }
    );
  }

  if (weekDays[4]) {
    shifts.push(
      {
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
      },
      {
        id: 'shift-17',
        employeeId: 'emp-2',
        date: weekDays[4].dateString,
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'regular',
        title: 'Plantão de Fechamento Suporte',
        color: ORBIT_COLORS[3],
        workplace: 'Call Center / Remoto'
      },
      {
        id: 'shift-18',
        employeeId: 'emp-4',
        date: weekDays[4].dateString,
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'regular',
        title: 'Pipeline Comercial',
        color: ORBIT_COLORS[1],
        workplace: 'Sede Employer - Matriz'
      }
    );
  }

  if (weekDays[5]) {
    shifts.push(
      {
        id: 'shift-19',
        employeeId: 'emp-3',
        date: weekDays[5].dateString,
        startTime: '08:00',
        endTime: '14:00',
        breakMinutes: 15,
        status: 'published',
        attendanceStatus: 'pending',
        type: 'on_call',
        title: 'Plantão Especial de Sábado',
        notes: 'Suporte presencial emergencial',
        color: ORBIT_COLORS[1],
        workplace: 'Logística - Galpão 01'
      }
    );
  }

  return shifts;
}

export const INITIAL_REQUESTS: TimeOffRequest[] = [
  {
    id: 'req-1',
    employeeId: 'emp-2',
    employeeName: 'Beatriz Santos',
    employeeAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    type: 'swap',
    date: '2026-08-29',
    shiftId: 'shift-17',
    targetEmployeeId: 'emp-1',
    targetEmployeeName: 'Lucas Silva',
    reason: 'Compromisso pessoal na faculdade na sexta à noite. Lucas concordou em cobrir meu turno.',
    status: 'pending',
    createdAt: 'Hoje às 10:15'
  },
  {
    id: 'req-2',
    employeeId: 'emp-4',
    employeeName: 'Mariana Costa',
    employeeAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    type: 'time_off',
    date: '2026-09-04',
    reason: 'Solicitação de folga compensatória banco de horas para viagem familiar.',
    status: 'pending',
    createdAt: 'Ontem às 16:40'
  },
  {
    id: 'req-3',
    employeeId: 'emp-3',
    employeeName: 'Rafael Mendes',
    employeeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    type: 'time_off',
    date: '2026-08-21',
    reason: 'Renovação de CNH no Detran.',
    status: 'approved',
    managerNotes: 'Aprovado pelo gestor Camila Duarte.',
    createdAt: '18/08/2026'
  }
];

export const INITIAL_JUSTIFICATIONS: AbsenceJustification[] = [
  {
    id: 'just-1',
    employeeId: 'emp-4',
    employeeName: 'Mariana Costa',
    employeeAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    shiftId: 'shift-4',
    date: '2026-08-24',
    reason: 'Consulta médica e exames laboratoriais de rotina.',
    documentName: 'Atestado_Medico_Dra_Juliana_CRM12345.pdf',
    documentType: 'application/pdf',
    status: 'pending',
    submittedAt: 'Hoje às 08:30'
  },
  {
    id: 'just-2',
    employeeId: 'emp-2',
    employeeName: 'Beatriz Santos',
    employeeAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    shiftId: 'shift-6',
    date: '2026-08-25',
    reason: 'Forte enxaqueca com atendimento em pronto-socorro.',
    documentName: 'Declaracao_Comparecimento_Hospital_SaoLuiz.pdf',
    documentType: 'application/pdf',
    status: 'pending',
    submittedAt: 'Ontem às 14:10'
  }
];

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
    assignedEmployeeIds: ['emp-1', 'emp-2', 'emp-4']
  }
];
