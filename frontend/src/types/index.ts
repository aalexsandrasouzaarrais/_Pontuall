export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'RH' | 'ADMIN';

export type ContractType = 'CLT' | 'PJ' | 'TEMPORARIO';

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  email: string;
  phone: string;
  standardHoursPerWeek: number;
  contractType?: ContractType;
  contractStartDate?: string; // Data de início do contrato (YYYY-MM-DD)
  contractEndDate?: string; // Data de término do contrato temporário (YYYY-MM-DD)
  monthlyHoursQuota?: number; // Ex: 160h para PJ
  pjMonthlyHoursQuota?: number; // Alias para compatibilidade
  hourlyRate?: number; // Ex: R$ 45,00/h
  workplace?: string; // Ex: 'Logística - Galpão 01'
  registrationId?: string; // Matrícula / ID BNE (Cod_Matricula ex: PNT-7842)
  companyId?: string; // ID da Empresa (Idf_Empresa)
  companyCnpj?: string; // CNPJ da Empresa (Num_CNPJ)
  isMasterManager?: boolean; // Se é Gestor Master / Admin da Empresa (Flg_Gestor_Master)
  isRh?: boolean; // Se é do perfil RH (Administrador Geral da Empresa)
  roleType?: 'rh' | 'gestor' | 'colaborador'; // Perfil estruturado em 3 níveis
  managerIds?: string[]; // IDs dos Gestores vinculados a este colaborador (M:N)
}

export interface PjReportLink {
  title: string;
  url: string;
}

export interface PjTimesheetEntry {
  id: string;
  taskCode?: string; // ID da Tarefa (ex: TK-101, JIRA-402)
  costCenter?: string; // Centro de Custo (ex: CC-TI-01, Operações)
  date: string; // YYYY-MM-DD
  project: string; // Nome do projeto ou cliente atendido
  taskDescription: string; // Descrição da tarefa realizada
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number; // Pausas ou interrupções no processo (em minutos)
  durationHours: number; // Horas líquidas trabalhadas (ex: 3.5)
  links?: PjReportLink[]; // Links de comprovação (PR, Figma, etc.)
  images?: string[]; // Prints de tela / comprovantes
  isLiveTracked?: boolean; // Se foi registrado com o cronômetro Play/Pause
}

export interface PjActiveTimerState {
  isRunning: boolean;
  isPaused: boolean;
  taskCode?: string;
  costCenter?: string;
  project: string;
  taskDescription: string;
  startTimestamp: number;
  accumulatedSeconds: number;
  pausedTimestamp?: number;
  accumulatedBreakSeconds: number;
  links?: PjReportLink[];
  images?: string[];
}

export interface PjDeliverableReport {
  id: string;
  employeeId: string;
  employeeName?: string;
  period: string;
  hoursWorked: number;
  activitiesDescription: string;
  timesheetEntries?: PjTimesheetEntry[]; // Entradas detalhadas do timesheet
  links: PjReportLink[];
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  managerFeedback?: string;
  submittedAt: string;
  evaluatedAt?: string;
}

export type ShiftStatus = 'draft' | 'published';
export type AttendanceStatus = 'pending' | 'present' | 'absent' | 'justified' | 'late';
export type ShiftType = 'regular' | 'meeting' | 'on_call' | 'training';

export interface ShiftColor {
  label: string;
  bg: string;
  border: string;
  text: string;
  category?: string;
  description?: string;
}

export interface ShiftPunchLocation {
  latitude: number;
  longitude: number;
  address: string;
  gpsValidated: boolean;
  accuracy?: number;
  distanceMeters?: number;
  reportedWorkplace?: string;
  timestamp?: string;
}

export interface WorkplaceLocation {
  id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  isRemote?: boolean;
}

export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  status: ShiftStatus; // 'draft' or 'published'
  attendanceStatus: AttendanceStatus;
  type: ShiftType;
  title?: string;
  notes?: string;
  meetingLink?: string;
  projectTag?: string;
  color?: ShiftColor;
  workplace?: string;
  workplaceLocation?: WorkplaceLocation;
  checkInTime?: string;
  checkInLocation?: ShiftPunchLocation;
  checkOutTime?: string;
  checkOutLocation?: ShiftPunchLocation;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workplace?: string;
  workplaceLocation?: WorkplaceLocation;
  days: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: ShiftType;
    breakMinutes?: number;
    title?: string;
    workplace?: string;
    workplaceLocation?: WorkplaceLocation;
  }[];
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  type: 'time_off' | 'swap';
  date: string;
  shiftId?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  shiftTitle?: string;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  peerStatus?: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  managerNotes?: string;
}

export interface AbsenceJustification {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  shiftId: string;
  date: string;
  reason: string;
  documentName?: string;
  documentType?: string;
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  managerNotes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'shift_change' | 'approval' | 'justification' | 'reminder' | 'system' | 'swap';
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

export interface ManagerReminder {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: 'meeting' | 'task' | 'project' | 'alert' | 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
  link?: string;
  projectTag?: string;
  tag?: string;
  assignedEmployeeIds?: string[];
  assigneeName?: string;
  completed?: boolean;
}
