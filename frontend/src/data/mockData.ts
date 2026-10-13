import { Employee, Shift, TimeOffRequest, AbsenceJustification, NotificationItem, ManagerReminder } from '../types';

export const INITIAL_EMPLOYEES: Employee[] = [];

export function getInitialShifts(): Shift[] {
  return [];
}

export const INITIAL_REQUESTS: TimeOffRequest[] = [];
export const INITIAL_JUSTIFICATIONS: AbsenceJustification[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_REMINDERS: ManagerReminder[] = [];
