import { Employee } from '@/types';

/**
 * Verifica se um colaborador possui perfil de Gestor ou RH.
 */
export function isManagerProfile(emp?: Employee | null): boolean {
  if (!emp) return false;
  if (emp.roleType === 'gestor' || emp.roleType === 'rh') return true;
  if (emp.isMasterManager || emp.isRh) return true;
  const roleLower = (emp.role || '').toLowerCase();
  return (
    roleLower.includes('gestor') ||
    roleLower.includes('gestora') ||
    roleLower.includes('gerente') ||
    roleLower.includes('rh') ||
    roleLower.includes('recursos humanos')
  );
}

/**
 * Verifica se um colaborador possui regime PJ (Prestador de Serviços),
 * que atua por entregas/timesheet e não por escala de horários fixa.
 */
export function isPjEmployee(emp?: Employee | null): boolean {
  if (!emp) return false;
  if ((emp.contractType || '').toUpperCase() === 'PJ') return true;
  if (emp.hourlyRate !== undefined && emp.hourlyRate > 0) return true;
  const nameLower = (emp.name || '').toLowerCase();
  const roleLower = (emp.role || '').toLowerCase();
  if (/\bpj\b/i.test(nameLower) || /\bpj\b/i.test(roleLower)) return true;
  return false;
}

/**
 * Filtra a lista de colaboradores mantendo apenas aqueles aptos a serem escalados
 * (excluindo gestores, RH e prestadores PJ).
 */
export function getSchedulableEmployees(employees: Employee[], currentEditingEmployeeId?: string): Employee[] {
  if (!employees || !Array.isArray(employees)) return [];
  return employees.filter(emp => {
    if (isPjEmployee(emp)) return false;
    // Se for o colaborador que já é dono da escala sendo editada, mantém para não quebrar a edição
    if (currentEditingEmployeeId && emp.id === currentEditingEmployeeId) return true;
    return !isManagerProfile(emp);
  });
}
