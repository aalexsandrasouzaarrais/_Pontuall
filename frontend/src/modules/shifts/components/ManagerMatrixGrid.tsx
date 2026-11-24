import React, { useEffect, useState, useMemo } from 'react';
import { sanitizeCsvCell } from '@/shared/utils/security';
import { isUuid } from '@/modules/auth/services/colaboradorService';
import { Download, X } from 'lucide-react';
import { Employee, Shift, TimeOffRequest, AbsenceJustification } from '@/types';
import { supabase } from '@/shared/services/supabase';
import { EmployeesManagementView } from '@/modules/manager/components/EmployeesManagementView';
import { ManagerRemindersTab } from '@/modules/manager/components/ManagerRemindersTab';
import { ManagerChatTab } from '@/modules/chat/components/ManagerChatTab';
import { ShiftMatrixTab } from './ShiftMatrixTab';
import { ApprovalsTab } from '@/modules/requests/components/ApprovalsTab';
import { ApprovalItem } from '@/modules/requests/utils/approvalFilters';
import { AttendanceReportTab, AttendanceReportRow } from '@/modules/attendance/components/AttendanceReportTab';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { DeleteShiftsModal } from './DeleteShiftsModal';
import {
  addDaysLocal,
  toLocalDateString,
  getTodayDateString,
  formatDateBR,
  normalizeDateToISO,
  isShiftPast24hWithoutPunch,
  evaluatePunchTolerance,
  parseDateSortTimestamp,
} from '@/shared/utils/dateUtils';
import { resolveAttendanceReportStatusAndObs } from '@/shared/utils/attendanceUtils';
import { showPolishedToast } from '@/components/ui/halo-toast';
import { updateJustificativaStatusSupabase, updateSolicitacaoStatusSupabase } from '@/modules/requests/services/requestService';

interface ManagerMatrixGridProps {
  employees: Employee[];
  shifts: Shift[];
  pendingRequestsCount: number;
  onOpenCreateShift: (dateStr?: string, employeeId?: string) => void;
  onOpenEditShift: (shift: Shift) => void;
  onOpenRequests: () => void;
  onOpenPjModal: () => void;
  onExportCsv: (targetMonth?: string, targetDept?: string) => void;
  onAddEmployee: () => void;
  onSwitchToEmployee?: () => void;
  onOpenChat?: () => void;
  onOpenNotifications?: () => void;
  unreadChatCount?: number;
  onNavigateToOrbit?: () => void;
  activeTab?: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat' | 'colaboradores';
  theme?: 'light' | 'dark';
  activeEmployee?: Employee;
  isRh?: boolean;
  onUpdateEmployee?: (updated: Employee) => void;
  onDeactivateEmployee?: (employeeId: string) => void;
  onDeleteShift?: (id: string) => void;
  onDeleteShiftsBulk?: (ids: string[]) => void;
  justifications?: AbsenceJustification[];
  requests?: TimeOffRequest[];
  onApproveRequest?: (id: string, customFeedback?: string) => void;
  onRejectRequest?: (id: string, customFeedback?: string) => void;
  onApproveJustification?: (id: string, customFeedback?: string, silentToast?: boolean) => void | Promise<void>;
  onRejectJustification?: (id: string, customFeedback?: string, silentToast?: boolean) => void | Promise<void>;
}

export interface BancoHorasItem {
  id: string;
  shiftId?: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeDept: string;
  employeeAvatar: string;
  date: string;
  scheduledTime: string;
  punchTime: string;
  diffMinutes: number;
  diffBadge: string;
  type: 'hora_extra' | 'atraso' | 'esquecimento' | 'ausencia';
  typeLabel: string;
  reason: string;
  documentName?: string;
  documentUrl?: string;
  status: 'Pendente' | 'Homologado' | 'Ajustado' | 'Justificado';
  feedback: string;
}

export const formatDateToDDMMAAAA = (val?: string): string => {
  return formatDateBR(val);
};

/**
 * Orquestrador principal do painel de gestão do gestor em arquitetura DDD-lite,
 * delegando cada contexto delimitado (escalas, aprovações, frequência, lembretes, chat e equipe)
 * ao seu respectivo componente de domínio.
 */
export const ManagerMatrixGrid: React.FC<ManagerMatrixGridProps> = ({
  employees,
  shifts,
  pendingRequestsCount,
  onOpenCreateShift,
  onOpenEditShift,
  onOpenRequests: _onOpenRequests,
  onOpenPjModal: _onOpenPjModal,
  onExportCsv,
  onAddEmployee,
  onSwitchToEmployee: _onSwitchToEmployee,
  onOpenChat: _onOpenChat,
  onOpenNotifications: _onOpenNotifications,
  unreadChatCount,
  onNavigateToOrbit,
  activeTab: sidebarTab,
  theme = 'dark',
  activeEmployee,
  isRh: propsIsRh,
  onUpdateEmployee,
  onDeactivateEmployee,
  onDeleteShift,
  onDeleteShiftsBulk,
  justifications = [],
  requests = [],
  onApproveRequest,
  onRejectRequest,
  onApproveJustification,
  onRejectJustification,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat' | 'colaboradores'>(sidebarTab || 'aprovacoes');
  const activeTab = sidebarTab || internalActiveTab;
  const setActiveTab = setInternalActiveTab;
  const isDark = theme !== 'light';
  const isRh = propsIsRh || activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (sidebarTab) setInternalActiveTab(sidebarTab);
  }, [sidebarTab]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  const [approvalsData, setApprovalsData] = useState<ApprovalItem[]>([]);

  // Estados e cálculos para exportação mensal de presenças e aprovações
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalContext, setExportModalContext] = useState<'attendance' | 'approvals'>('attendance');
  const [exportReportFormat, setExportReportFormat] = useState<'detailed' | 'consolidated_employees_dept' | 'consolidated_dept'>('consolidated_employees_dept');
  const [selectedExportDept, setSelectedExportDept] = useState<string>('all');
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const availableExportMonths = useMemo(() => {
    const monthsMap = new Map<string, { label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const prevKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

    monthsMap.set(curKey, {
      label: `${monthNames[curMonth]}/${curYear} (Mês Atual)`,
      count: 0,
    });

    monthsMap.set(prevKey, {
      label: `${monthNames[prevMonth]}/${prevYear} (Mês Anterior)`,
      count: 0,
    });

    (shifts || []).forEach(s => {
      if (!s.date) return;
      const iso = normalizeDateToISO(s.date);
      const key = iso.substring(0, 7);
      if (monthsMap.has(key)) {
        monthsMap.get(key)!.count++;
      } else {
        const [y, m] = key.split('-').map(Number);
        if (y && m && m >= 1 && m <= 12) {
          monthsMap.set(key, {
            label: `${monthNames[m - 1]}/${y}`,
            count: 1,
          });
        }
      }
    });

    const list = Array.from(monthsMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count,
    }));

    list.push({
      key: 'all',
      label: 'Todo o Histórico Disponível (Últimos 60 dias)',
      count: shifts?.length || 0,
    });

    return list;
  }, [shifts]);

  const availableApprovalsExportMonths = useMemo(() => {
    const monthsMap = new Map<string, { label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const prevKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

    monthsMap.set(curKey, {
      label: `${monthNames[curMonth]}/${curYear} (Mês Atual)`,
      count: 0,
    });

    monthsMap.set(prevKey, {
      label: `${monthNames[prevMonth]}/${prevYear} (Mês Anterior)`,
      count: 0,
    });

    (approvalsData || []).forEach(item => {
      if (!item.date) return;
      const iso = normalizeDateToISO(item.date);
      const key = iso.substring(0, 7);
      if (monthsMap.has(key)) {
        monthsMap.get(key)!.count++;
      } else {
        const [y, m] = key.split('-').map(Number);
        if (y && m && m >= 1 && m <= 12) {
          monthsMap.set(key, {
            label: `${monthNames[m - 1]}/${y}`,
            count: 1,
          });
        }
      }
    });

    const list = Array.from(monthsMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count,
    }));

    list.push({
      key: 'all',
      label: 'Todo o Histórico Disponível',
      count: approvalsData?.length || 0,
    });

    return list;
  }, [approvalsData]);

  const handleOpenExportModal = (context: 'attendance' | 'approvals') => {
    setExportModalContext(context);
    const targetList = context === 'approvals' ? availableApprovalsExportMonths : availableExportMonths;
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (targetList.some(m => m.key === curKey)) {
      setSelectedExportMonth(curKey);
    } else if (targetList.length > 0) {
      setSelectedExportMonth(targetList[0].key);
    }
    setIsExportModalOpen(true);
  };

  useEffect(() => {
    const mappedJustifications: ApprovalItem[] = (justifications || []).map(j => {
      const emp = employees.find(e => e.id === j.employeeId);
      const rLower = (j.reason || '').toLowerCase();
      const isOvertimeJust = rLower.includes('hora extra') || (j as any).justificationType === 'overtime';
      const isForgetfulnessJust = rLower.includes('esquecimento') || rLower.includes('esqueci') || (j as any).justificationType === 'forgetfulness';
      const isEntryForgetfulness = isForgetfulnessJust && (rLower.includes('entrada') || (j as any).initialPunchType === 'entrada');
      const isExitForgetfulness = isForgetfulnessJust && !isEntryForgetfulness;
      const isEarlyLeaveJust = rLower.includes('saída antecipada') || rLower.includes('saida antecipada') || (j as any).justificationType === 'early_leave';
      const isEarlyEntryJust = rLower.includes('entrada antecipada') || (j as any).justificationType === 'early_entry';
      const isDelayJust = rLower.includes('atraso') || (j as any).justificationType === 'delay';
      const isAbsenceJust = (j as any).justificationType === 'absence' || rLower.includes('ausência') || rLower.includes('ausencia') || rLower.includes('falta');
      const resolvedShiftId = j.shiftId || (shifts || []).find(s => s.employeeId === j.employeeId && s.date === j.date)?.id;
      const typeLabel = isOvertimeJust
        ? 'Hora Extra'
        : isEntryForgetfulness
          ? 'Esquecimento de Entrada'
          : isExitForgetfulness
            ? 'Esquecimento de Saída'
            : isEarlyLeaveJust
              ? 'Saída Antecipada'
              : isEarlyEntryJust
                ? 'Entrada Antecipada'
                : isDelayJust
                  ? 'Atraso de Entrada'
                  : isAbsenceJust
                    ? (j.status === 'approved' ? 'Falta Justificada' : 'Justificativa de Ausência')
                    : 'Atestado Médico';
      const parsedDiff = (j as any).delayMinutes || (j.reason?.match(/(\d+)\s*min/)?.[1] ? Number(j.reason?.match(/(\d+)\s*min/)?.[1]) : undefined);
      const hasDocUrl = Boolean(j.documentUrl && j.documentUrl.trim() !== '' && j.documentUrl !== 'null' && j.documentUrl !== 'undefined');
      return {
        id: j.id,
        shiftId: resolvedShiftId,
        employeeId: j.employeeId,
        employeeName: emp?.name || j.employeeName || 'Colaborador',
        employeeRole: emp?.role || 'Colaborador',
        employeeDept: emp?.department || 'Geral',
        employeeAvatar: emp?.avatar || j.employeeAvatar || '',
        type: typeLabel,
        diffMinutes: parsedDiff,
        reason: j.reason,
        date: j.date,
        documentName: hasDocUrl ? (j.documentName || 'Comprovante.pdf') : undefined,
        documentUrl: hasDocUrl ? j.documentUrl : undefined,
        status: (j.status === 'approved' ? 'Aprovado' : j.status === 'rejected' ? 'Recusado / Falta' : 'Pendente') as ApprovalItem['status'],
        actionText: j.status === 'approved' ? 'Homologado' : j.status === 'rejected' ? 'Não homologado' : undefined,
        feedback: j.managerNotes || '',
      };
    });

    const mappedRequests: ApprovalItem[] = (requests || []).map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const targetEmp = employees.find(e => e.id === r.targetEmployeeId);
      const peerBadge = r.peerStatus === 'accepted' ? 'Acordo aceito pelo colega' : r.peerStatus === 'rejected' ? 'Recusado pelo colega' : 'Aguardando aceite do colega';
      const formattedReason = r.type === 'swap' && (r.targetEmployeeName || targetEmp?.name)
        ? `${r.reason} (Com: ${r.targetEmployeeName || targetEmp?.name} • ${peerBadge})`
        : r.reason;

      const typeLabel = r.type === 'swap'
        ? 'Troca de Turno'
        : r.type === 'time_off'
        ? 'Folga / Dispensa'
        : 'Alteração de Escala';

      return {
        id: r.id,
        employeeId: r.employeeId,
        employeeName: emp?.name || r.employeeName || 'Colaborador',
        employeeRole: emp?.role || 'Colaborador',
        employeeDept: emp?.department || 'Geral',
        employeeAvatar: emp?.avatar || r.employeeAvatar || '',
        type: typeLabel,
        reason: formattedReason,
        date: r.date,
        documentName: 'Não se aplica',
        documentUrl: undefined,
        status: (r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Recusado / Falta' : 'Pendente') as ApprovalItem['status'],
        actionText: r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Recusado' : undefined,
        feedback: r.managerNotes || '',
      };
    });

    // Mapeamento de Faltas Não Justificadas e Faltas Justificadas
    const mappedAbsences: ApprovalItem[] = (shifts || []).filter(s => {
      const isPast24h = isShiftPast24hWithoutPunch(s) || s.attendanceStatus === 'absent';
      const hasJustification = (justifications || []).some(j =>
        (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
      );
      if (hasJustification) return false;

      const isJustified = s.attendanceStatus === 'justified';
      return (isPast24h && !s.checkInTime) || isJustified;
    }).map(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const isJustified = s.attendanceStatus === 'justified' || s.notes?.includes('ABONO GESTOR') || s.notes?.includes('Ausência Justificada');

      const matchingReq = (requests || []).find(r =>
        r.employeeId === s.employeeId && r.date === s.date
      );

      const cleanNotes = (s.notes || '')
        .replace(/\[ABONO GESTOR:[^\]]*\]/gi, '')
        .replace(/\[HOMOLOGADO GESTOR:[^\]]*\]/gi, '')
        .replace(/\[FALTA GESTOR:[^\]]*\]/gi, '')
        .trim();

      const reason = cleanNotes
        || matchingReq?.reason
        || (isJustified
          ? 'Ausência abonada pelo gestor.'
          : 'Colaborador escalado não registrou ponto de entrada/saída após 24h e não apresentou atestado/justificativa.');

      return {
        id: `absence-${s.id}`,
        shiftId: s.id,
        employeeId: s.employeeId,
        employeeName: emp?.name || 'Colaborador',
        employeeRole: emp?.role || 'Colaborador',
        employeeDept: emp?.department || 'Geral',
        employeeAvatar: emp?.avatar || '',
        type: isJustified ? 'Falta Justificada' : 'Falta Não Justificada',
        reason,
        date: s.date,
        documentName: 'Sem anexo',
        documentUrl: undefined,
        status: (isJustified ? 'Aprovado' : 'Pendente') as ApprovalItem['status'],
        actionText: isJustified ? 'Abonada' : undefined,
        feedback: isJustified ? 'Ausência abonada pelo gestor' : '',
      };
    });

    // Ocorrências de Atraso, Antecipação e Horas Extras apuradas imediatamente pelas batidas e notas para a Central Única de Aprovações
    const mappedDelaysAndOvertimeFromShifts: ApprovalItem[] = (shifts || []).flatMap(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const results: ApprovalItem[] = [];

      const findJustForKind = (kind: 'delay' | 'early_entry' | 'early_leave' | 'overtime') =>
        (justifications || []).find(j => {
          const matchesShift = (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date);
          if (!matchesShift) return false;
          const rLower = (j.reason || '').toLowerCase();
          const jType = (j as any).justificationType;
          if (kind === 'early_entry') return rLower.includes('entrada antecipada') || jType === 'early_entry';
          if (kind === 'early_leave') return rLower.includes('saída antecipada') || rLower.includes('saida antecipada') || jType === 'early_leave';
          if (kind === 'delay') return rLower.includes('atraso') || jType === 'delay' || (rLower.includes('esquecimento') && rLower.includes('entrada'));
          if (kind === 'overtime') return rLower.includes('hora extra') || jType === 'overtime' || (rLower.includes('esquecimento') && !rLower.includes('entrada'));
          return false;
        });

      // 1. Avaliar Entrada (Atraso, Entrada Antecipada ou Esquecimento)
      const inTol = (s.startTime && s.checkInTime)
        ? evaluatePunchTolerance(s.startTime, s.checkInTime, 'entrada', 10)
        : null;
      const hasLate = Boolean(s.notes?.includes('[Atraso')) || s.attendanceStatus === 'late' || Boolean(inTol?.isLate);
      const hasEarlyEntry = !hasLate && (Boolean(s.notes?.includes('[Entrada Antecipada')) || Boolean(inTol?.isEarly));
      const isForgetfulnessEntry = Boolean(s.notes?.includes('Esquecimento de Entrada'));

      if (hasLate || hasEarlyEntry || isForgetfulnessEntry) {
        const entryKind = hasLate ? 'delay' : 'early_entry';
        const existingJust = findJustForKind(entryKind);
        if (!existingJust) {
          const lateMatch = s.notes?.match(/\[Atraso (\d+)m/);
          const earlyMatch = s.notes?.match(/\[Entrada Antecipada (\d+)m/);
          const diffMins = hasLate
            ? (lateMatch ? Number(lateMatch[1]) : (inTol?.isLate ? inTol.diffMinutes : 0))
            : (earlyMatch ? Number(earlyMatch[1]) : (inTol?.isEarly ? inTol.diffMinutes : 0));

          const isHomologated = Boolean(
            (isForgetfulnessEntry && (s.notes?.includes('Esquecimento de Entrada Homologado') || (s.notes?.includes('Esquecimento Homologado') && !s.notes?.includes('Esquecimento de Saída') && !s.notes?.includes('Esquecimento de Saida')))) ||
            (hasLate && s.notes?.includes('[ABONO GESTOR: Atraso')) ||
            (hasEarlyEntry && s.notes?.includes('[ABONO GESTOR: Entrada Antecipada')) ||
            s.attendanceStatus === 'justified'
          );
          const isAdjusted = Boolean(
            (isForgetfulnessEntry && (s.notes?.includes('Esquecimento de Entrada Não Aceito') || (s.notes?.includes('Esquecimento Não Aceito') && !s.notes?.includes('Esquecimento de Saída') && !s.notes?.includes('Esquecimento de Saida')))) ||
            (hasLate && s.notes?.includes('Débito de Atraso Confirmado')) ||
            (hasEarlyEntry && s.notes?.includes('Entrada Antecipada Não Homologada'))
          );

          results.push({
            id: `shift-occ-in-${s.id}`,
            shiftId: s.id,
            employeeId: s.employeeId,
            employeeName: emp?.name || 'Colaborador',
            employeeRole: emp?.role || 'Colaborador',
            employeeDept: emp?.department || 'Geral',
            employeeAvatar: emp?.avatar || '',
            type: isForgetfulnessEntry ? 'Esquecimento de Entrada' : hasLate ? 'Atraso de Entrada' : 'Entrada Antecipada',
            diffMinutes: diffMins,
            reason: isForgetfulnessEntry
              ? `Entrada registrada às ${s.checkInTime || '--:--'} (previsto ${s.startTime})${diffMins ? ` • +${diffMins} min após início` : ''} — Esquecimento de batida declarado.`
              : hasLate
                ? `Entrada às ${s.checkInTime || '--:--'} (previsto ${s.startTime})${diffMins ? ` • +${diffMins} min de atraso` : ''} — aguardando justificativa ou decisão do gestor.`
                : `Entrada às ${s.checkInTime || '--:--'} (previsto ${s.startTime})${diffMins ? ` • ${diffMins} min antes do horário` : ''} — aguardando justificativa ou decisão do gestor.`,
            date: s.date,
            documentName: 'Sem anexo',
            documentUrl: undefined,
            status: isHomologated ? 'Aprovado' : isAdjusted ? 'Recusado / Falta' : 'Pendente',
            actionText: isHomologated ? 'Abonado' : isAdjusted ? 'Debitado' : undefined,
            feedback: '',
          });
        }
      }

      // 2. Avaliar Saída (Hora Extra, Saída Antecipada ou Esquecimento)
      const outTol = (s.endTime && s.checkOutTime)
        ? evaluatePunchTolerance(s.endTime, s.checkOutTime, 'saida', 10)
        : null;
      const hasHe = Boolean(s.notes?.includes('[HE')) || Boolean(outTol?.isOvertime);
      const hasEarlyLeave = !hasHe && (Boolean(s.notes?.includes('[Saída Antecipada') || s.notes?.includes('[Saida Antecipada')) || Boolean(outTol?.isEarlyLeave));
      const isForgetfulnessExit = Boolean(
        s.notes?.includes('Esquecimento de Saída') ||
        s.notes?.includes('Esquecimento de Saida') ||
        (s.notes?.includes('Justificativa Esquecimento') && !s.notes?.includes('Esquecimento de Entrada'))
      );

      if (hasHe || hasEarlyLeave || isForgetfulnessExit) {
        const exitKind = hasEarlyLeave ? 'early_leave' : 'overtime';
        const existingJust = findJustForKind(exitKind);
        if (!existingJust) {
          const heMatch = s.notes?.match(/\[HE \+(\d+)m/);
          const earlyLeaveMatch = s.notes?.match(/\[Sa[íi]da Antecipada (\d+)m/);
          const diffMins = hasHe
            ? (heMatch ? Number(heMatch[1]) : (outTol?.isOvertime ? outTol.diffMinutes : 0))
            : (earlyLeaveMatch ? Number(earlyLeaveMatch[1]) : (outTol?.isEarlyLeave ? outTol.diffMinutes : 0));

          const isHomologated = Boolean(
            (hasHe && s.notes?.includes('[HOMOLOGADO GESTOR: Hora Extra')) ||
            (isForgetfulnessExit && (s.notes?.includes('Esquecimento de Saída Homologado') || (s.notes?.includes('Esquecimento Homologado') && !s.notes?.includes('Esquecimento de Entrada')))) ||
            (hasEarlyLeave && s.notes?.includes('[ABONO GESTOR: Saída Antecipada'))
          );
          const isAdjusted = Boolean(
            (hasHe && (s.notes?.includes('[AJUSTE GESTOR: Ajustado') || s.notes?.includes('Hora Extra Não Homologada'))) ||
            (isForgetfulnessExit && (s.notes?.includes('Esquecimento de Saída Não Aceito') || (s.notes?.includes('Esquecimento Não Aceito') && !s.notes?.includes('Esquecimento de Entrada')))) ||
            (hasEarlyLeave && s.notes?.includes('Saída Antecipada Não Abonada'))
          );

          results.push({
            id: `shift-occ-out-${s.id}`,
            shiftId: s.id,
            employeeId: s.employeeId,
            employeeName: emp?.name || 'Colaborador',
            employeeRole: emp?.role || 'Colaborador',
            employeeDept: emp?.department || 'Geral',
            employeeAvatar: emp?.avatar || '',
            type: hasEarlyLeave ? 'Saída Antecipada' : isForgetfulnessExit ? 'Esquecimento de Saída' : 'Hora Extra',
            diffMinutes: diffMins,
            reason: hasEarlyLeave
              ? `Saída às ${s.checkOutTime || '--:--'} (previsto ${s.endTime})${diffMins ? ` • -${diffMins} min antes do término` : ''} — aguardando justificativa ou decisão do gestor.`
              : isForgetfulnessExit
                ? `Saída registrada às ${s.checkOutTime || '--:--'} (previsto ${s.endTime})${diffMins ? ` • +${diffMins} min após o término` : ''} — Esquecimento de batida declarado.`
                : `Saída às ${s.checkOutTime || '--:--'} (previsto ${s.endTime})${diffMins ? ` • +${diffMins} min após o término` : ''}.`,
            date: s.date,
            documentName: 'Sem anexo',
            documentUrl: undefined,
            status: isHomologated ? 'Aprovado' : isAdjusted ? 'Recusado / Falta' : 'Pendente',
            actionText: isHomologated ? (hasEarlyLeave ? 'Abonado' : 'Homologado') : isAdjusted ? (hasEarlyLeave ? 'Debitado' : 'Ajustado') : undefined,
            feedback: '',
          });
        }
      }

      return results;
    });

    // Central Unificada de Aprovações (Aba 2):
    // Reúne apenas ocorrências reais dos colaboradores vinculados a esta empresa/gestor
    const allApprovals: ApprovalItem[] = [
      ...mappedAbsences,
      ...mappedDelaysAndOvertimeFromShifts,
      ...mappedJustifications.map(j => ({
        ...j,
        type: j.type === 'Justificativa de Atraso' ? 'Atraso de Entrada' : j.type,
      })),
      ...mappedRequests,
    ].sort((a, b) => {
      const timeA = parseDateSortTimestamp(a.date);
      const timeB = parseDateSortTimestamp(b.date);
      return timeB - timeA;
    });

    setApprovalsData(allApprovals);
  }, [employees, justifications, requests, shifts]);

  // Ações de Homologação / Aprovação para Atestados, Faltas, Atrasos e Horas Extras (Central de Aprovações)
  const handleApproveOccurrence = async (id: string) => {
    const targetItem = approvalsData.find(i => i.id === id);
    const isFalta = targetItem?.type === 'Falta Não Justificada' || id.startsWith('absence-');
    const isEarlyEntry = targetItem?.type === 'Entrada Antecipada';
    const isEarlyLeave = targetItem?.type === 'Saída Antecipada';
    const isAtraso = targetItem?.type === 'Atraso de Entrada' || targetItem?.type === 'Justificativa de Atraso' || isEarlyEntry || isEarlyLeave;
    const isHe = targetItem?.type === 'Hora Extra';
    const customFeedback = targetItem?.feedback?.trim() || undefined;

    const actionText = isFalta ? 'Abonada' : isAtraso ? 'Abonado' : isHe ? 'Homologado' : 'Homologado agora';

    setApprovalsData(prev => prev.map(item => item.id === id ? {
      ...item,
      type: isFalta ? 'Falta Justificada' : item.type,
      status: 'Aprovado',
      actionText,
    } : item));

    if (isFalta) {
      const shiftId = targetItem?.shiftId || id.replace('absence-', '');
      const targetShift = shifts.find(s => s.id === shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          attendanceStatus: 'justified',
          notes: `${targetShift.notes || ''} [ABONO GESTOR: Ausência Justificada / Abonada em Folha]`,
        });
      }
      showPolishedToast({
        id: 'abono-falta-success',
        title: 'Falta Abonada com Sucesso!',
        description: 'A ausência foi abonada pelo gestor e não gerará desconto na folha de pagamento.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    if (isAtraso) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);

      const abonoTag = isEarlyLeave
        ? '[ABONO GESTOR: Saída Antecipada Abonada]'
        : isEarlyEntry
          ? '[ABONO GESTOR: Entrada Antecipada Abonada]'
          : '[ABONO GESTOR: Atraso Abonado]';

      if (matchingJust) {
        if (onApproveJustification) {
          await onApproveJustification(matchingJust.id, customFeedback || 'Ocorrência abonada pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'approved', customFeedback || 'Ocorrência abonada pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} ${abonoTag}`,
          });
        }
      }
      showPolishedToast({
        id: 'abono-atraso-success',
        title: isEarlyLeave ? 'Saída Antecipada Abonada!' : isEarlyEntry ? 'Entrada Antecipada Abonada!' : 'Atraso Abonado com Sucesso!',
        description: 'A ocorrência foi abonada pelo gestor com base no comprovante e não gerará débito.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    const isForgetfulness = Boolean(targetItem?.type?.includes('Esquecimento'));
    if (isForgetfulness) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);
      if (matchingJust) {
        // Persiste a homologação na justificativa (Supabase) — o handler do App também anota o turno
        if (onApproveJustification) {
          await onApproveJustification(matchingJust.id, customFeedback || 'Esquecimento homologado pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'approved', customFeedback || 'Esquecimento homologado pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          const dirTag = targetItem?.type === 'Esquecimento de Entrada'
            ? '[HOMOLOGADO GESTOR: Esquecimento de Entrada Homologado / Horário Normal Ajustado]'
            : '[HOMOLOGADO GESTOR: Esquecimento de Saída Homologado / Horário Normal Ajustado]';
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} ${dirTag}`,
          });
        }
      }
      showPolishedToast({
        id: 'homologar-esquecimento-success',
        title: 'Esquecimento Homologado!',
        description: 'O registro foi ajustado para o horário normal da escala, sem gerar débito ou hora extra indevida.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    if (isHe) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);
      if (matchingJust) {
        if (onApproveJustification) {
          await onApproveJustification(matchingJust.id, customFeedback || 'Hora extra homologada pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'approved', customFeedback || 'Hora extra homologada pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [HOMOLOGADO GESTOR: Hora Extra Aprovada]`,
          });
        }
      }
      showPolishedToast({
        id: 'homologar-he-success',
        title: 'Hora Extra Homologada!',
        description: 'As horas extras foram aprovadas e lançadas com sucesso para crédito no Banco de Horas / Folha.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    const isRequest = requests.some(r => r.id === id);
    if (isRequest) {
      if (onApproveRequest) {
        onApproveRequest(id, customFeedback);
      } else {
        await updateSolicitacaoStatusSupabase(id, 'approved', customFeedback || 'Aprovado pelo gestor');
      }
    } else if (onApproveJustification) {
      await onApproveJustification(id, customFeedback, true);
    } else {
      await updateJustificativaStatusSupabase(id, 'approved', customFeedback || 'Homologado pelo gestor');
    }

    showPolishedToast({
      id: 'approval-success',
      title: 'Solicitação Homologada',
      description: 'O pedido do colaborador foi aprovado e lançado no espelho com sucesso.',
      rimVariant: 'success',
      duration: 3500,
    });
  };

  const handleRejectOccurrence = async (id: string) => {
    const targetItem = approvalsData.find(i => i.id === id);
    const isFalta = targetItem?.type === 'Falta Não Justificada' || id.startsWith('absence-');
    const isEarlyEntry = targetItem?.type === 'Entrada Antecipada';
    const isEarlyLeave = targetItem?.type === 'Saída Antecipada';
    const isAtraso = targetItem?.type === 'Atraso de Entrada' || targetItem?.type === 'Justificativa de Atraso' || isEarlyEntry || isEarlyLeave;
    const isHe = targetItem?.type === 'Hora Extra';
    const customFeedback = targetItem?.feedback?.trim() || undefined;

    const actionText = isFalta ? 'Desconto em Folha' : isAtraso ? 'Debitado' : isHe ? 'Ajustado' : 'Recusado agora';

    setApprovalsData(prev => prev.map(item => item.id === id ? {
      ...item,
      status: 'Recusado / Falta',
      actionText,
    } : item));

    if (isFalta) {
      const shiftId = targetItem?.shiftId || id.replace('absence-', '');
      const targetShift = shifts.find(s => s.id === shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          attendanceStatus: 'absent',
          notes: `${targetShift.notes || ''} [CONFIRMADA FALTA: Lançado desconto de 1 dia + DSR]`,
        });
      }
      showPolishedToast({
        id: 'desconto-falta-confirm',
        title: 'Desconto de Falta Confirmado',
        description: 'A ausência não justificada foi confirmada para desconto na folha (1 dia + DSR semanal).',
        rimVariant: 'destructive',
        duration: 4000,
      });
      return;
    }

    if (isAtraso) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);

      const rejectTag = isEarlyLeave
        ? '[AJUSTE GESTOR: Saída Antecipada Não Abonada]'
        : isEarlyEntry
          ? '[AJUSTE GESTOR: Entrada Antecipada Não Homologada]'
          : '[AJUSTE GESTOR: Débito de Atraso Confirmado]';

      if (matchingJust) {
        if (onRejectJustification) {
          await onRejectJustification(matchingJust.id, customFeedback || 'Ocorrência não abonada pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'rejected', customFeedback || 'Ocorrência não abonada pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} ${rejectTag}`,
          });
        }
      }
      showPolishedToast({
        id: 'debito-atraso-confirm',
        title: isEarlyLeave ? 'Saída Antecipada Não Abonada' : isEarlyEntry ? 'Entrada Antecipada Não Homologada' : 'Débito de Atraso Confirmado',
        description: 'Os minutos foram confirmados para registro/compensação no Banco de Horas.',
        rimVariant: 'default',
        duration: 4000,
      });
      return;
    }

    const isForgetfulness = Boolean(targetItem?.type?.includes('Esquecimento'));
    if (isForgetfulness) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);
      if (matchingJust) {
        if (onRejectJustification) {
          await onRejectJustification(matchingJust.id, customFeedback || 'Esquecimento não aceito pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'rejected', customFeedback || 'Esquecimento não aceito pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          const dirTag = targetItem?.type === 'Esquecimento de Entrada'
            ? '[AJUSTE GESTOR: Esquecimento de Entrada Não Aceito]'
            : '[AJUSTE GESTOR: Esquecimento de Saída Não Aceito]';
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} ${dirTag}`,
          });
        }
      }
      showPolishedToast({
        id: 'ajuste-esquecimento-confirm',
        title: 'Esquecimento Não Aceito',
        description: 'A justificativa de esquecimento foi ajustada pelo gestor.',
        rimVariant: 'default',
        duration: 4000,
      });
      return;
    }

    if (isHe) {
      const shiftId = targetItem?.shiftId || (id.startsWith('shift-occ-') ? id.replace(/^shift-occ-(?:in-|out-)?/, '') : undefined);
      const matchingJust = id.startsWith('shift-occ-') ? undefined : justifications.find(j => j.id === id);
      if (matchingJust) {
        if (onRejectJustification) {
          await onRejectJustification(matchingJust.id, customFeedback || 'Hora extra não homologada pelo gestor', true);
        } else {
          await updateJustificativaStatusSupabase(matchingJust.id, 'rejected', customFeedback || 'Hora extra não homologada pelo gestor');
        }
      } else if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [AJUSTE GESTOR: Ajustado p/ Horário Normal]`,
          });
        }
      }
      showPolishedToast({
        id: 'ajuste-he-confirm',
        title: 'Hora Extra Ajustada',
        description: 'Registro tratado para a jornada contratual (Art. 4º § 2º CLT - Sem HE indevida).',
        rimVariant: 'default',
        duration: 4000,
      });
      return;
    }

    const isRequest = requests.some(r => r.id === id);
    if (isRequest) {
      if (onRejectRequest) {
        onRejectRequest(id, customFeedback);
      } else {
        await updateSolicitacaoStatusSupabase(id, 'rejected', customFeedback || 'Recusado pelo gestor');
      }
    } else if (onRejectJustification) {
      await onRejectJustification(id, customFeedback, true);
    } else {
      await updateJustificativaStatusSupabase(id, 'rejected', customFeedback || 'Recusado pelo gestor');
    }

    showPolishedToast({
      id: 'approval-rejected',
      title: 'Solicitação Recusada',
      description: 'A solicitação foi recusada e o colaborador foi notificado.',
      rimVariant: 'success',
      duration: 3500,
    });
  };

  const getEmployeeMatricula = (empId?: string, empName?: string): string => {
    const found = employees.find(
      e => (empId && e.id === empId) || (empName && e.name.toLowerCase() === empName.toLowerCase())
    );
    if (found?.registrationId) return found.registrationId;
    if (empId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(empId)) return empId;
    return '—';
  };

  const handleExportApprovalsCsv = (rowsToExport: ApprovalItem[], targetMonth?: string) => {
    if (!rowsToExport || rowsToExport.length === 0) {
      showPolishedToast({
        id: 'csv-approvals-export-empty',
        title: 'Nenhum registro para exportar',
        description: 'Não foram encontradas ocorrências para o período selecionado.',
        rimVariant: 'default',
        duration: 3500,
      });
      return;
    }

    const headers = [
      'Colaborador',
      'Matrícula',
      'Departamento',
      'Cargo',
      'Data da Ocorrência',
      'Tipo de Ocorrência',
      'Motivo / Detalhes da Solicitação',
      'Comprovante / Atestado Anexado',
      'Status',
      'Ação Realizada',
      'Observação / Feedback do Gestor',
    ];

    const escapeCsv = sanitizeCsvCell;

    const rows = rowsToExport.map(row => {
      let statusFormatted: string = row.status || 'Pendente';
      if (row.status === 'Recusado / Falta') {
        statusFormatted = 'Recusado / Descontado';
      }

      let dateFormatted = row.date;
      if (row.date && row.date.includes('-')) {
        const parts = row.date.split('-');
        if (parts.length === 3) {
          dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      return [
        escapeCsv(row.employeeName),
        escapeCsv(getEmployeeMatricula(row.employeeId, row.employeeName)),
        escapeCsv(row.employeeDept),
        escapeCsv(row.employeeRole),
        `="${dateFormatted}"`,
        escapeCsv(row.type),
        escapeCsv(row.reason),
        escapeCsv(row.documentName || 'Sem anexo'),
        escapeCsv(statusFormatted),
        escapeCsv(row.actionText || (row.status === 'Pendente' ? 'Aguardando decisão' : 'Processado')),
        escapeCsv(row.feedback || '—'),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const monthSuffix = targetMonth && targetMonth !== 'all' ? targetMonth : getTodayDateString();
    link.download = `relatorio-aprovacoes-e-faltas-${monthSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showPolishedToast({
      id: 'csv-approvals-export',
      title: 'Planilha exportada com sucesso!',
      description: `${rowsToExport.length} ocorrência(s) baixada(s) em CSV com sucesso.`,
      rimVariant: 'success',
      duration: 4000,
    });
  };

  const handleUpdateFeedback = async (id: string, feedback: string) => {
    setApprovalsData(prev => prev.map(item => item.id === id ? { ...item, feedback } : item));
    const target = approvalsData.find(i => i.id === id);
    if (target) {
      const isRequest = requests.some(r => r.id === id);
      const dbStatus = target.status === 'Aprovado' ? 'approved' : target.status === 'Pendente' ? 'pending' : 'rejected';
      if (isRequest) {
        await updateSolicitacaoStatusSupabase(id, dbStatus as any, feedback);
      } else {
        await updateJustificativaStatusSupabase(id, dbStatus as any, feedback);
      }
    }
  };

  // Calcula se existem presenças próximas do limite de 60 dias (idade entre 50 e 60 dias)
  const expiringAttendanceInfo = useMemo(() => {
    if (!shifts || shifts.length === 0) return null;
    const now = new Date();
    const cutoff60 = toLocalDateString(addDaysLocal(now, -60));
    const cutoff50 = toLocalDateString(addDaysLocal(now, -50));

    let minDaysRemaining = 60;
    let countExpiringSoon = 0;

    for (const s of shifts) {
      if (!s.date) continue;
      const iso = normalizeDateToISO(s.date);
      if (iso < cutoff60) continue;
      if (iso <= cutoff50) {
        countExpiringSoon++;
        const parts = iso.split('-');
        if (parts.length === 3) {
          const shiftDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const ageDays = Math.floor((now.getTime() - shiftDate.getTime()) / (1000 * 60 * 60 * 24));
          const daysLeft = Math.max(1, 60 - ageDays);
          if (daysLeft < minDaysRemaining) {
            minDaysRemaining = daysLeft;
          }
        }
      }
    }

    if (countExpiringSoon === 0) return null;
    return {
      count: countExpiringSoon,
      daysLeft: minDaysRemaining,
    };
  }, [shifts]);

  // Sincronização em tempo real das batidas de entrada e saída (TAB_Registro_Ponto)
  const [livePunches, setLivePunches] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const employeeIds = Array.from(new Set(employees.map(e => e.id).filter(isUuid)));

    const fetchLivePunches = async () => {
      if (employeeIds.length === 0) {
        if (mounted) setLivePunches([]);
        return;
      }

      try {
        const { data } = await supabase
          .from('TAB_Registro_Ponto')
          .select('*')
          .in('Idf_Colaborador', employeeIds)
          .order('Dta_Hora_Registro', { ascending: true });
        if (mounted && data) {
          setLivePunches(data);
        }
      } catch {}
    };

    fetchLivePunches();
    const timer = setInterval(fetchLivePunches, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [activeTab, employees]);

  const reportRows = useMemo<AttendanceReportRow[]>(() => {
    if (shifts && shifts.length > 0) {
      const cutoff60 = toLocalDateString(addDaysLocal(new Date(), -60));
      return shifts
        .filter(s => !s.date || normalizeDateToISO(s.date) >= cutoff60)
        .map(rawShift => {
          // Mescla batidas ao vivo do banco caso o estado local ainda não tenha recebido a saída
          let s = rawShift;
          if (livePunches.length > 0 && (!s.checkInTime || !s.checkOutTime)) {
            const matching = livePunches.filter(p => {
              if (p.Idf_Turno) return p.Idf_Turno === s.id;
              if (p.Idf_Colaborador === s.employeeId && p.Dta_Hora_Registro) {
                const dt = new Date(p.Dta_Hora_Registro);
                const localIso = !isNaN(dt.getTime()) ? toLocalDateString(dt) : p.Dta_Hora_Registro.slice(0, 10);
                return localIso === normalizeDateToISO(s.date);
              }
              return false;
            });
            if (matching.length > 0) {
              const inRec = matching.find(p => p.Tpo_Registro?.toLowerCase() === 'entrada') || matching[0];
              const outRec = [...matching].reverse().find(p => p.Tpo_Registro?.toLowerCase() === 'saida');
              const fmtTime = (rec: any) => {
                const dt = new Date(rec.Dta_Hora_Registro);
                if (isNaN(dt.getTime())) return undefined;
                return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
              };
              s = {
                ...s,
                checkInTime: s.checkInTime || (inRec ? fmtTime(inRec) : undefined),
                checkOutTime: s.checkOutTime || (outRec && outRec !== inRec ? fmtTime(outRec) : undefined),
              };
            }
          }

          const emp = employees.find(e => e.id === s.employeeId);
          const hasRealExit = Boolean(s.checkOutTime);

          // GPS fora do posto detectado de forma discreta
          const isCheckInOutside = Boolean(s.checkInLocation && !s.checkInLocation.gpsValidated);
          const isCheckOutOutside = Boolean(s.checkOutLocation && !s.checkOutLocation.gpsValidated && hasRealExit);
          const isGpsOutside = isCheckInOutside || isCheckOutOutside;

          let gpsDist = '';
          if (isCheckInOutside && s.checkInLocation?.distanceMeters !== undefined) {
            gpsDist = s.checkInLocation.distanceMeters >= 1000
              ? `${(s.checkInLocation.distanceMeters / 1000).toFixed(1)} km`
              : `${Math.round(s.checkInLocation.distanceMeters)} m`;
          } else if (isCheckOutOutside && s.checkOutLocation?.distanceMeters !== undefined) {
            gpsDist = s.checkOutLocation.distanceMeters >= 1000
              ? `${(s.checkOutLocation.distanceMeters / 1000).toFixed(1)} km`
              : `${Math.round(s.checkOutLocation.distanceMeters)} m`;
          }

          let scheduledMin = 0;
          let scheduledHoursFormatted = '—';
          if (s.startTime && s.endTime) {
            const [sInH, sInM] = s.startTime.split(':').map(Number);
            const [sOutH, sOutM] = s.endTime.split(':').map(Number);
            let diff = (sOutH * 60 + sOutM) - (sInH * 60 + sInM);
            if (diff < 0) diff += 24 * 60;
            if (s.breakMinutes) diff = Math.max(0, diff - s.breakMinutes);
            scheduledMin = diff;
            const sH = Math.floor(diff / 60);
            const sM = diff % 60;
            scheduledHoursFormatted = `${sH}h${sM > 0 ? ` ${sM}m` : ''}`;
          }

          let workedMin = 0;
          let calculatedHours = '—';
          if (s.checkInTime && hasRealExit) {
            const [inH, inM] = s.checkInTime.split(':').map(Number);
            const [outH, outM] = s.checkOutTime!.split(':').map(Number);
            let diffMin = (outH * 60 + outM) - (inH * 60 + inM);
            if (diffMin < 0) diffMin += 24 * 60;
            if (s.breakMinutes && diffMin > s.breakMinutes + 60) {
              diffMin = Math.max(0, diffMin - s.breakMinutes);
            }
            workedMin = diffMin;
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            calculatedHours = diffMin === 0 ? '< 1m' : `${h}h${m > 0 ? ` ${m}m` : ''}`;
          } else if (s.checkInTime && !hasRealExit) {
            calculatedHours = 'Em andamento';
          } else if (!s.checkInTime) {
            calculatedHours = '0h';
          }

          let apuracaoSaldo = 'Regular';
          let apuracaoKind: AttendanceReportRow['apuracaoKind'] = 'regular';

          if (!s.checkInTime) {
            apuracaoSaldo = 'Falta (0h)';
            apuracaoKind = 'falta';
          } else if (!hasRealExit) {
            apuracaoSaldo = 'Em andamento';
            apuracaoKind = 'pending';
          } else if (scheduledMin > 0) {
            const balance = workedMin - scheduledMin;
            // CLT Art. 58 § 1º: tolerância geral de até 10 minutos no dia
            if (balance > 10) {
              const extraH = Math.floor(balance / 60);
              const extraM = balance % 60;
              apuracaoSaldo = `Hora Extra (+${extraH > 0 ? `${extraH}h ` : ''}${extraM}m)`;
              apuracaoKind = 'overtime';
            } else if (balance < -10) {
              const absBal = Math.abs(balance);
              const defH = Math.floor(absBal / 60);
              const defM = absBal % 60;
              apuracaoSaldo = `Déficit (-${defH > 0 ? `${defH}h ` : ''}${defM}m)`;
              apuracaoKind = 'deficit';
            } else {
              apuracaoSaldo = 'Regular (No horário)';
              apuracaoKind = 'regular';
            }
          } else {
            apuracaoSaldo = 'Trabalhado';
            apuracaoKind = 'regular';
          }

          const scheduledShift = (s.startTime && s.endTime)
            ? `${s.startTime} às ${s.endTime}${scheduledHoursFormatted !== '—' ? ` (${scheduledHoursFormatted})` : ''}`
            : 'Sem escala definida';

          const punchReal = s.checkInTime
            ? `${s.checkInTime}${hasRealExit ? ` → ${s.checkOutTime}` : ' (Em andamento)'}`
            : 'Sem registro';

          const isPast24h = isShiftPast24hWithoutPunch(s);
          const shiftJusts = (justifications || []).filter(j =>
            (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
          );
          const {
            status: finalReportStatus,
            isDecisionPending,
            cleanObs,
          } = resolveAttendanceReportStatusAndObs({
            hasWorkedPunch: Boolean(s.checkInTime) || Boolean(s.checkOutTime),
            attendanceStatus: s.attendanceStatus,
            notes: s.notes,
            isPast24h,
            justifications: shiftJusts,
          });

          const obsParts: string[] = [];
          if (isGpsOutside) {
            obsParts.push(`Fora do Posto ${gpsDist ? `(${gpsDist})` : ''}`);
          }
          if (cleanObs) {
            obsParts.push(cleanObs);
          }
          const obsFull = obsParts.join(' • ') || '—';

          return {
            date: s.date,
            avatar: emp?.avatar || '',
            name: emp?.name || 'Colaborador',
            role: emp?.role || 'Colaborador',
            dept: emp?.department || 'Geral',
            scheduledShift,
            punchReal,
            time: s.checkInTime
              ? `${s.checkInTime}${hasRealExit ? ` → ${s.checkOutTime}` : ' (Entrada)'}`
              : `${s.startTime} – ${s.endTime}`,
            hours: calculatedHours,
            status: finalReportStatus,
            isDecisionPending,
            type: apuracaoSaldo,
            apuracao: apuracaoSaldo,
            apuracaoKind,
            checkInLocation: s.checkInLocation,
            checkOutLocation: s.checkOutLocation,
            isGpsOutside,
            gpsDist,
            cleanObs: cleanObs || '—',
            obsFull,
            obs: obsFull,
          };
        });
    }

    return [];
  }, [shifts, employees, justifications, livePunches]);

  // Consolidação por Departamento: Presença, Assiduidade, Absenteísmo e Horas Trabalhadas (Fechamento Contábil & Folha)
  const departmentConsolidatedRows = useMemo(() => {
    const deptSet = new Set<string>();
    employees.forEach(e => {
      if (e.department) deptSet.add(e.department);
    });
    shifts.forEach(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      if (emp?.department) deptSet.add(emp.department);
    });
    if (deptSet.size === 0) {
      ['Atendimento', 'Suporte Técnico', 'Operações', 'Comercial'].forEach(d => deptSet.add(d));
    }

    return Array.from(deptSet).map(deptName => {
      const deptEmployees = employees.filter(e => (e.department || 'Geral') === deptName);
      const deptShifts = reportRows.filter(r => r.dept === deptName);

      const totalShifts = deptShifts.length;
      const presentCount = deptShifts.filter(r => r.status === 'Presente').length;
      const lateCount = deptShifts.filter(r => r.status === 'Atrasado').length;
      const justifiedCount = deptShifts.filter(r => r.status === 'Justificado').length;
      const absentCount = deptShifts.filter(r => r.status === 'Ausente').length;

      const effectivePresent = presentCount + lateCount + justifiedCount;
      const evaluatedTotal = effectivePresent + absentCount;

      const assiduidadePct = evaluatedTotal > 0
        ? Math.round((effectivePresent / evaluatedTotal) * 1000) / 10
        : 100;
      const absenteismoPct = evaluatedTotal > 0
        ? Math.round((absentCount / evaluatedTotal) * 1000) / 10
        : 0;

      // Soma de horas trabalhadas e previstas no departamento
      let workedMinutes = 0;
      let scheduledMinutes = 0;
      shifts.forEach(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        const empDept = emp?.department || 'Geral';
        if (empDept !== deptName) return;

        if (s.startTime && s.endTime) {
          const [sH, sM] = s.startTime.split(':').map(Number);
          const [eH, eM] = s.endTime.split(':').map(Number);
          let dur = (eH * 60 + eM) - (sH * 60 + sM) - (s.breakMinutes ?? 60);
          if (dur < 0) dur += 24 * 60;
          if (!isNaN(dur) && dur > 0) scheduledMinutes += dur;
        }

        const hasRealExit = Boolean(s.checkOutTime);
        if (s.checkInTime && hasRealExit) {
          const [inH, inM] = s.checkInTime.split(':').map(Number);
          const [outH, outM] = s.checkOutTime!.split(':').map(Number);
          let diff = (outH * 60 + outM) - (inH * 60 + inM) - (s.breakMinutes ?? 60);
          if (diff < 0) diff += 24 * 60;
          if (!isNaN(diff) && diff > 0) workedMinutes += diff;
        } else if (s.attendanceStatus === 'present' || s.attendanceStatus === 'late' || s.attendanceStatus === 'justified') {
          if (s.startTime && s.endTime) {
            const [sH, sM] = s.startTime.split(':').map(Number);
            const [eH, eM] = s.endTime.split(':').map(Number);
            let dur = (eH * 60 + eM) - (sH * 60 + sM) - (s.breakMinutes ?? 60);
            if (dur < 0) dur += 24 * 60;
            if (!isNaN(dur) && dur > 0) workedMinutes += dur;
          }
        }
      });

      const formatMinToHHMM = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}h${m > 0 ? ` ${String(m).padStart(2, '0')}m` : ''}`;
      };

      const workedDecimal = (workedMinutes / 60).toFixed(2).replace('.', ',');
      const scheduledDecimal = (scheduledMinutes / 60).toFixed(2).replace('.', ',');
      const balanceMinutes = workedMinutes - scheduledMinutes;
      const balanceDecimal = (balanceMinutes / 60).toFixed(2).replace('.', ',');

      return {
        dept: deptName,
        employeesCount: deptEmployees.length,
        totalShifts,
        presentCount,
        lateCount,
        justifiedCount,
        absentCount,
        assiduidadePct,
        absenteismoPct,
        scheduledFormatted: formatMinToHHMM(scheduledMinutes),
        workedFormatted: formatMinToHHMM(workedMinutes),
        scheduledDecimal,
        workedDecimal,
        balanceDecimal,
        workedMinutes,
        scheduledMinutes,
      };
    });
  }, [employees, reportRows, shifts]);

  const handleExportConsolidatedDepartmentCsv = (
    targetMonth?: string,
    targetDept: string = 'all',
    mode: 'consolidated_employees_dept' | 'consolidated_dept' = 'consolidated_employees_dept'
  ) => {
    const escapeCsv = sanitizeCsvCell;
    const formatMinToHHMM = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h${m > 0 ? ` ${String(m).padStart(2, '0')}m` : ''}`;
    };

    const deptSlug = targetDept && targetDept !== 'all'
      ? `-${targetDept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}`
      : '-geral';
    const suffix = (targetMonth && targetMonth !== 'all' ? targetMonth : getTodayDateString()) + deptSlug;

    if (mode === 'consolidated_dept') {
      const headers = [
        'Departamento / Centro de Custo',
        'Colaboradores Ativos',
        'Turnos Escalados',
        'Presenças no Posto',
        'Entradas com Atraso',
        'Faltas Justificadas / Abonadas',
        'Faltas Injustificadas (Desconto)',
        'Taxa de Assiduidade (%)',
        'Taxa de Absenteísmo (%)',
        'Horas Contratuais Previstas (HH:MM)',
        'Horas Previstas Decimal (Contábil)',
        'Horas Trabalhadas Apuradas (HH:MM)',
        'Horas Trabalhadas Decimal (p/ Folha)',
        'Saldo Líquido Decimal (Banco / Folha)',
        'Situação Contábil / Fechamento',
      ];

      const filteredDepts = targetDept && targetDept !== 'all'
        ? departmentConsolidatedRows.filter(d => d.dept === targetDept)
        : departmentConsolidatedRows;

      const rows = filteredDepts.map(d => [
        escapeCsv(d.dept),
        d.employeesCount,
        d.totalShifts,
        d.presentCount,
        d.lateCount,
        d.justifiedCount,
        d.absentCount,
        escapeCsv(`${d.assiduidadePct.toFixed(1).replace('.', ',')}%`),
        escapeCsv(`${d.absenteismoPct.toFixed(1).replace('.', ',')}%`),
        escapeCsv(d.scheduledFormatted),
        escapeCsv(d.scheduledDecimal),
        escapeCsv(d.workedFormatted),
        escapeCsv(d.workedDecimal),
        escapeCsv(d.balanceDecimal),
        escapeCsv(d.absentCount === 0 ? 'Regular — Pronto p/ Folha' : `Atenção: ${d.absentCount} falta(s) apurada(s)`),
      ].join(';'));

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-consolidado-departamentos-${suffix}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      showPolishedToast({
        id: 'csv-consolidated-dept-export',
        title: 'Planilha por Departamento Exportada!',
        description: 'Resumo consolidado por setor gerado com sucesso para fechamento contábil e de folha.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    // Modo 'consolidated_employees_dept': Lista todos os funcionários do setor selecionado (ou de todos os setores) com presença, assiduidade, absenteísmo e horas trabalhadas
    const targetEmployees = (targetDept && targetDept !== 'all'
      ? employees.filter(e => (e.department || 'Geral') === targetDept)
      : [...employees]
    ).sort((a, b) => (a.department || '').localeCompare(b.department || '', 'pt-BR') || (a.name || '').localeCompare(b.name || '', 'pt-BR'));

    const headers = [
      'Departamento / Setor',
      'Colaborador',
      'Matrícula',
      'Cargo / Função',
      'Regime Contratual',
      'Turnos no Período',
      'Presenças no Posto',
      'Entradas com Atraso',
      'Faltas Justificadas / Abonadas',
      'Faltas Injustificadas (Desconto)',
      'Taxa de Assiduidade (%)',
      'Taxa de Absenteísmo (%)',
      'Horas Previstas (HH:MM)',
      'Horas Previstas Decimal',
      'Horas Trabalhadas (HH:MM)',
      'Horas Trabalhadas Decimal (p/ Folha)',
      'Saldo Líquido Decimal (Banco / Folha)',
      'Situação para Fechamento de Folha',
    ];

    const empRows = targetEmployees.map(emp => {
      const empShifts = shifts.filter(s => {
        if (s.employeeId !== emp.id) return false;
        if (targetMonth && targetMonth !== 'all' && s.date) {
          return normalizeDateToISO(s.date).startsWith(targetMonth);
        }
        return true;
      });

      let presentCount = 0;
      let lateCount = 0;
      let justifiedCount = 0;
      let absentCount = 0;
      let scheduledMinutes = 0;
      let workedMinutes = 0;

      empShifts.forEach(s => {
        const just = (justifications || []).find(
          j => (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
        );
        const isPast24h = isShiftPast24hWithoutPunch(s);

        if (just?.status === 'approved' || s.attendanceStatus === 'justified') {
          justifiedCount++;
        } else if (s.attendanceStatus === 'late') {
          lateCount++;
        } else if (s.attendanceStatus === 'present' || Boolean(s.checkInTime)) {
          presentCount++;
        } else if (s.attendanceStatus === 'absent' || just?.status === 'rejected' || isPast24h) {
          absentCount++;
        }

        if (s.startTime && s.endTime) {
          const [sH, sM] = s.startTime.split(':').map(Number);
          const [eH, eM] = s.endTime.split(':').map(Number);
          let dur = (eH * 60 + eM) - (sH * 60 + sM) - (s.breakMinutes ?? 60);
          if (dur < 0) dur += 24 * 60;
          if (!isNaN(dur) && dur > 0) scheduledMinutes += dur;
        }

        const hasRealExit = Boolean(s.checkOutTime);
        if (s.checkInTime && hasRealExit) {
          const [inH, inM] = s.checkInTime.split(':').map(Number);
          const [outH, outM] = s.checkOutTime!.split(':').map(Number);
          let diff = (outH * 60 + outM) - (inH * 60 + inM) - (s.breakMinutes ?? 60);
          if (diff < 0) diff += 24 * 60;
          if (!isNaN(diff) && diff > 0) workedMinutes += diff;
        } else if (s.attendanceStatus === 'present' || s.attendanceStatus === 'late' || s.attendanceStatus === 'justified') {
          if (s.startTime && s.endTime) {
            const [sH, sM] = s.startTime.split(':').map(Number);
            const [eH, eM] = s.endTime.split(':').map(Number);
            let dur = (eH * 60 + eM) - (sH * 60 + sM) - (s.breakMinutes ?? 60);
            if (dur < 0) dur += 24 * 60;
            if (!isNaN(dur) && dur > 0) workedMinutes += dur;
          }
        }
      });

      const effectivePresent = presentCount + lateCount + justifiedCount;
      const evaluatedTotal = effectivePresent + absentCount;
      const assiduidadePct = evaluatedTotal > 0 ? Math.round((effectivePresent / evaluatedTotal) * 1000) / 10 : 100;
      const absenteismoPct = evaluatedTotal > 0 ? Math.round((absentCount / evaluatedTotal) * 1000) / 10 : 0;

      const scheduledDecimal = (scheduledMinutes / 60).toFixed(2).replace('.', ',');
      const workedDecimal = (workedMinutes / 60).toFixed(2).replace('.', ',');
      const balanceDecimal = ((workedMinutes - scheduledMinutes) / 60).toFixed(2).replace('.', ',');

      return [
        escapeCsv(emp.department || 'Geral'),
        escapeCsv(emp.name),
        escapeCsv(emp.registrationId || getEmployeeMatricula(emp.id, emp.name)),
        escapeCsv(emp.role || 'Colaborador'),
        escapeCsv(emp.contractType || 'CLT'),
        empShifts.length,
        presentCount,
        lateCount,
        justifiedCount,
        absentCount,
        escapeCsv(`${assiduidadePct.toFixed(1).replace('.', ',')}%`),
        escapeCsv(`${absenteismoPct.toFixed(1).replace('.', ',')}%`),
        escapeCsv(formatMinToHHMM(scheduledMinutes)),
        escapeCsv(scheduledDecimal),
        escapeCsv(formatMinToHHMM(workedMinutes)),
        escapeCsv(workedDecimal),
        escapeCsv(balanceDecimal),
        escapeCsv(absentCount === 0 ? 'Regular — Pronto p/ Folha' : `Desconto / Revisão: ${absentCount} falta(s)`),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...empRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-consolidado-colaboradores-${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showPolishedToast({
      id: 'csv-consolidated-emp-dept-export',
      title: 'Relatório Consolidado Exportado!',
      description: targetDept && targetDept !== 'all'
        ? `Planilha com todos os funcionários do setor "${targetDept}" (presença, assiduidade, absenteísmo e horas) baixada com sucesso.`
        : 'Planilha consolidada de todos os funcionários por setor baixada com sucesso.',
      rimVariant: 'success',
      duration: 4000,
    });
  };

  const isOrbitStyledTab = activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios' || activeTab === 'chat' || activeTab === 'colaboradores';

  return (
    <div className={`w-full font-sans space-y-4 select-none manager-scope ${theme} ${
      isOrbitStyledTab
        ? 'bg-transparent text-slate-100 p-0 border-0 shadow-none'
        : 'bg-[#f8fafc] text-slate-900 rounded-3xl p-3 sm:p-5 shadow-2xl border border-slate-200'
    }`}>
      {/* TAB 1: GRADE DE ESCALAS */}
      {activeTab === 'escala' && (
        <ShiftMatrixTab
          employees={employees}
          shifts={shifts}
          departments={departments}
          isDark={isDark}
          isRh={isRh}
          activeEmployee={activeEmployee}
          pendingRequestsCount={pendingRequestsCount}
          unreadChatCount={unreadChatCount}
          onOpenCreateShift={onOpenCreateShift}
          onOpenEditShift={onOpenEditShift}
          onNavigateToOrbit={onNavigateToOrbit}
          onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
          onSelectTab={setActiveTab}
        />
      )}

      {/* TAB 2: CENTRAL DE APROVAÇÕES & FALTAS */}
      {activeTab === 'aprovacoes' && (
        <ApprovalsTab
          approvalsData={approvalsData}
          reportRows={reportRows}
          departments={departments}
          employees={employees}
          isDark={isDark}
          isRh={isRh}
          onApproveOccurrence={handleApproveOccurrence}
          onRejectOccurrence={handleRejectOccurrence}
          onUpdateFeedback={handleUpdateFeedback}
          onAddOccurrence={(item) => setApprovalsData(prev => [item, ...prev])}
          onOpenExportApprovals={() => handleOpenExportModal('approvals')}
        />
      )}

      {/* TAB 3: RELATÓRIO DE PRESENÇAS */}
      {activeTab === 'relatorios' && (
        <AttendanceReportTab
          employees={employees}
          shifts={shifts}
          reportRows={reportRows}
          departments={departments}
          expiringAttendanceInfo={expiringAttendanceInfo}
          isDark={isDark}
          onOpenExportAttendance={() => handleOpenExportModal('attendance')}
          onExportCsv={onExportCsv}
        />
      )}

      {/* TAB 4: LEMBRETES & TAREFAS */}
      {activeTab === 'tarefas' && (
        <ManagerRemindersTab
          employees={employees}
          activeEmployee={activeEmployee}
          isDark={isDark}
        />
      )}

      {/* TAB 5: CHAT EQUIPE */}
      {activeTab === 'chat' && (
        <ManagerChatTab
          employees={employees}
          activeEmployee={activeEmployee}
          isDark={isDark}
          isRh={isRh}
        />
      )}

      {/* TAB 6: GESTÃO DA EQUIPE & COLABORADORES */}
      {activeTab === 'colaboradores' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar Gestão de Colaboradores">
          <EmployeesManagementView
            employees={employees}
            activeEmployee={activeEmployee}
            onAddEmployee={onAddEmployee}
            onUpdateEmployee={onUpdateEmployee || (() => {})}
            onDeactivateEmployee={onDeactivateEmployee || (() => {})}
          />
        </ErrorBoundary>
      )}

      {/* Modal de Seleção de Mês para Exportação da Folha CSV (Presenças ou Aprovações) */}
      {isExportModalOpen && (() => {
        const activeMonths = exportModalContext === 'approvals'
          ? availableApprovalsExportMonths
          : availableExportMonths;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-5 transition-all ${
              isDark ? 'bg-[#15161b] border-[#282a33] text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-bold">Exportar Folha Mensal</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {exportModalContext === 'approvals'
                      ? 'Selecione o mês de competência para gerar a planilha consolidada de aprovações e faltas.'
                      : 'Selecione o mês de competência para gerar a planilha consolidada de presenças.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Mês de Competência
                </label>
                <select
                  value={selectedExportMonth}
                  onChange={(e) => setSelectedExportMonth(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#0e0f12] border-[#282a33] text-white focus:border-[#F59242]'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#9F243C]'
                  }`}
                >
                  {activeMonths.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count} {m.count === 1 ? 'registro' : 'registros'})
                    </option>
                  ))}
                </select>

                <div className="space-y-1.5 pt-1">
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Departamento / Setor
                  </label>
                  <select
                    value={selectedExportDept}
                    onChange={(e) => setSelectedExportDept(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-colors ${
                      isDark
                        ? 'bg-[#0e0f12] border-[#282a33] text-white focus:border-[#F59242]'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#9F243C]'
                    }`}
                  >
                    <option value="all">Todos os Departamentos (Geral da Empresa)</option>
                    {departmentConsolidatedRows.map(d => (
                      <option key={d.dept} value={d.dept}>
                        {d.dept} ({d.employeesCount} {d.employeesCount === 1 ? 'funcionário' : 'funcionários'})
                      </option>
                    ))}
                  </select>
                </div>

                {exportModalContext === 'attendance' && (
                  <div className="space-y-1.5 pt-1">
                    <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Modelo de Relatório (CSV)
                    </label>
                    <select
                      value={exportReportFormat}
                      onChange={(e) => setExportReportFormat(e.target.value as 'detailed' | 'consolidated_employees_dept' | 'consolidated_dept')}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-colors ${
                        isDark
                          ? 'bg-[#0e0f12] border-[#282a33] text-white focus:border-[#F59242]'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#9F243C]'
                      }`}
                    >
                      <option value="consolidated_employees_dept">
                        Consolidado de Funcionários por Setor (Presença, Assiduidade, Absenteísmo e Horas p/ Folha)
                      </option>
                      <option value="consolidated_dept">
                        Resumo Geral por Departamento (Totais Contábeis do Setor)
                      </option>
                      <option value="detailed">
                        Espelho de Ponto Detalhado (Turnos e Batidas Diárias)
                      </option>
                    </select>
                  </div>
                )}

                <div className={`p-3 rounded-xl border text-xs ${
                  isDark ? 'bg-black/20 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="flex items-center justify-between font-medium">
                    <span>
                      {exportModalContext === 'attendance' && exportReportFormat === 'consolidated_employees_dept'
                        ? (selectedExportDept === 'all' ? 'Funcionários incluídos (Todos os setores):' : `Funcionários do setor ${selectedExportDept}:`)
                        : exportModalContext === 'attendance' && exportReportFormat === 'consolidated_dept'
                        ? 'Departamentos consolidados:'
                        : 'Registros a exportar:'}
                    </span>
                    <span className="font-bold text-amber-500">
                      {exportModalContext === 'attendance' && exportReportFormat === 'consolidated_employees_dept'
                        ? (selectedExportDept === 'all'
                            ? employees.length
                            : employees.filter(e => (e.department || 'Geral') === selectedExportDept).length)
                        : exportModalContext === 'attendance' && exportReportFormat === 'consolidated_dept'
                        ? (selectedExportDept === 'all' ? departmentConsolidatedRows.length : 1)
                        : (activeMonths.find(m => m.key === selectedExportMonth)?.count || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (exportModalContext === 'approvals') {
                      const monthFiltered = selectedExportMonth === 'all'
                        ? approvalsData
                        : approvalsData.filter(row => row.date && normalizeDateToISO(row.date).startsWith(selectedExportMonth));
                      const rowsToExport = selectedExportDept === 'all'
                        ? monthFiltered
                        : monthFiltered.filter(row => (row.employeeDept || 'Geral') === selectedExportDept);

                      handleExportApprovalsCsv(rowsToExport, selectedExportMonth);
                      setIsExportModalOpen(false);
                    } else if (exportReportFormat === 'consolidated_employees_dept' || exportReportFormat === 'consolidated_dept') {
                      handleExportConsolidatedDepartmentCsv(selectedExportMonth, selectedExportDept, exportReportFormat);
                      setIsExportModalOpen(false);
                    } else {
                      onExportCsv(selectedExportMonth, selectedExportDept);
                      setIsExportModalOpen(false);
                      showPolishedToast({
                        title: 'Planilha exportada com sucesso!',
                        description: 'O arquivo CSV mensal foi baixado no padrão brasileiro.',
                        rimVariant: 'success',
                      });
                    }
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  style={{ background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Planilha (CSV)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Exclusão de Escalas em Lote / Filtro */}
      <DeleteShiftsModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        shifts={shifts}
        employees={employees}
        onDeleteShifts={(shiftIds) => {
          if (onDeleteShiftsBulk) {
            onDeleteShiftsBulk(shiftIds);
          } else if (onDeleteShift) {
            shiftIds.forEach(id => onDeleteShift(id));
          }
        }}
        theme={theme}
      />
    </div>
  );
};
