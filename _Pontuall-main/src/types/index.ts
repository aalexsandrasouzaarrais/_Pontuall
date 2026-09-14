export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'ADMIN';

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
  monthlyHoursQuota?: number; // Ex: 160h para PJ
  hourlyRate?: number; // Ex: R$ 45,00/h
  workplace?: string; // Ex: 'Logística - Galpão 01'
}

export type ShiftStatus = 'draft' | 'published';
export type AttendanceStatus = 'pending' | 'present' | 'absent' | 'justified' | 'late';
export type ShiftType = 'regular' | 'meeting' | 'on_call' | 'training';

export interface ShiftColor {
  label: string;
  bg: string;
  border: string;
  text: string;
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
  checkInTime?: string;
  checkInLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    gpsValidated: boolean;
  };
}

export interface ShiftTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  days: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: ShiftType;
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
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
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
  type: 'meeting' | 'task' | 'project' | 'alert';
  link?: string;
  projectTag?: string;
  assignedEmployeeIds?: string[];
  completed?: boolean;
}
