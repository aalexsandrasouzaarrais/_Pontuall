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
 * Filtra a lista de colaboradores mantendo apenas aqueles aptos a serem escalados (excluindo gestores e RH).
 */
export function getSchedulableEmployees(employees: Employee[], currentEditingEmployeeId?: string): Employee[] {
  if (!employees || !Array.isArray(employees)) return [];
  const filtered = employees.filter(emp => {
    // Se for o colaborador que já é dono da escala sendo editada, mantém para não quebrar a edição
    if (currentEditingEmployeeId && emp.id === currentEditingEmployeeId) return true;
    return !isManagerProfile(emp);
  });
  // Fallback de segurança: se não houver colaboradores operacionais cadastrados, mantém lista original
  return filtered.length > 0 ? filtered : employees;
}
