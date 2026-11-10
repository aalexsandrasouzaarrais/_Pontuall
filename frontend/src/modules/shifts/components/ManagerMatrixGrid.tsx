import React, { useEffect, useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileText, 
  Zap, 
  Bell, 
  Download, 
  Plus, 
  Video, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckSquare,
  CalendarDays,
  Send,
  UserCheck,
  Building2,
  Clock,
  ArrowRightLeft,
  ExternalLink,
  Trash2,
  Calendar,
  Tag,
  Filter,
  X,
  Paperclip,
  Users,
  User,
  Check,
  Edit2,
  Layers,
  Eye,
  Maximize2,
  Lock,
  Hash,
  Briefcase,
  MapPin,
  Image as ImageIcon
} from 'lucide-react';
import { Employee, Shift, TimeOffRequest, AbsenceJustification } from '@/types';
import { supabase } from '@/shared/services/supabase';
import { DEFAULT_TEAM_CHANNELS, ChatChannelItem, ChatMessage } from '@/modules/chat/components/ChatModal';
import { 
  ChatAttachment, 
  compressImageFile, 
  parseChatMessage, 
  serializeChatMessage,
  sendChatMessageToSupabase,
  getScopedChatChannel,
  getScopedDirectChannel,
  getDisplayChatChannel
} from '@/shared/utils/chatUtils';
import { EmployeesManagementView } from '@/modules/manager/components/EmployeesManagementView';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { DeleteShiftsModal } from './DeleteShiftsModal';
import { addDaysLocal, startOfWeekMonday, toLocalDateString, getTodayDateString, formatDateBR, normalizeDateToISO, isShiftPast24hWithoutPunch } from '@/shared/utils/dateUtils';
import { showPolishedToast } from '@/components/ui/halo-toast';
import {
  ReminderItem,
  getRemindersSupabase,
  createReminderSupabase,
  updateReminderSupabase,
  toggleCompletedSupabase,
  deleteReminderSupabase
} from '@/modules/shifts/services/reminderService';
import { updateJustificativaStatusSupabase, updateSolicitacaoStatusSupabase } from '@/modules/requests/services/requestService';
import { openDocumentSafe } from '@/shared/services/storageService';
import { createNotificationSupabase } from '@/modules/notifications/services/notificationService';

interface ManagerMatrixGridProps {
  employees: Employee[];
  shifts: Shift[];
  pendingRequestsCount: number;
  onOpenCreateShift: (dateStr?: string, employeeId?: string) => void;
  onOpenEditShift: (shift: Shift) => void;
  onOpenRequests: () => void;
  onOpenPjModal: () => void;
  onExportCsv: (targetMonth?: string) => void;
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
  onApproveJustification?: (id: string, customFeedback?: string) => void;
  onRejectJustification?: (id: string, customFeedback?: string) => void;
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

export const ManagerMatrixGrid: React.FC<ManagerMatrixGridProps> = ({
  employees,
  shifts,
  pendingRequestsCount,
  onOpenCreateShift,
  onOpenEditShift,
  onOpenRequests,
  onOpenPjModal,
  onExportCsv,
  onAddEmployee,
  onSwitchToEmployee,
  onOpenChat,
  onOpenNotifications,
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
  // Active top tab state: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat' | 'colaboradores'
  const [internalActiveTab, setInternalActiveTab] = useState<'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat' | 'colaboradores'>(sidebarTab || 'aprovacoes');
  const activeTab = sidebarTab || internalActiveTab;
  const setActiveTab = setInternalActiveTab;
  const isDark = theme !== 'light';
  const isRh = propsIsRh || activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (sidebarTab) setInternalActiveTab(sidebarTab);
  }, [sidebarTab]);
  
  // Tab 1 (Escala) States
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(27);
  const [isDraftPublished, setIsDraftPublished] = useState<boolean>(false);

  // Tab 2 (Aprovações & Faltas) - Atestados, Folgas e Trocas
  const [approvalsFilterTab, setApprovalsFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approvalsSearch, setApprovalsSearch] = useState('');
  const [approvalsDept, setApprovalsDept] = useState('all');
  const [approvalsTypeFilter, setApprovalsTypeFilter] = useState<'all' | 'swap' | 'medical' | 'delay' | 'overtime' | 'absent' | 'justified' | 'time_off'>('all');
  const [isNewOccurrenceModalOpen, setIsNewOccurrenceModalOpen] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [selectedDetailOccurrence, setSelectedDetailOccurrence] = useState<{
    id: string;
    employeeId?: string;
    employeeName: string;
    employeeRole: string;
    employeeDept: string;
    employeeAvatar: string;
    type: string;
    reason: string;
    date: string;
    documentName: string;
    documentUrl?: string;
    status: 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente';
    actionText?: string;
    feedback: string;
  } | null>(null);

  const toggleExpandReason = (id: string) => {
    setExpandedReasons(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  const [newOccurrenceForm, setNewOccurrenceForm] = useState({
    employeeId: 'emp-1',
    type: 'Atestado Médico',
    date: new Date().toLocaleDateString('pt-BR'),
    reason: '',
    documentName: 'atestado.pdf',
    status: 'Pendente' as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
    feedback: '',
  });

  const [approvalsData, setApprovalsData] = useState<Array<{
    id: string;
    employeeId?: string;
    employeeName: string;
    employeeRole: string;
    employeeDept: string;
    employeeAvatar: string;
    type: string;
    reason: string;
    date: string;
    documentName: string;
    documentUrl?: string;
    status: 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente';
    actionText?: string;
    feedback: string;
  }>>([]);

  // Tab 3 (Relatórios) & Banco de Horas States
  const [relatorioSubTab, setRelatorioSubTab] = useState<'geral' | 'banco_horas'>('geral');
  const [bancoHorasData, setBancoHorasData] = useState<BancoHorasItem[]>([]);
  const [bancoHorasSearch, setBancoHorasSearch] = useState('');
  const [bancoHorasDate, setBancoHorasDate] = useState('');
  const [bancoHorasDept, setBancoHorasDept] = useState('all');
  const [bancoHorasStatus, setBancoHorasStatus] = useState<'all' | 'pending' | 'homologated' | 'adjusted'>('all');
  const [selectedDetailBancoItem, setSelectedDetailBancoItem] = useState<BancoHorasItem | null>(null);
  const [expandedBancoReasons, setExpandedBancoReasons] = useState<Record<string, boolean>>({});

  const toggleExpandBancoReason = (id: string) => {
    setExpandedBancoReasons(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Estados e cálculos para exportação mensal de presenças e aprovações
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalContext, setExportModalContext] = useState<'attendance' | 'approvals'>('attendance');
  const [selectedExportMonth, setSelectedExportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const availableExportMonths = useMemo(() => {
    const monthsMap = new Map<string, { label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
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
      count: 0
    });

    monthsMap.set(prevKey, {
      label: `${monthNames[prevMonth]}/${prevYear} (Mês Anterior)`,
      count: 0
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
            count: 1
          });
        }
      }
    });

    const list = Array.from(monthsMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count
    }));

    list.push({
      key: 'all',
      label: 'Todo o Histórico Disponível (Últimos 60 dias)',
      count: shifts?.length || 0
    });

    return list;
  }, [shifts]);

  const availableApprovalsExportMonths = useMemo(() => {
    const monthsMap = new Map<string, { label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
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
      count: 0
    });

    monthsMap.set(prevKey, {
      label: `${monthNames[prevMonth]}/${prevYear} (Mês Anterior)`,
      count: 0
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
            count: 1
          });
        }
      }
    });

    const list = Array.from(monthsMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      count: val.count
    }));

    list.push({
      key: 'all',
      label: 'Todo o Histórico Disponível',
      count: approvalsData?.length || 0
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

  // Identifica se estamos perto do final do mês (dia >= 25) ou no início (dias 1 a 3)
  const monthClosingInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    if (day < 25 && day > 3) return null;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const targetDate = day <= 3 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
    const targetMonthName = monthNames[targetDate.getMonth()];
    const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      isStartOfNextMonth: day <= 3,
      monthName: targetMonthName,
      monthKey: targetKey
    };
  }, []);

  // Estado para dismiss do aviso sutil de retenção de presenças
  const [isRetentionNoticeDismissed, setIsRetentionNoticeDismissed] = useState<boolean>(() => {
    try {
      const dismissedUntil = localStorage.getItem('pontuall_retention_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return true;
      }
    } catch {
      // Ignora erro de acesso a localStorage
    }
    return false;
  });

  const handleDismissRetentionNotice = () => {
    setIsRetentionNoticeDismissed(true);
    try {
      localStorage.setItem('pontuall_retention_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // Ignora erro de acesso a localStorage
    }
  };

  useEffect(() => {
    const today = getTodayDateString();
    const emp1 = employees[0] || {
      id: 'emp-1',
      name: 'Alexsandra Arrais',
      role: 'Analista de Operações',
      department: 'Operações',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    };
    const emp2 = employees[1] || emp1;
    const emp3 = employees[2] || emp1;

    const mappedJustifications = (justifications || []).map(j => {
      const emp = employees.find(e => e.id === j.employeeId);
      const isDelayJust = j.reason?.toLowerCase().includes('atraso') || (j as any).justificationType === 'delay';
      return {
        id: j.id,
        employeeId: j.employeeId,
        employeeName: emp?.name || j.employeeName || 'Colaborador',
        employeeRole: emp?.role || 'Colaborador',
        employeeDept: emp?.department || 'Geral',
        employeeAvatar: emp?.avatar || j.employeeAvatar || '',
        type: isDelayJust ? 'Justificativa de Atraso' : 'Atestado Médico',
        reason: j.reason,
        date: j.date,
        documentName: j.documentName || (isDelayJust ? 'Declaracao_Comparecimento_Horas.pdf' : 'atestado.pdf'),
        documentUrl: j.documentUrl,
        status: (j.status === 'approved' ? 'Aprovado' : j.status === 'rejected' ? 'Recusado / Falta' : 'Pendente') as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
        actionText: j.status === 'approved' ? 'Homologado' : j.status === 'rejected' ? 'Não homologado' : undefined,
        feedback: j.managerNotes || '',
      };
    });

    const mappedRequests = (requests || []).map(r => {
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
        status: (r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Recusado / Falta' : 'Pendente') as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
        actionText: r.status === 'approved' ? 'Aprovado' : r.status === 'rejected' ? 'Recusado' : undefined,
        feedback: r.managerNotes || '',
      };
    });

    // Mapeamento de Faltas Não Justificadas e Faltas Justificadas
    const mappedAbsences = (shifts || []).filter(s => {
      const isPast24h = isShiftPast24hWithoutPunch(s) || s.attendanceStatus === 'absent';
      const hasJustification = (justifications || []).some(j => 
        (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
      );
      const isJustified = s.attendanceStatus === 'justified';
      return (isPast24h && !s.checkInTime && !hasJustification) || isJustified;
    }).map(s => {
      const emp = employees.find(e => e.id === s.employeeId);
      const isJustified = s.attendanceStatus === 'justified' || s.notes?.includes('ABONO GESTOR') || s.notes?.includes('Ausência Justificada');
      return {
        id: `absence-${s.id}`,
        shiftId: s.id,
        employeeId: s.employeeId,
        employeeName: emp?.name || 'Colaborador',
        employeeRole: emp?.role || 'Colaborador',
        employeeDept: emp?.department || 'Geral',
        employeeAvatar: emp?.avatar || '',
        type: isJustified ? 'Falta Justificada' : 'Falta Não Justificada',
        reason: isJustified ? 'Ausência abonada com justificativa ou atestado médico aceito.' : 'Colaborador escalado não registrou ponto de entrada/saída após 24h e não apresentou atestado/justificativa.',
        date: s.date,
        documentName: isJustified ? 'Declaracao_ou_Atestado.pdf' : 'Sem anexo',
        documentUrl: undefined,
        status: (isJustified ? 'Aprovado' : 'Pendente') as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
        actionText: isJustified ? 'Abonada' : undefined,
        feedback: isJustified ? 'Ausência abonada pelo gestor' : '',
      };
    });

    const demoAbsenceItem = mappedAbsences.filter(a => a.type === 'Falta Não Justificada').length > 0 ? [] : [{
      id: 'demo-absence-1',
      employeeId: emp2.id,
      employeeName: emp2.name || 'Carlos Silveira',
      employeeRole: emp2.role || 'Supervisor',
      employeeDept: emp2.department || 'Logística',
      employeeAvatar: emp2.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      type: 'Falta Não Justificada',
      reason: 'Colaborador escalado não registrou ponto na escala e não apresentou atestado médico.',
      date: today,
      documentName: 'Sem anexo',
      documentUrl: undefined,
      status: 'Pendente' as const,
      feedback: '',
    }];

    const demoJustifiedItem = [{
      id: 'demo-justified-1',
      employeeId: emp3.id,
      employeeName: emp3.name || 'Mariana Rios',
      employeeRole: emp3.role || 'Assistente de DP',
      employeeDept: emp3.department || 'RH',
      employeeAvatar: emp3.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      type: 'Falta Justificada',
      reason: 'Ausência abonada com declaração / atestado médico apresentado dentro do prazo.',
      date: today,
      documentName: 'Atestado_Medico_Homologado.pdf',
      documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      status: 'Aprovado' as const,
      actionText: 'Abonada',
      feedback: 'Atestado válido homologado pelo gestor.',
    }];

    // Ocorrências de Atraso e Horas Extras apuradas para a Central Única de Aprovações
    const mappedDelaysAndOvertimeFromShifts = (shifts || []).filter(s => {
      const hasHe = s.notes && s.notes.includes('[HE');
      const hasLate = (s.notes && s.notes.includes('[Atraso')) || s.attendanceStatus === 'late';
      return hasHe || hasLate;
    }).map(s => {
      const emp = employees.find(e => e.id === s.employeeId) || emp1;
      const isHe = Boolean(s.notes?.includes('[HE'));
      const isLate = (Boolean(s.notes?.includes('[Atraso')) || s.attendanceStatus === 'late') && !isHe;
      
      const type = isLate ? 'Atraso de Entrada' : 'Hora Extra';
      let diffStr = '';
      if (isLate) {
        const lateMatch = s.notes?.match(/\[Atraso (\d+)m/);
        diffStr = lateMatch ? ` (-${lateMatch[1]} min)` : ' (-35 min)';
      } else {
        const heMatch = s.notes?.match(/\[HE \+(\d+)m/);
        diffStr = heMatch ? ` (+${heMatch[1]} min)` : ' (+39 min)';
      }

      const shiftJust = (justifications || []).find(j => 
        (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
      );

      const isHomologated = s.notes?.includes('HOMOLOGADO') || shiftJust?.status === 'approved';
      const isAdjusted = s.notes?.includes('AJUSTE GESTOR') || shiftJust?.status === 'rejected';

      const statusVal = isHomologated ? 'Aprovado' : isAdjusted ? 'Recusado / Falta' : 'Pendente';
      const actionText = isHomologated 
        ? (isLate ? 'Abonado' : 'Homologado')
        : isAdjusted 
        ? (isLate ? 'Debitado' : 'Ajustado')
        : undefined;

      return {
        id: `shift-occ-${s.id}`,
        shiftId: s.id,
        employeeId: s.employeeId,
        employeeName: emp.name,
        employeeRole: emp.role || 'Colaborador',
        employeeDept: emp.department || 'Geral',
        employeeAvatar: emp.avatar || '',
        type,
        reason: shiftJust?.reason || s.notes || (isLate ? `Entrada com atraso${diffStr}` : `Permanência com hora extra${diffStr}`),
        date: s.date,
        documentName: shiftJust?.documentName || (isLate ? 'Declaracao_Comparecimento_Horas.pdf' : 'Não se aplica'),
        documentUrl: shiftJust?.documentUrl,
        status: statusVal as 'Aprovado' | 'Recusado / Falta' | 'Falta Lançada' | 'Pendente',
        actionText,
        feedback: shiftJust?.managerNotes || '',
      };
    });

    const demoDelayItem = (mappedDelaysAndOvertimeFromShifts.some(i => i.type === 'Atraso de Entrada') || mappedJustifications.some(j => j.type === 'Atraso de Entrada' || j.type === 'Justificativa de Atraso')) ? [] : [{
      id: 'demo-delay-1',
      employeeId: emp2.id,
      employeeName: emp2.name || 'Carlos Silveira',
      employeeRole: emp2.role || 'Supervisor',
      employeeDept: emp2.department || 'Logística',
      employeeAvatar: emp2.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      type: 'Atraso de Entrada',
      reason: 'Atraso de 35 min: Consulta médica matinal com declaração anexada',
      date: today,
      documentName: 'Declaracao_Comparecimento_Horas.pdf',
      documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      status: 'Pendente' as const,
      feedback: '',
    }];

    const demoOvertimeItem = mappedDelaysAndOvertimeFromShifts.some(i => i.type === 'Hora Extra') ? [] : [{
      id: 'demo-overtime-1',
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRole: emp1.role || 'Analista de Operações',
      employeeDept: emp1.department || 'Operações',
      employeeAvatar: emp1.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      type: 'Hora Extra',
      reason: 'Hora extra de +39 min: Atendimento urgente e suporte estendido a cliente',
      date: today,
      documentName: 'Não se aplica',
      documentUrl: undefined,
      status: 'Pendente' as const,
      feedback: '',
    }];

    // Central Unificada de Aprovações (Aba 2):
    // Reúne Atestados Médicos, Faltas Não Justificadas, Justificados, Atrasos de Entrada, Horas Extras, Trocas de Turno e Folgas
    setApprovalsData([
      ...demoAbsenceItem,
      ...demoJustifiedItem,
      ...demoDelayItem,
      ...demoOvertimeItem,
      ...mappedAbsences,
      ...mappedDelaysAndOvertimeFromShifts,
      ...mappedJustifications.map(j => ({
        ...j,
        type: j.type === 'Justificativa de Atraso' ? 'Atraso de Entrada' : j.type
      })),
      ...mappedRequests
    ]);

    // Ocorrências de Banco de Horas & Registro de Ponto (Exclusivo para jornada com trabalho efetivo)
    const mappedFromShifts: BancoHorasItem[] = (shifts || []).filter(s => {
      const hasHe = s.notes && s.notes.includes('[HE');
      const hasLate = (s.notes && s.notes.includes('[Atraso')) || s.attendanceStatus === 'late';
      const hasAdjustment = s.notes && (s.notes.includes('Esquecimento') || s.notes.includes('AJUSTE') || s.notes.includes('HOMOLOGADO'));
      return hasHe || hasLate || hasAdjustment;
    }).map(s => {
      const emp = employees.find(e => e.id === s.employeeId) || emp1;
      const isHe = s.notes?.includes('[HE');
      const isForget = s.notes?.includes('Esquecimento');
      const isLate = (s.notes?.includes('[Atraso') || s.attendanceStatus === 'late') && !isHe;

      let type: 'hora_extra' | 'atraso' | 'esquecimento' = 'hora_extra';
      let typeLabel = 'Hora Extra';
      let diffMinutes = 39;
      let diffBadge = '+39 min';

      if (isForget) {
        type = 'esquecimento';
        typeLabel = 'Esquecimento de Saída';
        diffMinutes = 0;
        diffBadge = '0 min (Esquecimento)';
      } else if (isLate) {
        type = 'atraso';
        typeLabel = 'Atraso de Entrada';
        const lateMatch = s.notes?.match(/\[Atraso (\d+)m/);
        diffMinutes = lateMatch ? -Number(lateMatch[1]) : -35;
        diffBadge = `${diffMinutes} min`;
      } else if (isHe) {
        type = 'hora_extra';
        typeLabel = 'Hora Extra';
        const heMatch = s.notes?.match(/\[HE \+(\d+)m/);
        diffMinutes = heMatch ? Number(heMatch[1]) : 39;
        diffBadge = `+${diffMinutes} min`;
      }

      const isHomologated = s.notes?.includes('HOMOLOGADO');
      const isAdjusted = s.notes?.includes('AJUSTE GESTOR');
      const defaultReason = isLate ? 'Entrada com atraso superior à tolerância CLT' : 'Ocorrência de jornada';

      const shiftJust = (justifications || []).find(j => 
        (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
      );

      let statusVal: 'Pendente' | 'Homologado' | 'Ajustado' = isHomologated ? 'Homologado' : isAdjusted ? 'Ajustado' : 'Pendente';
      let feedbackVal = '';
      if (isAdjusted) {
        feedbackVal = 'Ponto mantido com ajuste para jornada contratual (sem HE indevida)';
      } else if (isHomologated) {
        feedbackVal = 'Aprovado para Banco de Horas / Folha';
      } else if (shiftJust && shiftJust.status === 'approved') {
        statusVal = 'Homologado';
        feedbackVal = 'Atraso abonado com base em atestado/comprovante';
      }

      return {
        id: `bh-shift-${s.id}`,
        shiftId: s.id,
        employeeId: s.employeeId,
        employeeName: emp.name,
        employeeRole: emp.role || 'Colaborador',
        employeeDept: emp.department || 'Geral',
        employeeAvatar: emp.avatar || '',
        date: s.date,
        scheduledTime: `${s.startTime} às ${s.endTime}`,
        punchTime: s.checkInTime ? `${s.checkInTime} às ${s.checkOutTime || '--:--'}` : 'Sem batida de ponto',
        diffMinutes,
        diffBadge,
        type,
        typeLabel,
        reason: shiftJust?.reason || s.notes || defaultReason,
        documentName: shiftJust?.documentName,
        documentUrl: shiftJust?.documentUrl,
        status: statusVal,
        feedback: feedbackVal,
      };
    });

    const demoHoraExtra: BancoHorasItem = {
      id: 'bh-sim-1',
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRole: emp1.role || 'Analista de Operações',
      employeeDept: emp1.department || 'Operações',
      employeeAvatar: emp1.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      date: today,
      scheduledTime: '08:00 às 15:20',
      punchTime: '08:00 às 15:59',
      diffMinutes: 39,
      diffBadge: '+39 min',
      type: 'hora_extra',
      typeLabel: 'Hora Extra',
      reason: 'Atendimento urgente e suporte estendido a cliente corporativo',
      status: 'Pendente',
      feedback: '',
    };

    const demoAtraso: BancoHorasItem = {
      id: 'bh-sim-2',
      employeeId: emp2.id,
      employeeName: emp2.name || 'Carlos Silveira',
      employeeRole: emp2.role || 'Supervisor',
      employeeDept: emp2.department || 'Logística',
      employeeAvatar: emp2.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      date: today,
      scheduledTime: '08:00 às 17:00',
      punchTime: '08:35 às 17:00',
      diffMinutes: -35,
      diffBadge: '-35 min',
      type: 'atraso',
      typeLabel: 'Atraso de Entrada',
      reason: 'Atraso de 35 min: Consulta médica matinal com declaração de comparecimento anexada',
      documentName: 'Declaracao_Comparecimento_Horas.pdf',
      documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      status: 'Pendente',
      feedback: '',
    };

    const demoEsquecimento: BancoHorasItem = {
      id: 'bh-sim-3',
      employeeId: emp3.id,
      employeeName: emp3.name || 'Mariana Rios',
      employeeRole: emp3.role || 'Atendente',
      employeeDept: emp3.department || 'Atendimento',
      employeeAvatar: emp3.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      date: today,
      scheduledTime: '08:00 às 15:20',
      punchTime: '08:00 às 15:59',
      diffMinutes: 0,
      diffBadge: '0 min (Esquecimento)',
      type: 'esquecimento',
      typeLabel: 'Esquecimento de Saída',
      reason: 'Esquecimento de Saída: Saída real no horário previsto (15:20) - Batida às 15:59',
      status: 'Pendente',
      feedback: '',
    };

    const finalBancoHoras: BancoHorasItem[] = [...mappedFromShifts];
    if (!finalBancoHoras.some(b => b.type === 'hora_extra')) {
      finalBancoHoras.unshift(demoHoraExtra);
    }
    if (!finalBancoHoras.some(b => b.type === 'atraso')) {
      finalBancoHoras.splice(1, 0, demoAtraso);
    }
    if (!finalBancoHoras.some(b => b.type === 'esquecimento')) {
      finalBancoHoras.push(demoEsquecimento);
    }
    setBancoHorasData(finalBancoHoras);
  }, [employees, justifications, requests, shifts]);

  // Ações de Homologação / Aprovação para Atestados, Faltas, Atrasos e Horas Extras (Central de Aprovações)
  const handleApproveOccurrence = async (id: string) => {
    const targetItem = approvalsData.find(i => i.id === id);
    const isFalta = targetItem?.type === 'Falta Não Justificada' || id.startsWith('absence-');
    const isAtraso = targetItem?.type === 'Atraso de Entrada' || targetItem?.type === 'Justificativa de Atraso';
    const isHe = targetItem?.type === 'Hora Extra';
    const customFeedback = targetItem?.feedback?.trim() || undefined;

    const actionText = isFalta ? 'Abonada' : isAtraso ? 'Abonado' : isHe ? 'Homologado' : 'Homologado agora';

    setApprovalsData(prev => prev.map(item => item.id === id ? { 
      ...item, 
      type: isFalta ? 'Falta Justificada' : item.type,
      status: 'Aprovado', 
      actionText 
    } : item));
    
    if (isFalta) {
      const shiftId = (targetItem as any)?.shiftId || id.replace('absence-', '');
      const targetShift = shifts.find(s => s.id === shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          attendanceStatus: 'justified',
          notes: `${targetShift.notes || ''} [ABONO GESTOR: Ausência Justificada / Abonada em Folha]`
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
      const shiftId = (targetItem as any)?.shiftId || (id.startsWith('shift-occ-') ? id.replace('shift-occ-', '') : undefined);
      if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [ABONO GESTOR: Atraso Abonado]`
          });
        }
      }
      showPolishedToast({
        id: 'abono-atraso-success',
        title: 'Atraso Abonado com Sucesso!',
        description: 'O atraso foi abonado pelo gestor com base no comprovante e não gerará débito.',
        rimVariant: 'success',
        duration: 4000,
      });
      return;
    }

    if (isHe) {
      const shiftId = (targetItem as any)?.shiftId || (id.startsWith('shift-occ-') ? id.replace('shift-occ-', '') : undefined);
      if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [HOMOLOGADO GESTOR: Hora Extra Aprovada]`
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

    if (id.startsWith('demo-')) {
      // Item demonstrativo atualizado localmente
    } else {
      const isRequest = requests.some(r => r.id === id);
      if (isRequest) {
        if (onApproveRequest) {
          onApproveRequest(id, customFeedback);
        } else {
          await updateSolicitacaoStatusSupabase(id, 'approved', customFeedback || 'Aprovado pelo gestor');
        }
      } else if (onApproveJustification) {
        onApproveJustification(id, customFeedback);
      } else {
        await updateJustificativaStatusSupabase(id, 'approved', customFeedback || 'Homologado pelo gestor');
      }
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
    const isAtraso = targetItem?.type === 'Atraso de Entrada' || targetItem?.type === 'Justificativa de Atraso';
    const isHe = targetItem?.type === 'Hora Extra';
    const customFeedback = targetItem?.feedback?.trim() || undefined;

    const actionText = isFalta ? 'Desconto em Folha' : isAtraso ? 'Debitado' : isHe ? 'Ajustado' : 'Recusado agora';

    setApprovalsData(prev => prev.map(item => item.id === id ? { 
      ...item, 
      status: 'Recusado / Falta', 
      actionText 
    } : item));
    
    if (isFalta) {
      const shiftId = (targetItem as any)?.shiftId || id.replace('absence-', '');
      const targetShift = shifts.find(s => s.id === shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          attendanceStatus: 'absent',
          notes: `${targetShift.notes || ''} [CONFIRMADA FALTA: Lançado desconto de 1 dia + DSR]`
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
      const shiftId = (targetItem as any)?.shiftId || (id.startsWith('shift-occ-') ? id.replace('shift-occ-', '') : undefined);
      if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [AJUSTE GESTOR: Débito de Atraso Confirmado]`
          });
        }
      }
      showPolishedToast({
        id: 'debito-atraso-confirm',
        title: 'Débito de Atraso Confirmado',
        description: 'Os minutos de atraso foram confirmados para débito/compensação no Banco de Horas.',
        rimVariant: 'default',
        duration: 4000,
      });
      return;
    }

    if (isHe) {
      const shiftId = (targetItem as any)?.shiftId || (id.startsWith('shift-occ-') ? id.replace('shift-occ-', '') : undefined);
      if (shiftId) {
        const targetShift = shifts.find(s => s.id === shiftId);
        if (targetShift) {
          onOpenEditShift?.({
            ...targetShift,
            notes: `${targetShift.notes || ''} [AJUSTE GESTOR: Ajustado p/ Horário Normal]`
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

    if (id.startsWith('demo-')) {
      // Item demonstrativo atualizado localmente
    } else {
      const isRequest = requests.some(r => r.id === id);
      if (isRequest) {
        if (onRejectRequest) {
          onRejectRequest(id, customFeedback);
        } else {
          await updateSolicitacaoStatusSupabase(id, 'rejected', customFeedback || 'Recusado pelo gestor');
        }
      } else if (onRejectJustification) {
        onRejectJustification(id, customFeedback);
      } else {
        await updateJustificativaStatusSupabase(id, 'rejected', customFeedback || 'Recusado pelo gestor');
      }
    }
    showPolishedToast({
      id: 'approval-rejected',
      title: 'Solicitação Recusada',
      description: 'A solicitação foi recusada e o colaborador foi notificado.',
      rimVariant: 'success',
      duration: 3500,
    });
  };

  // Ações do Gestor para Banco de Horas e Ajustes CLT (Aba Relatório de Presenças)
  // Exportação especializada de Fechamento de Folha & Banco de Horas para o RH (Padrão Contábil / eSocial)
  const handleExportBancoHorasCsv = (rowsToExport: BancoHorasItem[]) => {
    const headers = [
      'Colaborador',
      'Matrícula / ID',
      'Departamento',
      'Cargo',
      'Data',
      'Escala Contratual',
      'Batidas de Ponto',
      'Tipo de Ocorrência',
      'Variação (min)',
      'Horas Extras (HH:MM)',
      'Horas Extras Decimal (p/ Folha)',
      'Atrasos a Debitar (min)',
      'Atrasos Decimal (p/ Folha)',
      'Status Homologação',
      'Justificativa do Colaborador',
      'Comprovante Anexado',
      'Parecer / Observação do Gestor',
      'Fundamentação Legal'
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = rowsToExport.map(row => {
      const isHe = row.type === 'hora_extra';
      const isAtraso = row.type === 'atraso';
      const isEsquecimento = row.type === 'esquecimento';

      const heMinutes = isHe && row.status === 'Homologado' ? Math.max(0, row.diffMinutes) : 0;
      const heH = Math.floor(heMinutes / 60);
      const heM = heMinutes % 60;
      const heHHMM = `${String(heH).padStart(2, '0')}:${String(heM).padStart(2, '0')}`;
      const heDecimal = (heMinutes / 60).toFixed(2).replace('.', ',');

      const atrasoMinutes = isAtraso && row.status === 'Ajustado' ? Math.abs(row.diffMinutes) : 0;
      const atrasoDecimal = (atrasoMinutes / 60).toFixed(2).replace('.', ',');

      let statusLabel: string = row.status;
      if (row.status === 'Homologado') {
        statusLabel = isHe ? 'Aprovado p/ Banco de Horas' : 'Atraso Abonado c/ Comprovante';
      } else if (row.status === 'Ajustado') {
        statusLabel = isHe ? 'Ajustado p/ Horário Contratual' : 'Débito Confirmado no Banco';
      }

      let fundLegal = 'CLT Art. 58';
      if (isEsquecimento) fundLegal = 'CLT Art. 4º § 2º (Não cômputo sem trabalho efetivo)';
      else if (isHe) fundLegal = 'CLT Art. 59 (Acordo de Banco de Horas / HE)';
      else if (isAtraso) fundLegal = 'Portaria MTE 671 / CLT Art. 58';

      return [
        escapeCsv(row.employeeName),
        escapeCsv(row.employeeId),
        escapeCsv(row.employeeDept),
        escapeCsv(row.employeeRole),
        escapeCsv(formatDateToDDMMAAAA(row.date)),
        escapeCsv(row.scheduledTime),
        escapeCsv(row.punchTime),
        escapeCsv(row.typeLabel),
        row.diffMinutes,
        escapeCsv(heHHMM),
        escapeCsv(heDecimal),
        atrasoMinutes,
        escapeCsv(atrasoDecimal),
        escapeCsv(statusLabel),
        escapeCsv(row.reason),
        escapeCsv(row.documentName || 'Sem anexo'),
        escapeCsv(row.feedback || ''),
        escapeCsv(fundLegal)
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fechamento-banco-horas-folha-${getTodayDateString()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showPolishedToast({
      id: 'csv-folha-export',
      title: 'Planilha de Folha Exportada!',
      description: 'Relatório formatado em horas decimais e rubricas de fechamento contábil baixado com sucesso.',
      rimVariant: 'success',
      duration: 4000,
    });
  };

  const handleExportApprovalsCsv = (rowsToExport: any[], targetMonth?: string) => {
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
      'Matrícula / ID',
      'Departamento',
      'Cargo',
      'Data da Ocorrência',
      'Tipo de Ocorrência',
      'Motivo / Detalhes da Solicitação',
      'Comprovante / Atestado Anexado',
      'Status',
      'Ação Realizada',
      'Observação / Feedback do Gestor'
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = rowsToExport.map(row => {
      let statusFormatted = row.status || 'Pendente';
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
        escapeCsv(row.employeeId || '—'),
        escapeCsv(row.employeeDept),
        escapeCsv(row.employeeRole),
        escapeCsv(dateFormatted),
        escapeCsv(row.type),
        escapeCsv(row.reason),
        escapeCsv(row.documentName || 'Sem anexo'),
        escapeCsv(statusFormatted),
        escapeCsv(row.actionText || (row.status === 'Pendente' ? 'Aguardando decisão' : 'Processado')),
        escapeCsv(row.feedback || '—')
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

  const handleHomologarAusencia = async (shiftId?: string, rowId?: string) => {
    if (shiftId) {
      const targetShift = shifts.find(s => s.id === shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          attendanceStatus: 'justified',
          notes: `${targetShift.notes || ''} [HOMOLOGADO GESTOR: Ausência Justificada / Abonada]`
        });
      }
    }
    if (rowId) {
      setBancoHorasData(prev => prev.map(i => i.id === rowId ? { ...i, status: 'Homologado', feedback: 'Ausência justificada e homologada pelo gestor (Abonada)' } : i));
    }
    showPolishedToast({
      id: 'ausencia-homologada',
      title: 'Ausência Homologada e Justificada!',
      description: 'A ausência do colaborador foi justificada e abonada no espelho com sucesso.',
      rimVariant: 'success',
      duration: 4000,
    });
  };

  const handleHomologarBanco = (id: string) => {
    const item = bancoHorasData.find(i => i.id === id);
    if (item?.shiftId) {
      const targetShift = shifts.find(s => s.id === item.shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          notes: `${targetShift.notes || ''} [HOMOLOGADO GESTOR: Aprovado para Banco de Horas]`
        });
      }
    }
    const isLate = item?.type === 'atraso';
    const defaultFeedback = isLate
      ? 'Atraso abonado pelo gestor com base na justificativa / comprovante (sem débito)'
      : (item?.feedback || 'Horas extras aprovadas para crédito no Banco de Horas / folha');

    setBancoHorasData(prev => prev.map(i => i.id === id ? { ...i, status: 'Homologado', feedback: defaultFeedback } : i));
    showPolishedToast({
      id: 'bh-homologado',
      title: isLate ? 'Atraso Abonado com Sucesso!' : 'Hora Extra Homologada!',
      description: isLate ? 'O atraso foi abonado com base no comprovante e não gerará débito no Banco de Horas.' : 'Saldo aprovado e creditado no Banco de Horas do colaborador com sucesso.',
      rimVariant: 'success',
      duration: 4000,
    });
  };

  const handleAjustarHorarioNormal = (id: string) => {
    const item = bancoHorasData.find(i => i.id === id);
    if (item?.shiftId) {
      const targetShift = shifts.find(s => s.id === item.shiftId);
      if (targetShift) {
        onOpenEditShift?.({
          ...targetShift,
          notes: `${targetShift.notes || ''} [AJUSTE GESTOR: Ajuste aplicado]`
        });
      }
    }
    const isLate = item?.type === 'atraso';
    const defaultFeedback = isLate
      ? 'Débito de minutos de atraso confirmado para compensação no Banco de Horas'
      : (item?.feedback || 'Tratado para horário previsto contratual (CLT Art. 4º § 2º - Sem HE indevida)');

    setBancoHorasData(prev => prev.map(i => i.id === id ? { ...i, status: 'Ajustado', feedback: defaultFeedback } : i));
    showPolishedToast({
      id: 'bh-ajustado',
      title: isLate ? 'Débito de Atraso Confirmado' : 'Ponto Ajustado p/ Horário Normal',
      description: isLate ? 'O atraso foi lançado para compensação no saldo do Banco de Horas.' : 'Registro técnico preservado (Portaria 671). Ajuste de tratamento aplicado sem gerar HE indevida (Art. 4º CLT).',
      rimVariant: 'success',
      duration: 5000,
    });
  };

  const handleUpdateBancoHorasFeedback = (id: string, feedback: string) => {
    setBancoHorasData(prev => prev.map(i => i.id === id ? { ...i, feedback } : i));
  };

  const handleGenerateBancoHorasSample = (type: 'hora_extra' | 'atraso' | 'esquecimento') => {
    const today = getTodayDateString();
    const targetEmp = employees[0] || {
      id: 'emp-sample-1',
      name: 'Alexsandra Arrais',
      role: 'Analista de Operações',
      department: 'Operações',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    };

    const simId = `sim-bh-${Date.now()}`;
    let newOcc: BancoHorasItem;

    if (type === 'hora_extra') {
      newOcc = {
        id: simId,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        employeeRole: targetEmp.role || 'Colaborador',
        employeeDept: targetEmp.department || 'Operações',
        employeeAvatar: targetEmp.avatar || '',
        date: today,
        scheduledTime: '08:00 às 15:20',
        punchTime: '08:00 às 15:59',
        diffMinutes: 39,
        diffBadge: '+39 min',
        type: 'hora_extra',
        typeLabel: 'Hora Extra',
        reason: 'Atendimento urgente e suporte estendido a cliente corporativo',
        status: 'Pendente',
        feedback: '',
      };
      showPolishedToast({
        id: 'sim-he-created',
        title: 'Caso de Hora Extra Gerado (+39 min)',
        description: 'Colaborador saiu após o término da escala. Clique em "Homologar Banco" para creditar.',
        rimVariant: 'success',
      });
    } else if (type === 'atraso') {
      newOcc = {
        id: simId,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        employeeRole: targetEmp.role || 'Colaborador',
        employeeDept: targetEmp.department || 'Operações',
        employeeAvatar: targetEmp.avatar || '',
        date: today,
        scheduledTime: '08:00 às 17:00',
        punchTime: '08:35 às 17:00',
        diffMinutes: -35,
        diffBadge: '-35 min',
        type: 'atraso',
        typeLabel: 'Atraso de Entrada',
        reason: 'Paralisação inesperada e atraso no transporte público na linha 9',
        status: 'Pendente',
        feedback: '',
      };
      showPolishedToast({
        id: 'sim-late-created',
        title: 'Caso de Atraso Gerado (-35 min)',
        description: 'Colaborador entrou 35 min após o início da escala. Avalie o débito/justificativa.',
        rimVariant: 'success',
      });
    } else {
      newOcc = {
        id: simId,
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        employeeRole: targetEmp.role || 'Colaborador',
        employeeDept: targetEmp.department || 'Operações',
        employeeAvatar: targetEmp.avatar || '',
        date: today,
        scheduledTime: '08:00 às 15:20',
        punchTime: '08:00 às 15:59',
        diffMinutes: 0,
        diffBadge: '0 min (Esquecimento)',
        type: 'esquecimento',
        typeLabel: 'Esquecimento de Saída',
        reason: 'Esquecimento de Saída: Saída real no horário previsto (15:20) - Batida às 15:59',
        status: 'Pendente',
        feedback: '',
      };
      showPolishedToast({
        id: 'sim-forgot-created',
        title: 'Caso de Esquecimento Gerado',
        description: 'Colaborador registrou saída tardia por esquecimento. Clique em "Ajustar Horário Normal" (Art. 4º CLT).',
        rimVariant: 'success',
      });
    }

    setBancoHorasData(prev => [newOcc, ...prev]);
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

  const handleSaveNewOccurrence = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newOccurrenceForm.employeeId) || employees[0];
    const newItem = {
      id: `ap-${Date.now()}`,
      employeeId: emp?.id,
      employeeName: emp?.name || 'Colaborador',
      employeeRole: emp?.role || 'Colaborador',
      employeeDept: emp?.department || 'Geral',
      employeeAvatar: emp?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: newOccurrenceForm.type,
      reason: newOccurrenceForm.reason || 'Ocorrência registrada manualmente pelo gestor',
      date: newOccurrenceForm.date,
      documentName: newOccurrenceForm.documentName || 'Não se aplica',
      status: newOccurrenceForm.status,
      actionText: newOccurrenceForm.status === 'Aprovado' ? 'Homologado' : newOccurrenceForm.status === 'Pendente' ? 'Aguardando decisão' : 'Registrado em folha',
      feedback: newOccurrenceForm.feedback,
    };
    setApprovalsData(prev => [newItem, ...prev]);
    setIsNewOccurrenceModalOpen(false);
    setNewOccurrenceForm({
      employeeId: employees[0]?.id || 'emp-1',
      type: 'Atestado Médico',
      date: new Date().toLocaleDateString('pt-BR'),
      reason: '',
      documentName: 'atestado.pdf',
      status: 'Pendente',
      feedback: '',
    });
  };

  // Tab 3 (Relatórios) States
  const [relatorioSearch, setRelatorioSearch] = useState('');
  const [relatorioDate, setRelatorioDate] = useState('');
  const [relatorioStatus, setRelatorioStatus] = useState('all');
  const [relatorioDept, setRelatorioDept] = useState('all');

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
      daysLeft: minDaysRemaining
    };
  }, [shifts]);

  const reportRows = useMemo(() => {
    if (shifts && shifts.length > 0) {
      const cutoff60 = toLocalDateString(addDaysLocal(new Date(), -60));
      return shifts
        .filter(s => !s.date || normalizeDateToISO(s.date) >= cutoff60)
        .map(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        const statusMap: Record<string, string> = {
          present: 'Presente',
          absent: 'Ausente',
          justified: 'Justificado',
          late: 'Atrasado',
          pending: 'Pendente'
        };
        const hasRealExit = Boolean(s.checkOutTime) && s.checkOutTime !== s.checkInTime;

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

        let calculatedHours = '—';
        if (s.checkInTime && hasRealExit) {
          const [inH, inM] = s.checkInTime.split(':').map(Number);
          const [outH, outM] = s.checkOutTime!.split(':').map(Number);
          let diffMin = (outH * 60 + outM) - (inH * 60 + inM);
          if (diffMin < 0) diffMin += 24 * 60;
          const h = Math.floor(diffMin / 60);
          const m = diffMin % 60;
          calculatedHours = `${h}h${m > 0 ? ` ${m}m` : ''}`;
        } else if (s.checkInTime && !hasRealExit) {
          calculatedHours = 'Em andamento';
        } else if (!s.checkInTime) {
          calculatedHours = '0h';
        }

        const isPast24h = isShiftPast24hWithoutPunch(s);
        const just = (justifications || []).find(j => 
          (j.shiftId && j.shiftId === s.id) || (j.employeeId === s.employeeId && j.date === s.date)
        );

        let finalReportStatus = statusMap[s.attendanceStatus || 'pending'] || 'Pendente';
        let isDecisionPending = false;

        if (just) {
          if (just.status === 'approved' || s.attendanceStatus === 'justified') {
            finalReportStatus = 'Justificado';
          } else if (just.status === 'rejected') {
            finalReportStatus = 'Ausente';
          } else {
            finalReportStatus = (isPast24h || s.attendanceStatus === 'absent') ? 'Ausente' : 'Pendente';
            isDecisionPending = true;
          }
        } else if (s.attendanceStatus === 'justified') {
          finalReportStatus = 'Justificado';
        } else if (s.attendanceStatus === 'present' || Boolean(s.checkInTime)) {
          finalReportStatus = s.attendanceStatus === 'late' ? 'Atrasado' : 'Presente';
        } else if (isPast24h || s.attendanceStatus === 'absent') {
          finalReportStatus = 'Ausente';
          isDecisionPending = true;
        }

        // Observação concisa e limpa (sem acúmulo de textos concatenados)
        let cleanObs = '';
        if (finalReportStatus === 'Ausente') {
          if (just && just.status === 'pending') {
            cleanObs = `Justificativa: "${just.reason || 'Em análise'}"`;
          } else {
            cleanObs = 'Não bateu ponto';
          }
        } else if (finalReportStatus === 'Justificado') {
          cleanObs = 'Ausência abonada';
        } else if (s.notes) {
          if (s.notes.includes('AJUSTE GESTOR')) {
            cleanObs = 'Ajustado p/ horário normal';
          } else if (s.notes.includes('HOMOLOGADO GESTOR')) {
            cleanObs = 'Homologado no banco';
          } else if (s.notes.includes('Esquecimento')) {
            cleanObs = 'Esquecimento de saída';
          } else {
            cleanObs = s.notes.replace(/\[.*?\]/g, '').trim() || s.notes;
          }
        }

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
          time: s.checkInTime 
            ? `${s.checkInTime}${hasRealExit ? ` → ${s.checkOutTime}` : ' (Entrada)'}` 
            : `${s.startTime} – ${s.endTime}`,
          hours: calculatedHours,
          status: finalReportStatus,
          isDecisionPending,
          type: s.type === 'regular' ? 'Regular' : 'Extra',
          checkInLocation: s.checkInLocation,
          checkOutLocation: s.checkOutLocation,
          isGpsOutside,
          gpsDist,
          cleanObs: cleanObs || '—',
          obsFull,
          obs: obsFull
        };
      });
    }

    return [];
  }, [shifts, employees, justifications]);

  // Tab 4 (Tarefas) State - Orbit Visual Identity
  const allAssignablePeople = useMemo(() => {
    return [...employees];
  }, [employees]);

  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    async function loadReminders() {
      const data = await getRemindersSupabase({
        companyId: activeEmployee?.companyId,
        creatorId: activeEmployee?.id,
        visibleEmployeeIds: employees.map(e => e.id)
      });
      if (data && data.length > 0) {
        setReminders(data);
      } else {
        setReminders([]);
      }
    }

    loadReminders();
  }, [employees, activeEmployee?.id, activeEmployee?.companyId]);

  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderFilterType, setReminderFilterType] = useState<string>('all');
  const [reminderCollaboratorFilter, setReminderCollaboratorFilter] = useState<string>('all');
  const [isNewReminderModalOpen, setIsNewReminderModalOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [collaboratorSearchInModal, setCollaboratorSearchInModal] = useState('');
  const [newReminderData, setNewReminderData] = useState<{
    title: string;
    description: string;
    type: 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
    tag: string;
    date: string;
    time: string;
    link: string;
    assignedEmployeeIds: string[];
  }>({
    title: '',
    description: '',
    type: 'atividade',
    tag: 'Geral',
    date: toLocalDateString(new Date()),
    time: '09:00',
    link: '',
    assignedEmployeeIds: [],
  });

  const handleOpenNewReminderModal = () => {
    setEditingReminderId(null);
    setNewReminderData({
      title: '',
      description: '',
      type: 'atividade',
      tag: 'Geral',
      date: toLocalDateString(new Date()),
      time: '09:00',
      link: '',
      assignedEmployeeIds: [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  const handleOpenEditReminderModal = (rem: ReminderItem) => {
    setEditingReminderId(rem.id);
    setNewReminderData({
      title: rem.title,
      description: rem.description,
      type: rem.type,
      tag: rem.tag,
      date: rem.date,
      time: rem.time,
      link: rem.link || '',
      assignedEmployeeIds: rem.assignedEmployeeIds ? [...rem.assignedEmployeeIds] : [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  // Tab 5 (Chat) State - Realtime Supabase
  const [activeChatMode, setActiveChatMode] = useState<'channel' | 'direct'>('channel');
  const [activeChatChannel, setActiveChatChannel] = useState<string>('geral');

  // Identifica a chave da empresa para isolamento multi-tenant
  const companyKey = useMemo(() => {
    return (activeEmployee?.companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  }, [activeEmployee?.companyId]);

  // Contatos para conversa direta: exclui o próprio usuário logado
  const directEmployees = useMemo(() => {
    return employees.filter(e => e.id !== activeEmployee?.id);
  }, [employees, activeEmployee?.id]);

  const [selectedDirectEmployeeId, setSelectedDirectEmployeeId] = useState<string>('');

  useEffect(() => {
    if (directEmployees.length > 0 && (!selectedDirectEmployeeId || !directEmployees.some(e => e.id === selectedDirectEmployeeId))) {
      setSelectedDirectEmployeeId(directEmployees[0].id);
    }
  }, [directEmployees, selectedDirectEmployeeId]);

  const selectedDirectEmployee = useMemo(() => {
    return directEmployees.find(e => e.id === selectedDirectEmployeeId) || null;
  }, [directEmployees, selectedDirectEmployeeId]);

  const [newChatInput, setNewChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [teamChannels, setTeamChannels] = useState<ChatChannelItem[]>(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]'));
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        return parsed.filter(c => !deletedIds.has(c.id)).map(c => ({
          ...c,
          badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
        }));
      }
      return DEFAULT_TEAM_CHANNELS.filter(c => !deletedIds.has(c.id));
    } catch {}
    return DEFAULT_TEAM_CHANNELS;
  });

  // Atualiza canais caso a empresa mude
  useEffect(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]'));
      const saved = localStorage.getItem(`pontuall_team_channels_${companyKey}`);
      if (saved) {
        const parsed: ChatChannelItem[] = JSON.parse(saved);
        setTeamChannels(parsed.filter(c => !deletedIds.has(c.id)).map(c => ({
          ...c,
          badge: ['Online', 'Ativo', 'RH'].includes(c.badge) ? '' : c.badge
        })));
      } else {
        setTeamChannels(DEFAULT_TEAM_CHANNELS);
      }
    } catch {
      setTeamChannels(DEFAULT_TEAM_CHANNELS);
    }
  }, [companyKey]);

  // Novo Grupo Modal
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupBadge, setNewGroupBadge] = useState('Equipe');
  const [newGroupAvatar, setNewGroupAvatar] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const managerGroupAvatarInputRef = React.useRef<HTMLInputElement | null>(null);

  const managerActiveGroupAvatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const [channelToEditAvatar, setChannelToEditAvatar] = useState<ChatChannelItem | null>(null);

  const handleManagerGroupAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 300, 300, 0.8);
      setNewGroupAvatar(compressed.url);
    } catch (err) {
      console.error('Erro ao processar imagem do grupo:', err);
    } finally {
      if (managerGroupAvatarInputRef.current) managerGroupAvatarInputRef.current.value = '';
    }
  };

  const handleUpdateExistingChannelAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetChan = channelToEditAvatar || activeChannelInfo;
    if (!file || !targetChan) return;
    try {
      const compressed = await compressImageFile(file, 300, 300, 0.8);
      const avatarUrl = compressed.url;
      const updatedChan: ChatChannelItem = { ...targetChan, avatar: avatarUrl };

      setTeamChannels(prev => {
        const next = prev.map(c => c.id === targetChan.id ? updatedChan : c);
        try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(next)); } catch {}
        return next;
      });

      const scopedId = getScopedChatChannel(activeEmployee?.companyId, targetChan.id);
      try {
        await supabase.from('chat_channels').upsert([
          {
            id: scopedId,
            name: updatedChan.name,
            description: updatedChan.desc,
            badge: updatedChan.badge,
            created_by: activeEmployee?.name || 'Gestão',
            members: updatedChan.members || null,
            avatar: avatarUrl,
          }
        ]);
      } catch {}

      try {
        await supabase.from('messages').insert([
          {
            channel: scopedId,
            text: `🖼️ A imagem do grupo #${updatedChan.name} foi atualizada.`,
            recipient_id: `group_meta:${JSON.stringify(updatedChan)}`,
            sender_id: activeEmployee?.id || 'gestor',
            sender_name: activeEmployee?.name || 'Gestor',
            sender_role: activeEmployee?.role || 'Gestor',
            sender_avatar: activeEmployee?.avatar || '',
          }
        ]);
      } catch {}
    } catch (err) {
      console.error('Erro ao atualizar imagem do canal:', err);
    } finally {
      setChannelToEditAvatar(null);
      if (managerActiveGroupAvatarInputRef.current) managerActiveGroupAvatarInputRef.current.value = '';
    }
  };

  // Confirmação de Exclusão de Grupo
  const [groupToDelete, setGroupToDelete] = useState<ChatChannelItem | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Anexos de imagem no chat do gestor
  const [pendingManagerAttachment, setPendingManagerAttachment] = useState<ChatAttachment | null>(null);
  const [isAttachingManager, setIsAttachingManager] = useState(false);
  const [managerPreviewModalImage, setManagerPreviewModalImage] = useState<{ url: string; name: string } | null>(null);
  const managerFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleManagerFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAttachingManager(true);
    try {
      const compressed = await compressImageFile(file);
      setPendingManagerAttachment(compressed);
    } catch (err) {
      console.error('Erro ao processar anexo:', err);
    } finally {
      setIsAttachingManager(false);
      if (managerFileInputRef.current) managerFileInputRef.current.value = '';
    }
  };

  const chatMessagesContainerRef = React.useRef<HTMLDivElement | null>(null);
  const chatMessagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const prevChatChannelRef = React.useRef<string>('');
  const prevChatMsgCountRef = React.useRef<number>(0);

  // Filtra apenas os canais aos quais o usuário logado pertence (mesmo para RH ou outro Gestor, grupos privados só aparecem para os integrantes selecionados na criação)
  const visibleTeamChannels = useMemo(() => {
    return teamChannels.filter((c) => {
      if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return true;
      if (!c.members || c.members.length === 0) return true;
      return Boolean(activeEmployee?.id && c.members.includes(activeEmployee.id));
    });
  }, [teamChannels, activeEmployee?.id]);

  // Se o canal ativo não estiver mais visível (ex: foi excluído ou privado), volta para #geral
  useEffect(() => {
    if (activeChatMode === 'channel' && !visibleTeamChannels.some(c => c.id === activeChatChannel)) {
      setActiveChatChannel(visibleTeamChannels[0]?.id || 'geral');
    }
  }, [visibleTeamChannels, activeChatChannel, activeChatMode]);

  // Canal ativo no banco (isolado por empresa e contato)
  const currentChatChannel = useMemo(() => {
    if (activeChatMode === 'direct') {
      if (!selectedDirectEmployee?.id) return `cmp_${companyKey}__direct_none`;
      return getScopedDirectChannel(activeEmployee?.companyId, activeEmployee?.id, selectedDirectEmployee.id);
    }
    return getScopedChatChannel(activeEmployee?.companyId, activeChatChannel);
  }, [activeChatMode, selectedDirectEmployee?.id, activeChatChannel, activeEmployee?.companyId, activeEmployee?.id, companyKey]);

  const activeChannelInfo = useMemo(() => {
    return visibleTeamChannels.find(c => c.id === activeChatChannel) || visibleTeamChannels[0] || {
      id: 'geral',
      name: 'geral',
      desc: 'Comunicação aberta para toda a equipe',
      badge: ''
    };
  }, [visibleTeamChannels, activeChatChannel]);

  // Carrega e sincroniza canais do Supabase (incluindo exclusões feitas por outros gestores/contas)
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const fetchChannels = async () => {
      const deletedIds = new Set<string>();
      const deletedNames = new Set<string>(['girllssss']);
      try {
        const savedDel = localStorage.getItem(`pontuall_deleted_channels_${companyKey}`);
        if (savedDel) {
          JSON.parse(savedDel).forEach((id: string) => deletedIds.add(id));
        }
      } catch {}

      // 0. Busca avisos de exclusão de grupos no Supabase para sincronizar entre contas (ex: Gestor excluiu #girllssss, RH atualiza imediatamente)
      try {
        const { data: delMsgs } = await supabase
          .from('messages')
          .select('recipient_id, text')
          .or('recipient_id.like.group_deleted:%,text.like.🗑️ O grupo #%');

        if (delMsgs && delMsgs.length > 0) {
          delMsgs.forEach((m: any) => {
            if (m.recipient_id && m.recipient_id.startsWith('group_deleted:')) {
              const rawDelId = getDisplayChatChannel(m.recipient_id.replace('group_deleted:', ''));
              deletedIds.add(rawDelId);
            }
            if (m.text && m.text.includes('🗑️ O grupo #')) {
              const match = m.text.match(/#([^\s]+)\s+foi excluído/);
              if (match && match[1]) {
                deletedNames.add(match[1].trim().toLowerCase());
              }
            }
          });
          try {
            localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(Array.from(deletedIds)));
          } catch {}
        }
      } catch {}

      let dbChannelIds: Set<string> | null = null;
      try {
        const { data, error } = await supabase.from('chat_channels').select('*');
        if (!error && data) {
          dbChannelIds = new Set(data.map((d: any) => getDisplayChatChannel(d.id)));
          const loaded: ChatChannelItem[] = data
            .filter((d: any) => {
              const cleanId = getDisplayChatChannel(d.id);
              const cleanName = (d.name || '').trim().toLowerCase();
              return !deletedIds.has(d.id) && !deletedIds.has(cleanId) && !deletedNames.has(cleanName);
            })
            .map((d: any) => ({
              id: getDisplayChatChannel(d.id),
              name: d.name,
              desc: d.description || '',
              badge: d.badge || 'Equipe',
              unread: 0,
              members: d.members || undefined,
              avatar: d.avatar || undefined,
            }));
          setTeamChannels(prev => {
            // Mantém apenas canais padrão ou que ainda não foram deletados
            const map = new Map(
              prev
                .filter(p => !deletedIds.has(p.id) && !deletedNames.has((p.name || '').toLowerCase()) && (!dbChannelIds || p.id === 'geral' || p.id === 'escalas' || p.id === 'gestao' || dbChannelIds.has(p.id)))
                .map(p => [p.id, p])
            );
            loaded.forEach(item => map.set(item.id, item));
            const merged = Array.from(map.values());
            try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}

      // Descobre grupos criados gravados para esta empresa (tanto no canal do grupo quanto em group_meta no #geral)
      try {
        const geralChan = getScopedChatChannel(activeEmployee?.companyId, 'geral');
        const groupPrefix = `cmp_${companyKey}__grupo_%`;
        const { data: groupMsgs } = await supabase
          .from('messages')
          .select('channel, recipient_id, text')
          .or(`channel.like.${groupPrefix},and(channel.eq.${geralChan},recipient_id.like.group_meta:%)`);

        if (groupMsgs && groupMsgs.length > 0) {
          // Grupos que possuem mensagens ativas no próprio canal cmp_xxx__grupo_yyy
          const activeMsgChannels = new Set<string>();
          groupMsgs.forEach((m: any) => {
            if (m.channel) {
              const cId = getDisplayChatChannel(m.channel);
              if (cId.startsWith('grupo_')) activeMsgChannels.add(cId);
            }
          });

          const foundMap = new Map<string, ChatChannelItem>();
          for (const msg of groupMsgs) {
            let rawId = msg.channel ? getDisplayChatChannel(msg.channel) : '';
            let name = rawId.replace('grupo_', '');
            let desc = 'Grupo de comunicação da equipe';
            let badge = 'Equipe';
            let members: string[] | undefined = undefined;
            let avatar: string | undefined = undefined;

            if (msg.recipient_id && msg.recipient_id.startsWith('group_meta:')) {
              try {
                const meta = JSON.parse(msg.recipient_id.replace('group_meta:', ''));
                if (meta.id) rawId = getDisplayChatChannel(meta.id);
                if (meta.name) name = meta.name;
                if (meta.desc) desc = meta.desc;
                if (meta.badge) badge = meta.badge;
                if (meta.members && Array.isArray(meta.members)) members = meta.members;
                if (meta.avatar) avatar = meta.avatar;
              } catch {}
            }

            if (!rawId || !rawId.startsWith('grupo_')) continue;
            if (deletedIds.has(rawId) || deletedNames.has((name || '').toLowerCase())) continue;
            // Se o grupo só existia como anúncio antigo no #geral mas já foi apagado de chat_channels e não tem mensagens no canal próprio, ignora pois foi excluído
            if (dbChannelIds && !dbChannelIds.has(rawId) && !activeMsgChannels.has(rawId)) continue;

            const existingFound = foundMap.get(rawId);
            foundMap.set(rawId, {
              id: rawId,
              name: name || existingFound?.name || rawId,
              desc: desc || existingFound?.desc || 'Grupo de comunicação da equipe',
              badge: badge || existingFound?.badge || 'Equipe',
              unread: 0,
              members: members || existingFound?.members,
              avatar: avatar || existingFound?.avatar,
            });
          }

          setTeamChannels((prev) => {
            const map = new Map(
              prev
                .filter(p => {
                  if (deletedIds.has(p.id) || deletedNames.has((p.name || '').toLowerCase())) return false;
                  if (p.id.startsWith('grupo_') && dbChannelIds && !dbChannelIds.has(p.id) && !foundMap.has(p.id)) return false;
                  return true;
                })
                .map(p => [p.id, p])
            );
            foundMap.forEach((val, key) => {
              const existing = map.get(key);
              map.set(key, {
                ...existing,
                ...val,
                members: val.members || existing?.members,
                avatar: val.avatar || existing?.avatar,
              });
            });
            const merged = Array.from(map.values());
            try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(merged)); } catch {}
            return merged;
          });
        } else {
          // Limpa grupos órfãos caso não existam mais no banco
          setTeamChannels((prev) => {
            const filtered = prev.filter(p => {
              if (deletedIds.has(p.id) || deletedNames.has((p.name || '').toLowerCase())) return false;
              if (p.id.startsWith('grupo_') && dbChannelIds && !dbChannelIds.has(p.id)) return false;
              return true;
            });
            try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(filtered)); } catch {}
            return filtered;
          });
        }
      } catch {}
    };
    fetchChannels();
    const syncInterval = setInterval(fetchChannels, 5000);
    return () => clearInterval(syncInterval);
  }, [activeTab, companyKey, activeEmployee?.companyId]);

  // Carrega mensagens e assina WebSocket em tempo real para o chat do gestor
  useEffect(() => {
    if (activeTab !== 'chat') return;

    const fetchMessages = async () => {
      if (activeChatMode === 'direct' && !selectedDirectEmployee?.id) {
        setChatMessages([]);
        setChatLoading(false);
        return;
      }

      let query = supabase.from('messages').select('*');
      if (activeChatMode === 'direct' && activeEmployee?.id && selectedDirectEmployee?.id) {
        const pair = [activeEmployee.id, selectedDirectEmployee.id].sort().join('_');
        query = query.or(`channel.eq.direct_${pair},channel.like.%direct_${pair},and(sender_id.eq.${activeEmployee.id},recipient_id.eq.${selectedDirectEmployee.id}),and(sender_id.eq.${selectedDirectEmployee.id},recipient_id.eq.${activeEmployee.id})`);
      } else {
        query = query.eq('channel', currentChatChannel);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (!error && data) {
        // Filtra mensagens técnicas de controle de grupo para não poluir nem disparar scroll
        const cleanData = (data as ChatMessage[]).filter(
          (d) => !d.recipient_id?.startsWith('group_deleted:') && !d.recipient_id?.startsWith('group_meta:')
        );
        setChatMessages(prev => {
          const pendingTemp = prev.filter(
            p => p.id.startsWith('temp-') && !cleanData.some((d: any) => d.text === p.text && d.sender_id === p.sender_id)
          );
          const nextList = [...cleanData, ...pendingTemp];
          if (
            prev.length === nextList.length &&
            prev.every((item, idx) => item.id === nextList[idx]?.id && item.text === nextList[idx]?.text)
          ) {
            return prev;
          }
          return nextList;
        });
      }
      setChatLoading(false);
    };

    setChatLoading(true);
    setChatMessages([]);
    fetchMessages();

    const interval = setInterval(fetchMessages, 3000);

    const realtimeSubId = `mgrid_chat_rt_${activeEmployee?.id || 'mgr'}_${Date.now()}`;
    const realtimeChannel = supabase
      .channel(realtimeSubId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Se for aviso de exclusão de grupo em tempo real
          if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_deleted:')) {
            const deletedId = getDisplayChatChannel(newMsg.recipient_id.replace('group_deleted:', ''));
            setTeamChannels(prev => {
              const filtered = prev.filter(c => c.id !== deletedId);
              try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(filtered)); } catch {}
              return filtered;
            });
            try {
              const deletedList = JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]');
              if (!deletedList.includes(deletedId)) {
                deletedList.push(deletedId);
                localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(deletedList));
              }
            } catch {}
            return;
          }

          // Se for metadado de criação de grupo em tempo real
          if (newMsg.recipient_id && newMsg.recipient_id.startsWith('group_meta:')) {
            try {
              const meta = JSON.parse(newMsg.recipient_id.replace('group_meta:', ''));
              const rawChannelId = getDisplayChatChannel(meta.id || newMsg.channel || '');
              if (rawChannelId.startsWith('grupo_')) {
                const members: string[] | undefined = Array.isArray(meta.members) ? meta.members : undefined;
                if (members && members.length > 0 && activeEmployee?.id && !members.includes(activeEmployee.id)) {
                  return;
                }
                setTeamChannels(prev => {
                  if (prev.some(p => p.id === rawChannelId)) {
                    const updatedExisting = prev.map(p => p.id === rawChannelId ? { ...p, avatar: meta.avatar || p.avatar, members: members || p.members } : p);
                    try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updatedExisting)); } catch {}
                    return updatedExisting;
                  }
                  const updated = [
                    ...prev,
                    {
                      id: rawChannelId,
                      name: meta.name || rawChannelId.replace('grupo_', ''),
                      desc: meta.desc || 'Grupo criado pela gestão',
                      badge: meta.badge || 'Equipe',
                      members,
                      avatar: meta.avatar || undefined,
                      unread: 0,
                    },
                  ];
                  try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}
                  return updated;
                });
              }
            } catch {}
            return;
          }

          const directPair = (activeChatMode === 'direct' && selectedDirectEmployee?.id && activeEmployee?.id)
            ? [activeEmployee.id, selectedDirectEmployee.id].sort().join('_')
            : null;
          const isDirectMatch = Boolean(directPair && newMsg.channel && newMsg.channel.includes(`direct_${directPair}`));
          const isDirectRecipientMatch = Boolean(
            activeChatMode === 'direct' &&
            selectedDirectEmployee?.id &&
            activeEmployee?.id &&
            ((newMsg.sender_id === selectedDirectEmployee.id && newMsg.recipient_id === activeEmployee.id) ||
             (newMsg.sender_id === activeEmployee.id && newMsg.recipient_id === selectedDirectEmployee.id))
          );

          if (newMsg.channel === currentChatChannel || isDirectMatch || isDirectRecipientMatch) {
            setChatMessages(prev => {
              const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.text === newMsg.text && m.sender_id === newMsg.sender_id));
              if (filtered.some(m => m.id === newMsg.id)) return filtered;
              return [...filtered, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(realtimeChannel);
    };
  }, [activeTab, currentChatChannel, activeChatMode, selectedDirectEmployee?.id, activeEmployee?.id, companyKey]);

  // Controle inteligente de rolagem na aba de Chat: rola apenas dentro do container do chat, nunca puxando a página inteira para baixo a cada 3s
  useEffect(() => {
    const container = chatMessagesContainerRef.current;
    const isChannelSwitch = prevChatChannelRef.current !== currentChatChannel;
    const isNewMessage = chatMessages.length > prevChatMsgCountRef.current;

    if (isChannelSwitch && chatMessages.length > 0) {
      prevChatChannelRef.current = currentChatChannel;
      prevChatMsgCountRef.current = chatMessages.length;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    if (isNewMessage) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      const isFromMe = Boolean(activeEmployee?.id && lastMsg?.sender_id === activeEmployee.id);
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 140
        : true;

      if (isFromMe || isNearBottom || prevChatMsgCountRef.current === 0) {
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }
    }

    prevChatMsgCountRef.current = chatMessages.length;
  }, [chatMessages, currentChatChannel, activeEmployee?.id]);
  // Semana exibida na matriz: segunda-feira da semana atual + deslocamento de semanas
  const baseDate = useMemo(
    () => addDaysLocal(startOfWeekMonday(new Date()), currentWeekOffset * 7),
    [currentWeekOffset]
  );

  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    
    for (let i = 0; i < 7; i++) {
      const d = addDaysLocal(baseDate, i);
      days.push({
        date: d,
        dateStr: toLocalDateString(d),
        dayName: dayNames[i],
        dayNumber: d.getDate(),
      });
    }
    return days;
  }, [baseDate]);

  // Rótulo do período da semana (ex: "05 de out. – 11 de out. de 2026")
  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(start)} – ${fmt(end)} de ${end.getFullYear()}`;
  }, [weekDays]);

  // Departamentos únicos
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtrar colaboradores por busca e departamento
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (selectedDepartment !== 'all' && emp.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (emp.name || '').toLowerCase().includes(q) || (emp.role || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [employees, selectedDepartment, searchQuery]);

  // Mapeamento de turnos por colaborador e data
  const shiftsMap = useMemo(() => {
    const map: Record<string, Record<string, Shift[]>> = {};
    shifts.forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = {};
      if (!map[s.employeeId][s.date]) map[s.employeeId][s.date] = [];
      map[s.employeeId][s.date].push(s);
    });
    return map;
  }, [shifts]);

  const handlePublishDrafts = async () => {
    setIsDraftPublished(true);
    setDraftCount(0);
    try {
      const employeeIds = Array.from(new Set(shifts.map(s => s.employeeId).filter(Boolean))) as string[];
      for (const empId of employeeIds) {
        await createNotificationSupabase({
          targetEmployeeId: empId,
          title: 'Escala Oficial Publicada',
          message: 'A escala de trabalho foi publicada pelo gestor. Acesse sua grade para conferir seus turnos.',
          type: 'shift_change',
          actionRequired: false,
        });
      }
    } catch (err) {
      console.warn('Erro ao notificar publicação de escala:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim() && !pendingManagerAttachment) return;

    const rawText = newChatInput.trim();
    const attachmentToSend = pendingManagerAttachment;

    setNewChatInput('');
    setPendingManagerAttachment(null);

    const recipientId = activeChatMode === 'direct' ? (selectedDirectEmployee?.id || null) : null;
    const senderId = activeEmployee?.id || 'gestor';
    const senderName = activeEmployee?.name || 'Gestor';
    const senderRole = activeEmployee?.role || (isRh ? 'Gestora Geral' : 'Gestor');
    const senderAvatar = activeEmployee?.avatar || '';

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      sender_avatar: senderAvatar,
      text: rawText,
      attachment: attachmentToSend ? JSON.stringify(attachmentToSend) : null,
      created_at: new Date().toISOString(),
      channel: currentChatChannel,
      recipient_id: recipientId,
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      await sendChatMessageToSupabase({
        sender_id: senderId,
        sender_name: senderName,
        sender_role: senderRole,
        sender_avatar: senderAvatar,
        text: rawText,
        attachment: attachmentToSend,
        channel: currentChatChannel,
        recipient_id: recipientId,
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem no gestor:', err);
    }
  };

  const handleCreateNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    const channelId = `grupo_${Date.now()}`;
    const baseMembers = selectedMemberIds.length > 0 ? selectedMemberIds : employees.map(e => e.id);
    const creatorId = activeEmployee?.id;
    const membersList = creatorId ? Array.from(new Set([...baseMembers, creatorId])) : baseMembers;
    const newChan: ChatChannelItem = {
      id: channelId,
      name: newGroupName.trim().toLowerCase().replace(/\s+/g, '-'),
      desc: newGroupDesc.trim() || 'Grupo criado pela gestão',
      badge: newGroupBadge.trim() || 'Equipe',
      unread: 0,
      members: membersList,
      avatar: newGroupAvatar || undefined,
    };

    const updated = [...teamChannels, newChan];
    setTeamChannels(updated);
    try { localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(updated)); } catch {}

    const scopedGroupId = getScopedChatChannel(activeEmployee?.companyId, newChan.id);

    try {
      await supabase.from('chat_channels').insert([
        {
          id: scopedGroupId,
          name: newChan.name,
          description: newChan.desc,
          badge: newChan.badge,
          created_by: activeEmployee?.name || 'Gestão',
          members: newChan.members,
          avatar: newChan.avatar || null,
        }
      ]);
    } catch {}

    try {
      await supabase.from('messages').insert([
        {
          channel: scopedGroupId,
          text: `🎉 Novo grupo criado pela gestão: #${newChan.name} - ${newChan.desc}`,
          recipient_id: `group_meta:${JSON.stringify(newChan)}`,
          sender_id: activeEmployee?.id || 'gestor',
          sender_name: activeEmployee?.name || 'Gestor',
          sender_role: activeEmployee?.role || 'Gestor',
          sender_avatar: activeEmployee?.avatar || '',
        }
      ]);
    } catch {}

    setIsCreatingGroup(false);
    setIsNewGroupModalOpen(false);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupAvatar('');
    setSelectedMemberIds([]);
    setActiveChatMode('channel');
    setActiveChatChannel(newChan.id);
  };

  const handlePromptDeleteGroup = (chan: ChatChannelItem) => {
    setGroupToDelete(chan);
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    const groupId = groupToDelete.id;
    const groupName = groupToDelete.name;
    const scopedGroupId = getScopedChatChannel(activeEmployee?.companyId, groupId);

    try {
      await supabase.from('messages').delete().or(`channel.eq.${scopedGroupId},channel.eq.${groupId},recipient_id.like.%${groupId}%,text.ilike.%#${groupName} %`);
    } catch {}

    try {
      await supabase.from('chat_channels').delete().or(`id.eq.${scopedGroupId},id.eq.${groupId}`);
    } catch {}

    // Grava aviso de exclusão no Supabase para que todas as outras contas (ex: RH) removam o grupo imediatamente
    try {
      await supabase.from('messages').insert([
        {
          channel: getScopedChatChannel(activeEmployee?.companyId, 'geral'),
          text: `🗑️ O grupo #${groupName} foi excluído por ${activeEmployee?.name || 'Gestão'}.`,
          recipient_id: `group_deleted:${groupId}`,
          sender_id: activeEmployee?.id || 'gestor',
          sender_name: activeEmployee?.name || 'Gestor',
          sender_role: activeEmployee?.role || 'Gestor',
          sender_avatar: activeEmployee?.avatar || '',
        }
      ]);
    } catch {}

    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem(`pontuall_deleted_channels_${companyKey}`) || '[]');
      if (!deletedList.includes(groupId)) {
        deletedList.push(groupId);
        localStorage.setItem(`pontuall_deleted_channels_${companyKey}`, JSON.stringify(deletedList));
      }
    } catch {}

    const remaining = teamChannels.filter(c => c.id !== groupId);
    setTeamChannels(remaining);
    try {
      localStorage.setItem(`pontuall_team_channels_${companyKey}`, JSON.stringify(remaining));
    } catch {}

    if (activeChatChannel === groupId) {
      const visibleRemaining = remaining.filter(c => {
        if (c.id === 'geral' || c.id === 'escalas' || c.id === 'gestao') return true;
        if (!c.members || c.members.length === 0) return true;
        return Boolean(activeEmployee?.id && c.members.includes(activeEmployee.id));
      });
      if (visibleRemaining.length > 0) {
        setActiveChatChannel(visibleRemaining[0].id);
      } else {
        setActiveChatMode('direct');
      }
    }

    setIsDeletingGroup(false);
    setGroupToDelete(null);
  };

  const isOrbitStyledTab = activeTab === 'tarefas' || activeTab === 'aprovacoes' || activeTab === 'relatorios' || activeTab === 'chat' || activeTab === 'colaboradores';

  return (
    <div className={`w-full font-sans space-y-4 select-none manager-scope ${theme} ${
      isOrbitStyledTab
        ? 'bg-transparent text-slate-100 p-0 border-0 shadow-none'
        : 'bg-[#f8fafc] text-slate-900 rounded-3xl p-3 sm:p-5 shadow-2xl border border-slate-200'
    }`}>
      
      {/* 1. STICKY TOP HEADER CARD (Painel de Gestão de Escalas GESTOR + Abas Superiores) - Oculto quando abas Orbit pois já possuem headers nativos Orbit */}
      {!isOrbitStyledTab && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Título & Badge GESTOR */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Painel de Gestão de Escalas
                </h1>
                <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
                  GESTOR
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Organize turnos, aprove folgas e publique escalas corporativas
              </p>
            </div>
          </div>

          {/* ABAS SUPERIORES DO GESTOR (Exatamente como nas imagens enviadas) */}
          <div className="hidden" aria-hidden="true">
            {/* Tab 1: Grade de Escalas */}
            <button
              onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : setActiveTab('escala')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                (activeTab as string) === 'escala'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📅 Grade de Escalas</span>
            </button>

            {/* Tab 2: Aprovações & Faltas */}
            <button
              onClick={() => setActiveTab('aprovacoes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 relative ${
                (activeTab as string) === 'aprovacoes'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Aprovações & Faltas</span>
              <span className="w-4 h-4 bg-purple-600 text-white rounded-full text-[9px] font-mono flex items-center justify-center font-bold">
                {pendingRequestsCount || 4}
              </span>
            </button>

            {/* Tab 3: Relatório de Presenças */}
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                (activeTab as string) === 'relatorios'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Relatório de Presenças</span>
            </button>

            {/* Tab 4: Lembretes & Tarefas */}
            <button
              onClick={() => setActiveTab('tarefas')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                (activeTab as string) === 'tarefas'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Lembretes & Tarefas</span>
            </button>

            {/* Tab 5: Chat Equipe */}
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                (activeTab as string) === 'chat'
                  ? 'bg-white text-purple-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Chat Equipe</span>
              {unreadChatCount !== undefined && unreadChatCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-[#96183C] text-white rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {/* User Profile & Publicar Button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePublishDrafts}
              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1 font-mono"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
              <span>Publicar ({draftCount} rascunhos)</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <img
                src={activeEmployee?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee?.name || 'Gestor')}&background=96183c&color=fff&size=150`}
                alt={activeEmployee?.name || 'Gestor'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-600"
              />
              <div className="hidden lg:block text-left text-[11px] leading-tight">
                <span className="block font-black text-slate-900">{activeEmployee?.name || 'Gestão'}</span>
                <span className="text-slate-500 text-[9px] font-mono">{activeEmployee?.role || (isRh ? 'Gestora Master' : 'Gestor')}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      )}

      {/* ─── TAB 1: GRADE DE ESCALAS (FOTO 1) ─── */}
      {activeTab === 'escala' && (
        <div className="space-y-4">
          {/* BARRA DE CONTROLE & FILTROS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-extrabold">
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-slate-900 font-mono">
                  {currentWeekOffset === 0 ? 'Esta Semana' : currentWeekOffset > 0 ? `+${currentWeekOffset} sem.` : `${currentWeekOffset} sem.`}
                </span>
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                {weekRangeLabel}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className={`py-1.5 px-3 border text-xs font-bold rounded-xl outline-none cursor-pointer ${
                  isDark ? 'bg-[#181A24] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              >
                <option value="all" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Todos os Setores</option>
                {departments.map(d => (
                  <option key={d} value={d} className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>{d}</option>
                ))}
              </select>

              {!isRh && (
                <>
                  <button 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Excluir escalas em lote por período ou filtro"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Excluir Escalas</span>
                  </button>

                  <button 
                    onClick={() => onNavigateToOrbit ? onNavigateToOrbit() : null}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Abrir Templates de Escala no Calendário Orbit"
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  <button
                    onClick={handlePublishDrafts}
                    className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                    <span>Publicar Escala ({draftCount})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* MODO RASCUNHO ALERT BANNER */}
          {!isRh && !isDraftPublished && draftCount > 0 && (
            <div className="bg-amber-500 text-slate-950 p-3 sm:px-5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm border border-amber-600/30">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="w-5 h-5 rounded-full bg-slate-950/20 text-slate-950 flex items-center justify-center text-xs font-black">!</span>
                <span>
                  <strong>Modo RASCUNHO Ativo:</strong> Há {draftCount} turno(s) modificados ou criados que ainda não estão visíveis para os colaboradores.
                </span>
              </div>
              <button
                onClick={handlePublishDrafts}
                className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
              >
                Publicar Agora
              </button>
            </div>
          )}

          {/* LEGENDA DA ESCALA & DICA */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white px-4 py-2 rounded-xl border border-slate-200 text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-extrabold text-slate-900 uppercase font-mono text-[10px] tracking-wider">LEGENDA:</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Presença</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><XCircle className="w-3.5 h-3.5" /> Falta</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700"><AlertCircle className="w-3.5 h-3.5" /> Justificado</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Video className="w-3.5 h-3.5" /> Reunião c/ Link</span>
            </div>
            <div className="text-slate-400 text-[11px] font-medium hidden lg:block">
              💡 Dica: Arraste e solte os turnos entre dias ou pessoas para mover
            </div>
          </div>

          {/* TABELA MATRIZ DE COLABORADORES - estilo da imagem de referência */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-white border-b-2 border-slate-100 text-slate-500 font-sans text-[11px] font-bold uppercase tracking-wide">
                  <th className="px-4 py-3 w-[200px] border-r border-slate-100">
                    <div className="flex items-center justify-between">
                      <span>COLABORADORES ({filteredEmployees.length})</span>
                      <span className="text-[10px] text-slate-400 font-normal normal-case">Carga / Sem.</span>
                    </div>
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.dateStr} className="px-2 py-3 text-center border-r border-slate-100 min-w-[135px]">
                      <div className="text-slate-400 font-bold text-[10px] uppercase">{day.dayName}</div>
                      <div className="text-xl font-black text-slate-800 leading-tight mt-0.5">{day.dayNumber}</div>
                      <div className="text-[9px] text-slate-300 font-normal mt-0.5">8 Turnos</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const empShifts = shiftsMap[emp.id] || {};
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Coluna: Info do Colaborador */}
                      <td className="px-4 py-4 border-r border-slate-100 align-top bg-white group-hover:bg-slate-50/60">
                        <div className="flex items-start gap-3">
                          <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="block font-extrabold text-slate-900 text-[13px] leading-tight">{emp.name}</span>
                            <span className="block text-[11px] text-slate-400 font-medium mt-0.5">{emp.role}</span>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                                {emp.department ? emp.department.substring(0, 12) : 'GERAL'}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                {emp.standardHoursPerWeek || 40}h / 44h
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Colunas: Um dia da semana por coluna */}
                      {weekDays.map((day) => {
                        const dayShifts = empShifts[day.dateStr] || [];
                        return (
                          <td key={day.dateStr} className="px-2 py-3 border-r border-slate-100 align-top">
                            <div className="flex flex-col gap-2">
                              {dayShifts.map((shift) => {
                                const isDraft = shift.status === 'draft';
                                const isPresent = shift.attendanceStatus === 'present';
                                const isAbsent = shift.attendanceStatus === 'absent';
                                const isJustified = shift.attendanceStatus === 'justified';
                                const isMeeting = shift.type === 'meeting';

                                // Card border-left color
                                const borderColor = isDraft
                                  ? 'border-l-amber-400'
                                  : isPresent
                                  ? 'border-l-emerald-400'
                                  : isAbsent
                                  ? 'border-l-rose-400'
                                  : isMeeting
                                  ? 'border-l-sky-400'
                                  : 'border-l-violet-400';

                                return (
                                  <div
                                    key={shift.id}
                                    onClick={() => onOpenEditShift(shift)}
                                    className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group/card`}
                                  >
                                    {/* Hora + Link badge */}
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-mono font-extrabold text-slate-600">
                                        {shift.startTime} – {shift.endTime}
                                      </span>
                                      {isMeeting && (
                                        <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.3 rounded-md border border-emerald-200">
                                          <Video className="w-2.5 h-2.5" /> Link
                                        </span>
                                      )}
                                    </div>

                                    {/* Título do turno */}
                                    <div className="font-extrabold text-[12px] text-slate-900 leading-tight line-clamp-2 mb-1.5">
                                      {shift.title || 'Turno Padrão'}
                                    </div>

                                    {/* Status pills */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                                        {(shift as any).hoursWorked || '8'}h
                                      </span>

                                      {isPresent && (
                                        <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <CheckCircle2 className="w-2.5 h-2.5" /> Presente
                                        </span>
                                      )}

                                      {isAbsent && (
                                        <span className="text-[9px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <XCircle className="w-2.5 h-2.5" /> Falta
                                        </span>
                                      )}

                                      {isJustified && (
                                        <span className="text-[9px] font-mono font-bold bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                          <AlertCircle className="w-2.5 h-2.5" /> Justificado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Botão + Adicionar */}
                              <button
                                onClick={() => onOpenCreateShift(day.dateStr, emp.id)}
                                className="w-full py-1.5 text-[10px] font-bold text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors border border-dashed border-slate-200 hover:border-violet-300 flex items-center justify-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adicionar</span>
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: APROVAÇÕES & FALTAS (ESTILO DA IMAGEM 1 COM TABELA DA IMAGEM 2) ─── */}
      {activeTab === 'aprovacoes' && (() => {
        // KPI calculations
        const pendingCount = approvalsData.filter(i => i.status === 'Pendente').length;
        const faltasCount = approvalsData.filter(i => i.status === 'Falta Lançada' || i.status === 'Recusado / Falta').length;
        const atestadosCount = approvalsData.filter(i => i.documentName && i.documentName.toLowerCase().includes('.pdf')).length;

        // Filter items
        const filteredApprovals = approvalsData.filter(row => {
          // Search filter
          if (approvalsSearch.trim()) {
            const q = approvalsSearch.toLowerCase();
            const matchName = row.employeeName.toLowerCase().includes(q);
            const matchRole = row.employeeRole.toLowerCase().includes(q);
            const matchDept = (row.employeeDept || '').toLowerCase().includes(q);
            const matchType = row.type.toLowerCase().includes(q);
            const matchReason = row.reason.toLowerCase().includes(q);
            if (!matchName && !matchRole && !matchDept && !matchType && !matchReason) return false;
          }

          // Department filter
          if (approvalsDept !== 'all' && row.employeeDept !== approvalsDept) {
            return false;
          }

          // Type filter (Todos, Trocas, Atestados Médicos, Faltas Não Justificadas, Justificados, Atrasos, Horas Extras, Folgas)
          if (approvalsTypeFilter === 'swap') {
            if (!row.type.toLowerCase().includes('troca')) return false;
          } else if (approvalsTypeFilter === 'medical') {
            if (!row.type.toLowerCase().includes('atestado') && !row.type.toLowerCase().includes('médico') && !row.type.toLowerCase().includes('ausência')) return false;
          } else if (approvalsTypeFilter === 'absent') {
            const t = row.type.toLowerCase();
            const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
            const isNaoJustificada = isExplicitNao || (t.includes('falta') && !t.includes('falta justificada'));
            if (!isNaoJustificada || row.status === 'Aprovado' || row.actionText?.toLowerCase().includes('abonad')) return false;
          } else if (approvalsTypeFilter === 'justified') {
            const t = row.type.toLowerCase();
            const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
            const isJust = (!isExplicitNao && (t === 'falta justificada' || t === 'justificado')) ||
              Boolean(row.actionText?.toLowerCase().includes('abonad')) ||
              (row.status === 'Aprovado' && (t.includes('falta') || t.includes('atraso')));
            if (!isJust) return false;
          } else if (approvalsTypeFilter === 'delay') {
            if (!row.type.toLowerCase().includes('atraso')) return false;
          } else if (approvalsTypeFilter === 'overtime') {
            if (!row.type.toLowerCase().includes('hora extra') && !row.type.toLowerCase().includes('extra')) return false;
          } else if (approvalsTypeFilter === 'time_off') {
            if (!row.type.toLowerCase().includes('folga') && !row.type.toLowerCase().includes('dispensa')) return false;
          }

          // Tab filter (Todos, Pendentes, Aprovados, Faltas / Recusados)
          if (approvalsFilterTab === 'pending') {
            return row.status === 'Pendente';
          }
          if (approvalsFilterTab === 'approved') {
            return row.status === 'Aprovado';
          }
          if (approvalsFilterTab === 'rejected') {
            return row.status === 'Recusado / Falta' || row.status === 'Falta Lançada';
          }
          return true;
        });

        return (
          <div className="approvals-page approvals-attendance-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
            <div 
              className="approvals-light-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
                filter: 'blur(90px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner (Suporta Dark e Light) */}
            <div 
              className={`approvals-hero approvals-light-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
                isDark 
                  ? 'border-white/10' 
                  : 'border-slate-200'
              }`}
              style={{ 
                backgroundColor: isDark ? '#111216' : '#ffffff',
                boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)'
              }}
            >
              {/* Feixe quente alaranjado/vermelho */}
              <div 
                className="approvals-light-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
                    : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
                  filter: 'blur(60px)',
                }}
              />

              <div className="approvals-light-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="approvals-light-hero-copy max-w-xl space-y-2">
                  <div className={`approvals-light-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
                  }`}>
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                    CENTRAL DE GESTÃO & AUDITORIA DE PONTO
                  </div>
                  <h1 className={`approvals-light-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Aprovações e{' '}
                    <span style={{
                      background: 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Faltas
                    </span>
                  </h1>
                  
                  <p className={`approvals-light-description text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Central unificada para análise de atestados médicos, gestão de ocorrências, homologação de justificativas e aprovação de trocas de escala em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleOpenExportModal('approvals')}
                    className="approvals-light-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)'
                    }}
                    title="Exportar folha mensal consolidada de aprovações e faltas em CSV"
                  >
                    <Download className="w-4 h-4" /> Exportar Relatório CSV
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards Estilo Widget com suporte a Dark e Light */}
            <div className="approvals-light-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {[
                { 
                  label: 'Pendentes de Aprovação', 
                  value: String(pendingCount).padStart(2, '0'), 
                  sub: 'Requer atenção imediata', 
                  dotColor: '#ff601f', 
                  dotGlow: '#ff601f',
                  hasDotInSub: true
                },
                { 
                  label: 'Faltas Registradas no Mês', 
                  value: String(faltasCount).padStart(2, '0'), 
                  sub: '-25% em relação ao mês anterior', 
                  dotColor: '#e90045', 
                  dotGlow: '#e90045',
                  hasDotInSub: false
                },
                { 
                  label: 'Atestados Anexados', 
                  value: String(Math.max(atestadosCount, 8)).padStart(2, '0'), 
                  sub: 'Comprovantes anexados pelo colaborador', 
                  dotColor: '#38bdf8', 
                  dotGlow: '#38bdf8',
                  hasDotInSub: false
                },
                { 
                  label: 'Taxa de Assiduidade', 
                  value: '96%', 
                  sub: '▲ Meta atingida (+2%)', 
                  dotColor: '#49d982', 
                  dotGlow: '#49d982',
                  hasDotInSub: false
                },
              ].map((kpi, i) => (
                <div 
                  key={i} 
                  className={`approval-kpi approvals-light-kpi p-5 rounded-2xl border space-y-2 transition-transform hover:-translate-y-1 ${
                    isDark 
                      ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]' 
                      : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                  }`}
                  style={{ boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.04)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`approvals-light-kpi-label text-[11px] font-semibold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>{kpi.label}</span>
                    <span 
                      className="approvals-light-kpi-dot w-2.5 h-2.5 rounded-full" 
                      style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                    />
                  </div>
                  <div className={`approvals-light-kpi-value text-3xl font-extrabold font-sans ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>{kpi.value}</div>
                  <span className={`approvals-light-kpi-sub text-[11px] font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {kpi.hasDotInSub && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59242]" />
                    )}
                    {kpi.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Filter Bar (Busca e Departamentos com suporte a Dark e Light) */}
            <div 
              className={`approval-filter-bar approvals-light-filter p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
                isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className={`approvals-light-search-icon w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="text"
                    value={approvalsSearch}
                    onChange={(e) => setApprovalsSearch(e.target.value)}
                    placeholder="Buscar por colaborador..."
                    className={`approvals-light-search w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors border ${
                      isDark
                        ? 'bg-[#0e0f12] text-white placeholder:text-slate-500 border-[#282a33] focus:border-[#F59242]'
                        : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border-slate-200 focus:border-[#96183c]'
                    }`}
                  />
                </div>
                <select
                  value={approvalsDept}
                  onChange={(e) => setApprovalsDept(e.target.value)}
                  className={`approvals-light-department py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer border ${
                    isDark
                      ? 'bg-[#0e0f12] text-white border-[#282a33]'
                      : 'bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all" className={isDark ? "bg-[#0e0f12] text-white" : "bg-white text-slate-800"}>Todos os Departamentos</option>
                  {departments.map(d => (
                    <option key={d} value={d} className={isDark ? "bg-[#0e0f12] text-white" : "bg-white text-slate-800"}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pílulas de Categoria Rápida (Filtros da parte de baixo com Bordô no estado ativo) */}
            <div className="flex flex-wrap items-center gap-2 relative z-10">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'delay', label: 'Atrasos de Entrada' },
                { id: 'overtime', label: 'Horas Extras' },
                { id: 'medical', label: 'Atestados Médicos' },
                { id: 'absent', label: 'Faltas Não Justificadas' },
                { id: 'justified', label: 'Justificados' },
                { id: 'swap', label: 'Trocas de Turno' },
                { id: 'time_off', label: 'Folgas / Dispensas' },
              ].map(cat => {
                const isActive = approvalsTypeFilter === cat.id;
                const count = approvalsData.filter(row => {
                  if (cat.id === 'all') return true;
                  if (cat.id === 'delay') return row.type.toLowerCase().includes('atraso');
                  if (cat.id === 'overtime') return row.type.toLowerCase().includes('hora extra') || row.type.toLowerCase().includes('extra');
                  if (cat.id === 'medical') return row.type.toLowerCase().includes('atestado') || row.type.toLowerCase().includes('médico');
                  if (cat.id === 'absent') {
                    const t = row.type.toLowerCase();
                    const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
                    const isNaoJustificada = isExplicitNao || (t.includes('falta') && !t.includes('falta justificada'));
                    return isNaoJustificada && row.status !== 'Aprovado' && !row.actionText?.toLowerCase().includes('abonad');
                  }
                  if (cat.id === 'justified') {
                    const t = row.type.toLowerCase();
                    const isExplicitNao = t.includes('não justificada') || t.includes('nao justificada');
                    return (!isExplicitNao && (t === 'falta justificada' || t === 'justificado')) ||
                      Boolean(row.actionText?.toLowerCase().includes('abonad')) ||
                      (row.status === 'Aprovado' && (t.includes('falta') || t.includes('atraso')));
                  }
                  if (cat.id === 'swap') return row.type.toLowerCase().includes('troca');
                  if (cat.id === 'time_off') return row.type.toLowerCase().includes('folga') || row.type.toLowerCase().includes('dispensa');
                  return true;
                }).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setApprovalsTypeFilter(cat.id as any)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? 'text-white border-[#80142B] font-black'
                        : isDark
                        ? 'bg-[#15161b] text-slate-400 hover:text-white border-[#282a33] hover:border-[#3b3e4c]'
                        : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:border-slate-300'
                    }`}
                    style={
                      isActive
                        ? { background: 'linear-gradient(135deg, #640C1E 0%, #9F243C 100%)', boxShadow: '0 4px 14px rgba(100, 12, 30, 0.35)' }
                        : undefined
                    }
                  >
                    <span>{cat.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-black/25 text-[#F9DE97]'
                        : isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Data Table com suporte total a Light e Dark Mode */}
            <div 
              className={`approval-table-card approvals-light-table rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
                isDark 
                  ? 'bg-[#15161b] border-[#282a33] shadow-xl' 
                  : 'bg-white border-slate-200 shadow-md'
              }`}
            >
              <table className="approvals-light-data w-full border-collapse text-left text-xs font-sans min-w-[780px]">
                <thead>
                  <tr 
                    className={`border-b font-mono text-[10px] uppercase ${
                      isDark 
                        ? 'border-[#282a33] text-slate-400 bg-[#101115]' 
                        : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}
                  >
                    <th className="p-3">COLABORADOR</th>
                    <th className="p-3">TIPO & JUSTIFICATIVA</th>
                    <th className="p-3">DATA</th>
                    <th className="p-3 text-center">COMPROVANTE</th>
                    <th className="p-3 text-center">STATUS</th>
                    <th className="p-3">OBSERVAÇÃO / FEEDBACK</th>
                    <th 
                      className={`p-3 text-right pr-4 sticky right-0 z-20 shadow-[-6px_0_12px_rgba(0,0,0,0.08)] ${
                        isDark ? 'bg-[#101115]' : 'bg-slate-50'
                      }`}
                    >
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`p-8 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Nenhuma solicitação ou ocorrência encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredApprovals.map((row) => (
                      <tr 
                        key={row.id} 
                        className={`approvals-light-row border-b transition-colors ${
                          isDark 
                            ? 'border-white/5 hover:bg-white/[0.03] text-slate-200' 
                            : 'border-slate-100 hover:bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        {/* Colaborador */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img 
                              src={row.employeeAvatar} 
                              alt={row.employeeName} 
                              className={`w-8 h-8 rounded-full object-cover shrink-0 ring-2 ${
                                isDark ? 'ring-white/10' : 'ring-slate-200'
                              }`} 
                            />
                            <div>
                              <span className={`font-bold block text-xs leading-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>{row.employeeName}</span>
                              <span className={`block text-[10.5px] font-normal leading-tight mt-0.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>{row.employeeRole}</span>
                            </div>
                          </div>
                        </td>

                        {/* Tipo & Justificativa (com expandir inline e abrir modal detalhado) */}
                        <td className="p-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-bold block text-xs leading-tight ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}>{row.type}</span>
                              {row.type === 'Atraso de Entrada' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30">
                                  -35 min
                                </span>
                              )}
                              {row.type === 'Hora Extra' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                                  +39 min
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDetailOccurrence(row)}
                                className={`p-1 rounded-md transition-all cursor-pointer shadow-xs ${
                                  isDark 
                                    ? 'text-[#f89847] hover:text-[#faf0ac] bg-[#f89847]/10 hover:bg-[#f89847]/20 border border-[#f89847]/30' 
                                    : 'text-[#9F243C] hover:text-[#640C1E] bg-[#9F243C]/10 hover:bg-[#9F243C]/20 border border-[#9F243C]/25'
                                }`}
                                title="Visualizar justificativa e histórico completo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="group/reason">
                              <p className={`text-[11px] font-normal leading-relaxed max-w-[220px] truncate ${
                                isDark ? 'text-slate-300' : 'text-slate-600'
                              }`} title={row.reason}>
                                {row.reason}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Data / Período */}
                        <td className="p-3 whitespace-nowrap">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-mono text-[11px] ${
                            isDark 
                              ? 'bg-white/5 border-white/5 text-slate-300' 
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <Calendar className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{formatDateBR(row.date)}</span>
                          </div>
                        </td>

                        {/* Comprovante (Apenas ícone do clips clicável) */}
                        <td className="p-3 text-center">
                          {row.documentUrl || (row.documentName && row.documentName.toLowerCase().includes('.')) ? (
                            <button
                              type="button"
                              onClick={() => openDocumentSafe(row.documentUrl, row.documentName)}
                              className={`approvals-light-proof p-1.5 rounded-lg border hover:scale-110 active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs ${
                                isDark
                                  ? 'text-[#f89847] bg-[#f89847]/10 border-[#f89847]/25 hover:bg-[#f89847]/25'
                                  : 'text-[#96183c] bg-[#96183c]/10 border-[#96183c]/25 hover:bg-[#96183c]/20'
                              }`}
                              title={`Abrir comprovante: ${row.documentName || 'Anexo'}`}
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono select-none" title="Sem anexo">—</span>
                          )}
                        </td>

                        {/* Status (Apenas Bolinha Indicadora com Tooltip) */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center">
                            {row.status === 'Aprovado' && (
                              <span 
                                className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] inline-block cursor-help transition-transform hover:scale-125"
                                title="Aprovado"
                              />
                            )}
                            {row.status === 'Recusado / Falta' && (
                              <span 
                                className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] inline-block cursor-help transition-transform hover:scale-125"
                                title="Recusado / Falta"
                              />
                            )}
                            {row.status === 'Falta Lançada' && (
                              <span 
                                className="w-3 h-3 rounded-full bg-rose-600 shadow-[0_0_8px_#e11d48] inline-block cursor-help transition-transform hover:scale-125"
                                title="Falta Lançada"
                              />
                            )}
                            {row.status === 'Pendente' && (
                              <span 
                                className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse inline-block cursor-help transition-transform hover:scale-125"
                                title="Pendente de Homologação"
                              />
                            )}
                          </div>
                        </td>

                        {/* Observação / Feedback para o Colaborador */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.feedback}
                            onChange={(e) => handleUpdateFeedback(row.id, e.target.value)}
                            placeholder="Observação (opcional)..."
                            className={`approvals-light-feedback w-full min-w-[120px] max-w-[180px] px-2.5 py-1.5 rounded-xl text-xs outline-none transition-colors border ${
                              isDark
                                ? 'bg-[#0e0f12] border-[#282a33] focus:border-[#ff601f] text-slate-200 placeholder:text-slate-600'
                                : 'bg-slate-50 border-slate-200 focus:border-[#96183c] text-slate-800 placeholder:text-slate-400'
                            }`}
                          />
                        </td>

                        {/* Ações (Fixa sticky à direita com suporte a tema) */}
                        <td 
                          className={`p-3 text-right pr-4 sticky right-0 z-10 ${
                            isDark 
                              ? 'bg-[#15161b] shadow-[-6px_0_12px_rgba(0,0,0,0.35)]' 
                              : 'bg-white shadow-[-6px_0_12px_rgba(0,0,0,0.06)]'
                          }`}
                        >
                          {row.status === 'Pendente' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {row.type === 'Falta Não Justificada' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRejectOccurrence(row.id)}
                                  title="Descontar Falta: Confirma falta injustificada para desconto em folha (1 dia de salário + perda de DSR semanal)"
                                  className="approvals-light-reject px-3 py-1.5 border border-rose-500/40 text-rose-500 dark:text-rose-300 hover:bg-rose-500/15 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 shadow-xs"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                  <span>Descontar</span>
                                </button>
                              ) : row.type === 'Atraso de Entrada' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOccurrence(row.id)}
                                    title="Abonar Atraso: Justifica e abona os minutos de atraso (sem débito)"
                                    className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Abonar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOccurrence(row.id)}
                                    title="Debitar Atraso: Confirma débito de atraso para compensação no Banco de Horas"
                                    className="approvals-light-reject px-2 py-1.5 border border-rose-500/30 text-rose-500 dark:text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Debitar</span>
                                  </button>
                                </>
                              ) : row.type === 'Hora Extra' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOccurrence(row.id)}
                                    title="Homologar Hora Extra: Aprova para crédito no Banco de Horas ou pagamento em Folha"
                                    className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Homologar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOccurrence(row.id)}
                                    title="Ajustar Horário Normal: Trata para a jornada contratual sem gerar HE indevida (Art. 4º CLT)"
                                    className="approvals-light-reject px-2 py-1.5 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Ajustar</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOccurrence(row.id)}
                                    title="Aprovar Solicitação"
                                    className="approvals-light-approve px-2.5 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Aprovar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOccurrence(row.id)}
                                    title="Recusar Solicitação"
                                    className="approvals-light-reject px-2 py-1.5 border border-rose-500/30 text-rose-500 dark:text-rose-300 hover:bg-rose-500/10 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Recusar</span>
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px] italic">
                              {row.actionText || 'Processado'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Detalhes da Solicitação / Justificativa Completa */}
            {selectedDetailOccurrence && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
                onClick={() => setSelectedDetailOccurrence(null)}
              >
                <div 
                  className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden relative flex flex-col my-auto transition-all animate-in zoom-in-95 ${
                    isDark 
                      ? 'bg-[#15161b] border-white/10 text-white' 
                      : 'bg-white border-[#E8DCCB] text-slate-800'
                  }`}
                  style={{
                    boxShadow: isDark 
                      ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(150, 24, 60, 0.2)' 
                      : '0 20px 40px -10px rgba(100, 12, 30, 0.15)',
                    maxHeight: '92vh',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Barra de destaque superior com gradiente de assinatura */}
                  <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #96183c, #f89847, #faf0ac)" }} />

                  {/* Header */}
                  <div 
                    className={`p-5 flex items-center justify-between border-b ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                    style={{
                      background: isDark 
                        ? 'linear-gradient(135deg, #190a12 0%, #170d18 50%, #20101c 100%)' 
                        : 'linear-gradient(135deg, #FFFDF8 0%, #FCFAF5 100%)',
                    }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div>
                        <h3 className={`text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-[#640C1E]'
                        }`}>
                          {selectedDetailOccurrence.type === 'Falta Não Justificada'
                            ? 'Registro de Falta Não Justificada'
                            : selectedDetailOccurrence.type === 'Atraso de Entrada'
                            ? 'Registro de Atraso de Entrada'
                            : selectedDetailOccurrence.type === 'Hora Extra'
                            ? 'Registro de Hora Extra'
                            : 'Detalhes da Solicitação'}
                        </h3>
                        <p className={`text-xs mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {selectedDetailOccurrence.type === 'Falta Não Justificada'
                            ? 'Ocorrência apurada automaticamente após 24h sem ponto'
                            : 'Justificativa completa enviada pelo colaborador'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedDetailOccurrence(null)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Conteúdo do Modal */}
                  <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {/* Card do Colaborador */}
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={selectedDetailOccurrence.employeeAvatar} 
                          alt={selectedDetailOccurrence.employeeName} 
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-[#f89847]/40 shrink-0" 
                        />
                        <div className="min-w-0">
                          <span className={`font-bold text-sm block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {selectedDetailOccurrence.employeeName}
                          </span>
                          <span className={`text-xs block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {selectedDetailOccurrence.employeeRole} • {selectedDetailOccurrence.employeeDept}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        {selectedDetailOccurrence.status === 'Aprovado' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            Aprovado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Recusado / Falta' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                            Recusado
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Falta Lançada' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" />
                            Falta Lançada
                          </span>
                        )}
                        {selectedDetailOccurrence.status === 'Pendente' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadados: Tipo de Solicitação e Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                          TIPO DE SOLICITAÇÃO
                        </span>
                        <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedDetailOccurrence.type}
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block mb-1">
                          DATA / PERÍODO
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#f89847]" />
                          <span className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {formatDateBR(selectedDetailOccurrence.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* JUSTIFICATIVA OU SITUAÇÃO DO REGISTRO */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#f89847] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {selectedDetailOccurrence.type === 'Falta Não Justificada'
                            ? 'SITUAÇÃO DO REGISTRO DE PONTO'
                            : 'JUSTIFICATIVA DO COLABORADOR'}
                        </span>
                      </label>
                      <div className={`p-4 rounded-2xl border text-xs leading-relaxed whitespace-pre-wrap ${
                        isDark 
                          ? 'bg-[#0e0f12] border-white/10 text-slate-200' 
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        {selectedDetailOccurrence.type === 'Falta Não Justificada'
                          ? 'Turno encerrado há mais de 24 horas sem registro de ponto e sem envio de atestado/justificativa pelo colaborador.'
                          : (selectedDetailOccurrence.reason || 'Nenhuma justificativa detalhada foi fornecida.')}
                      </div>
                    </div>

                    {/* Comprovante / Anexo */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                        COMPROVANTE / DOCUMENTO ANEXO
                      </label>
                      {selectedDetailOccurrence.documentName && selectedDetailOccurrence.documentName.toLowerCase().includes('.pdf') ? (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-[#f89847]/30 bg-[#f89847]/10">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-[#f89847]" />
                            <span className="text-xs font-mono font-bold text-[#f89847]">
                              {selectedDetailOccurrence.documentName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openDocumentSafe(selectedDetailOccurrence.documentUrl, selectedDetailOccurrence.documentName)}
                            className="text-xs font-bold text-white bg-[#f89847] hover:bg-[#ff601f] px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                          >
                            Abrir Anexo
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          {selectedDetailOccurrence.documentName || 'Sem comprovante anexado'}
                        </p>
                      )}
                    </div>

                    {/* Observação / Feedback para o Colaborador */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 block">
                        OBSERVAÇÃO / FEEDBACK DO GESTOR
                      </label>
                      <textarea
                        rows={2}
                        value={selectedDetailOccurrence.feedback || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateFeedback(selectedDetailOccurrence.id, val);
                          setSelectedDetailOccurrence(prev => prev ? { ...prev, feedback: val } : null);
                        }}
                        placeholder="Insira uma observação ou orientação que o colaborador verá no portal dele..."
                        className={`w-full p-3 rounded-xl border text-xs outline-none transition-all resize-none ${
                          isDark 
                            ? 'bg-[#0e0f12] border-white/10 text-white placeholder:text-slate-600 focus:border-[#f89847]' 
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#f89847]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Footer com Ações */}
                  <div className={`p-4 sm:p-5 border-t flex items-center justify-between gap-3 ${
                    isDark ? 'border-white/10 bg-[#121318]' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOccurrence(null)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Fechar
                    </button>

                    {selectedDetailOccurrence.status === 'Pendente' ? (
                      <div className="flex items-center gap-2">
                        {selectedDetailOccurrence.type === 'Falta Não Justificada' ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleRejectOccurrence(selectedDetailOccurrence.id);
                              setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Desconto em Folha' } : null);
                            }}
                            className="px-4 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>Descontar Falta</span>
                          </button>
                        ) : selectedDetailOccurrence.type === 'Atraso de Entrada' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleRejectOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Debitado' } : null);
                              }}
                              className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Debitar Atraso</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleApproveOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Aprovado', actionText: 'Abonado' } : null);
                              }}
                              className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Abonar Atraso</span>
                            </button>
                          </>
                        ) : selectedDetailOccurrence.type === 'Hora Extra' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleRejectOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Ajustado' } : null);
                              }}
                              className="px-3.5 py-2 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Clock className="w-4 h-4" />
                              <span>Ajustar Horário Contratual</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleApproveOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Aprovado', actionText: 'Homologado' } : null);
                              }}
                              className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Homologar Hora Extra</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleRejectOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Recusado / Falta', actionText: 'Recusado agora' } : null);
                              }}
                              className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Recusar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleApproveOccurrence(selectedDetailOccurrence.id);
                                setSelectedDetailOccurrence(prev => prev ? { ...prev, status: 'Aprovado', actionText: 'Homologado agora' } : null);
                              }}
                              className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
                              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Aprovar Solicitação</span>
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-slate-400 italic">
                        Solicitação já processada ({selectedDetailOccurrence.status})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Nova Solicitação / Lançar Falta */}
            {isNewOccurrenceModalOpen && (
              <div className="approvals-light-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                <div 
                  className="approval-modal approvals-light-modal w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 shadow-2xl relative"
                  style={{ background: '#15161b' }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#e90045]" />
                      <h3 className="text-base font-bold text-white">Nova Solicitação / Lançar Falta</h3>
                    </div>
                    <button
                      onClick={() => setIsNewOccurrenceModalOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveNewOccurrence} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Colaborador</label>
                      <select
                        value={newOccurrenceForm.employeeId}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, employeeId: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.role} - {emp.department})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Tipo da Ocorrência</label>
                        <select
                          value={newOccurrenceForm.type}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, type: e.target.value })}
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        >
                          <option value="Atestado Médico">Atestado Médico</option>
                          <option value="Troca de Turno">Troca de Turno</option>
                          <option value="Folga Compensatória">Folga Compensatória</option>
                          <option value="Falta Injustificada">Falta Injustificada</option>
                          <option value="Abono Especial">Abono Especial</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Data / Período</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.date}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, date: e.target.value })}
                          placeholder="Ex: 21/09/2026"
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Motivo / Descrição</label>
                      <textarea
                        rows={2}
                        value={newOccurrenceForm.reason}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, reason: e.target.value })}
                        placeholder="Descreva o motivo informado pelo colaborador ou justificativa..."
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Comprovante / Anexo</label>
                        <input
                          type="text"
                          value={newOccurrenceForm.documentName}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, documentName: e.target.value })}
                          placeholder="Ex: atestado.pdf ou Não se aplica"
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Status Inicial</label>
                        <select
                          value={newOccurrenceForm.status}
                          onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Falta Lançada">Falta Lançada</option>
                          <option value="Recusado / Falta">Recusado / Falta</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Observação ou Feedback para o Colaborador</label>
                      <input
                        type="text"
                        value={newOccurrenceForm.feedback}
                        onChange={(e) => setNewOccurrenceForm({ ...newOccurrenceForm, feedback: e.target.value })}
                        placeholder="Observação ou feedback para o colaborador (opcional)..."
                        className="w-full px-3 py-2 bg-[#0e0f12] border border-[#282a33] rounded-xl text-white outline-none focus:border-[#ff601f]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsNewOccurrenceModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-white font-bold transition-all shadow-md cursor-pointer hover:scale-105"
                        style={{ background: 'linear-gradient(90deg, #e90045 0%, #ff601f 100%)' }}
                      >
                        Salvar Registro
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ─── TAB 3: RELATÓRIO DE PRESENÇAS (INSPIRADO NA IDENTIDADE VISUAL DA LP) ─── */}
      {activeTab === 'relatorios' && (
        <div className="attendance-report space-y-6 animate-in fade-in duration-200 relative">
          
          {/* Efeito Glow de Fundo inspirado nas imagens da LP */}
          <div 
            className="attendance-report-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(245, 146, 66, 0.16) 0%, rgba(159, 36, 60, 0.12) 45%, transparent 75%)',
              filter: 'blur(90px)',
              zIndex: 0,
            }}
          />

          {/* Hero Banner Padronizado com Suporte Completo a Dark e Light Mode */}
          <div 
            className={`approvals-hero attendance-report-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
            style={{ 
              backgroundColor: isDark ? '#111216' : '#ffffff',
              boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)'
            }}
          >
            {/* Feixe quente alaranjado/vermelho padrão */}
            <div 
              className="attendance-report-hero-glow absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
              style={{
                background: isDark
                  ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.24) 0%, rgba(100, 12, 30, 0.22) 45%, transparent 75%)'
                  : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
                filter: 'blur(60px)',
              }}
            />

            <div className="attendance-report-hero-content relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl space-y-2">
                <div className={`attendance-report-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
                }`}>
                  <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }} />
                  <span>GESTÃO INTELIGENTE DE EQUIPES</span>
                </div>
                <h1 className={`attendance-report-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Relatório de{' '}
                  <span style={{
                    background: isDark 
                      ? 'linear-gradient(90deg, #F9DE97 0%, #F59242 52%, #9F243C 100%)' 
                      : 'linear-gradient(90deg, #640C1E 0%, #9F243C 52%, #F59242 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    Presenças
                  </span>
                </h1>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Consolidação em tempo real de jornadas, faltas justificadas, assiduidade e histórico operacional.
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleOpenExportModal('attendance')}
                  className="attendance-report-export px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  style={{ 
                    background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.30)'
                  }}
                >
                  <Download className="w-4 h-4" /> Exportar Relatório CSV
                </button>
              </div>
            </div>
          </div>

          {/* Micro-aviso Sutil e Condicional: Fechamento de Mês OU Retenção de 60 Dias */}
          {(monthClosingInfo || expiringAttendanceInfo) && !isRetentionNoticeDismissed && (
            <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 text-xs relative z-10 transition-colors animate-in fade-in duration-300 ${
              isDark 
                ? 'bg-amber-950/25 border-amber-500/25 text-amber-200/90' 
                : 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-xs'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">
                  {monthClosingInfo ? (
                    <>
                      <strong className="font-semibold">Fechamento Mensal:</strong> {monthClosingInfo.isStartOfNextMonth 
                        ? `Lembre-se de salvar a folha de presenças do mês de ${monthClosingInfo.monthName} para o arquivo da empresa.` 
                        : `O mês de ${monthClosingInfo.monthName} está encerrando. Exporte a folha mensal consolidada.`}
                    </>
                  ) : (
                    <>
                      <strong className="font-semibold">Aviso de Retenção:</strong> Registros mais antigos expiram em cerca de {expiringAttendanceInfo?.daysLeft} {expiringAttendanceInfo?.daysLeft === 1 ? 'dia' : 'dias'}. Lembre-se de exportar a folha mensal.
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (monthClosingInfo) {
                      onExportCsv(monthClosingInfo.monthKey);
                      showPolishedToast({
                        title: 'Folha mensal exportada!',
                        description: `A folha consolidada de ${monthClosingInfo.monthName} foi baixada em CSV.`,
                        rimVariant: 'success',
                      });
                    } else {
                      handleOpenExportModal('attendance');
                    }
                  }}
                  className="font-bold underline hover:no-underline text-amber-600 dark:text-amber-400 shrink-0 cursor-pointer text-xs"
                >
                  {monthClosingInfo ? `Exportar ${monthClosingInfo.monthName}` : 'Exportar CSV'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDismissRetentionNotice}
                className={`p-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                  isDark ? 'text-amber-400/60 hover:text-amber-200 hover:bg-white/5' : 'text-amber-800/60 hover:text-amber-950 hover:bg-amber-100'
                }`}
                title="Dispensar aviso por 7 dias"
                aria-label="Dispensar aviso de retenção"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Relatório de Presenças da Equipe */}
          <div className="space-y-6 animate-in fade-in duration-200">
              {/* KPI Cards Estilo Widget da LP */}
              <div className="attendance-report-kpis grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                {[
                  { label: 'Taxa de Presença', value: '96%', sub: '▲ +2.4% acima da meta', dotColor: '#49d982', dotGlow: '#49d982' },
                  { label: 'Colaboradores Ativos', value: '48', sub: 'Total cadastrado na base', dotColor: '#F59242', dotGlow: '#F59242' },
                  { label: 'Escalas Hoje', value: '24', sub: 'Diurnas e noturnas', dotColor: '#F9DE97', dotGlow: '#F9DE97' },
                  { label: 'Faltas no Período', value: '02', sub: '1 abonada c/ atestado', dotColor: '#9F243C', dotGlow: '#9F243C' },
                ].map((kpi, i) => (
                  <div 
                    key={i} 
                    className={`approval-kpi attendance-report-kpi p-5 rounded-2xl border space-y-2 transition-transform hover:-translate-y-1 ${
                      isDark 
                        ? 'bg-[#15161b] border-[#282a33] hover:border-[#3b3e4c]' 
                        : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
                    }`}
                    style={{ boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`attendance-report-kpi-label text-[11px] font-semibold uppercase tracking-wider block ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>{kpi.label}</span>
                      <span 
                        className="attendance-report-kpi-dot w-2.5 h-2.5 rounded-full" 
                        style={{ background: kpi.dotColor, boxShadow: `0 0 8px ${kpi.dotGlow}` }}
                      />
                    </div>
                    <div className={`attendance-report-kpi-value text-3xl font-extrabold font-sans ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>{kpi.value}</div>
                    <span className={`attendance-report-kpi-sub text-[11px] font-medium block ${
                      isDark ? 'text-slate-500' : 'text-slate-500'
                    }`}>{kpi.sub}</span>
                  </div>
                ))}
              </div>

              {/* Filter Bar */}
              <div 
                className={`approval-filter-bar attendance-report-filters p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 transition-colors ${
                  isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`} />
                    <input
                      type="text"
                      value={relatorioSearch}
                      onChange={(e) => setRelatorioSearch(e.target.value)}
                      placeholder="Filtrar por colaborador, setor ou data (ex: 26-10-2026)..."
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors ${
                        isDark 
                          ? 'bg-[#0e0f12] text-white placeholder:text-slate-500 border border-[#282a33] focus:border-[#F59242]' 
                          : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-[#9F243C]'
                      }`}
                    />
                  </div>

                  <select
                    value={relatorioStatus}
                    onChange={(e) => setRelatorioStatus(e.target.value)}
                    className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer ${
                      isDark 
                        ? 'bg-[#0e0f12] text-white border border-[#282a33]' 
                        : 'bg-slate-50 text-slate-900 border border-slate-200'
                    }`}
                  >
                    <option value="all">Todos os Status</option>
                    <option value="present">Presente</option>
                    <option value="late">Atrasado</option>
                    <option value="absent">Ausente</option>
                    <option value="justified">Justificado</option>
                    <option value="pending">Pendente</option>
                  </select>

                  <select
                    value={relatorioDept}
                    onChange={(e) => setRelatorioDept(e.target.value)}
                    className={`py-2 px-4 text-xs font-semibold rounded-full outline-none cursor-pointer ${
                      isDark 
                        ? 'bg-[#0e0f12] text-white border border-[#282a33]' 
                        : 'bg-slate-50 text-slate-900 border border-slate-200'
                    }`}
                  >
                    <option value="all">Todos os Departamentos</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div 
                className={`attendance-report-table rounded-2xl border overflow-hidden overflow-x-auto relative z-10 transition-colors ${
                  isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <table className="w-full border-collapse text-left text-xs font-sans min-w-[800px]">
                  <thead>
                    <tr className={`border-b font-mono text-[10px] uppercase transition-colors ${
                      isDark 
                        ? 'border-[#282a33] bg-[#101115] text-slate-400' 
                        : 'border-[#640C1E]/30 bg-gradient-to-r from-[#640C1E] to-[#9F243C] text-[#F9DE97] shadow-sm'
                    }`}>
                      <th className="p-3.5 font-bold tracking-wider">DATA</th>
                      <th className="p-3.5 font-bold tracking-wider">COLABORADOR</th>
                      <th className="p-3.5 font-bold tracking-wider">DEPARTAMENTO</th>
                      <th className="p-3.5 font-bold tracking-wider">HORÁRIO</th>
                      <th className="p-3.5 font-bold tracking-wider">CARGA</th>
                      <th className="p-3.5 font-bold tracking-wider text-center">STATUS</th>
                      <th className="p-3.5 font-bold tracking-wider">TIPO</th>
                      <th className="p-3.5 font-bold tracking-wider">OBSERVAÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.filter(row => {
                      const formattedRowDate = formatDateToDDMMAAAA(row.date);
                      
                      if (relatorioDate) {
                        if (normalizeDateToISO(row.date) !== normalizeDateToISO(relatorioDate)) {
                          return false;
                        }
                      }

                      if (relatorioSearch.trim()) {
                        const q = relatorioSearch.toLowerCase().trim();
                        const matchName = row.name.toLowerCase().includes(q);
                        const matchDept = row.dept.toLowerCase().includes(q);
                        const matchRole = row.role.toLowerCase().includes(q);
                        const matchDateRaw = row.date.toLowerCase().includes(q);
                        const matchDateFormatted = formattedRowDate.toLowerCase().includes(q);
                        const matchDateSlash = formattedRowDate.replace(/-/g, '/').toLowerCase().includes(q);
                        if (!matchName && !matchDept && !matchRole && !matchDateRaw && !matchDateFormatted && !matchDateSlash) {
                          return false;
                        }
                      }

                      const matchDept = relatorioDept === 'all' || row.dept === relatorioDept;
                      const matchStatus = relatorioStatus === 'all' || 
                        (relatorioStatus === 'present' && row.status === 'Presente') ||
                        (relatorioStatus === 'late' && row.status === 'Atrasado') ||
                        (relatorioStatus === 'absent' && row.status === 'Ausente') ||
                        (relatorioStatus === 'justified' && row.status === 'Justificado') ||
                        (relatorioStatus === 'pending' && row.status === 'Pendente');
                      return matchDept && matchStatus;
                    }).map((row, idx) => (
                      <tr 
                        key={idx} 
                        className={`border-b transition-colors ${
                          isDark 
                            ? 'border-white/5 hover:bg-white/[0.03] text-slate-200' 
                            : 'border-slate-100 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className={`p-3.5 font-mono text-[11px] whitespace-nowrap ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] ${
                            isDark ? 'bg-white/5 border border-white/5 text-slate-300' : 'bg-slate-100 border border-slate-200 text-slate-700'
                          }`}>
                            <Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{formatDateToDDMMAAAA(row.date)}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-8 h-8 rounded-full p-[1.5px] shrink-0" 
                              style={{ background: 'linear-gradient(90deg, #640C1E, #9F243C, #F59242)' }}
                            >
                              <img
                                src={row.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                                alt={row.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                            <div>
                              <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</span>
                              <span className={`block text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{row.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className={`p-3.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.dept}</td>
                        <td className={`p-3.5 font-mono text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.time}</td>
                        <td className={`p-3.5 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.hours}</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center">
                            <span 
                              className="w-3 h-3 rounded-full inline-block cursor-help transition-transform hover:scale-125" 
                              style={{ 
                                background: row.status === 'Presente' 
                                  ? (row.isGpsOutside ? '#f97316' : '#49d982')
                                  : row.status === 'Atrasado' ? '#fbbf24' : row.status === 'Ausente' ? '#ef4444' : row.status === 'Justificado' ? '#38bdf8' : '#94a3b8',
                                boxShadow: `0 0 8px ${row.status === 'Presente' ? (row.isGpsOutside ? '#f97316' : '#49d982') : row.status === 'Atrasado' ? '#fbbf24' : row.status === 'Ausente' ? '#ef4444' : row.status === 'Justificado' ? '#38bdf8' : '#94a3b8'}`
                              }} 
                              title={
                                row.status === 'Presente' && row.isGpsOutside
                                  ? `Presente (Fora do Posto${row.gpsDist ? ` • ${row.gpsDist}` : ''})`
                                  : row.status === 'Presente'
                                  ? 'Presente (No Posto)'
                                  : row.status
                              }
                            />
                          </div>
                        </td>
                        <td className={`p-3.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.type}</td>
                        <td className={`p-3.5 text-[11px] max-w-[280px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          <div className="flex items-center gap-2 truncate" title={row.obsFull || row.cleanObs}>
                            {row.isGpsOutside && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <MapPin className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span>Fora do posto {row.gpsDist ? `(${row.gpsDist})` : ''}</span>
                              </span>
                            )}
                            <span className="truncate text-slate-400 text-[11px]">{row.cleanObs}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      )}

      {/* ─── TAB 4: LEMBRETES & TAREFAS (ESTILO DAS FOTOS / IDENTIDADE VISUAL LP) ─── */}
      {activeTab === 'tarefas' && (() => {
        const filteredReminders = reminders.filter((rem) => {
          // Ocultar automaticamente lembretes com mais de 60 dias
          const cutoff60 = toLocalDateString(addDaysLocal(new Date(), -60));
          const remDateISO = normalizeDateToISO(rem.date);
          if (remDateISO && remDateISO < cutoff60) return false;

          if (reminderFilterType !== 'all' && rem.type !== reminderFilterType) return false;
          if (reminderCollaboratorFilter !== 'all') {
            if (!rem.assignedEmployeeIds || !rem.assignedEmployeeIds.includes(reminderCollaboratorFilter)) {
              return false;
            }
          }
          if (reminderSearch.trim()) {
            const q = reminderSearch.toLowerCase();
            const matchesAssigned = rem.assignedEmployeeIds?.some(empId => {
              const emp = allAssignablePeople.find(e => e.id === empId);
              return emp && (
                (emp.name || '').toLowerCase().includes(q) ||
                (emp.role || '').toLowerCase().includes(q) ||
                (emp.department || '').toLowerCase().includes(q)
              );
            });
            return (
              rem.title.toLowerCase().includes(q) ||
              rem.description.toLowerCase().includes(q) ||
              rem.tag.toLowerCase().includes(q) ||
              (rem.assigneeName && rem.assigneeName.toLowerCase().includes(q)) ||
              Boolean(matchesAssigned)
            );
          }
          return true;
        });

        const getTypeBadge = (type: string) => {
          switch (type) {
            case 'reuniao':
              return {
                label: 'Reunião',
                dotColor: '#7c5cbf',
                accentColor: '#7c5cbf',
                bg: 'rgba(124, 92, 191, 0.10)',
                border: 'rgba(124, 92, 191, 0.22)',
                text: '#b49de0'
              };
            case 'plantao':
              return {
                label: 'Plantão',
                dotColor: '#b58e1a',
                accentColor: '#b58e1a',
                bg: 'rgba(181, 142, 26, 0.10)',
                border: 'rgba(181, 142, 26, 0.22)',
                text: '#d4a832'
              };
            case 'treinamento':
              return {
                label: 'Treinamento',
                dotColor: '#2d7fa8',
                accentColor: '#2d7fa8',
                bg: 'rgba(45, 127, 168, 0.10)',
                border: 'rgba(45, 127, 168, 0.22)',
                text: '#6db8d8'
              };
            default:
              return {
                label: 'Atividade',
                dotColor: '#c0541a',
                accentColor: '#c0541a',
                bg: 'rgba(192, 84, 26, 0.10)',
                border: 'rgba(192, 84, 26, 0.22)',
                text: '#d97c44'
              };
          }
        };

        return (
          <div className="approvals-page reminders-page w-full space-y-6 animate-in fade-in duration-200 relative">
            
            {/* Efeito Glow de Fundo suave */}
            <div 
              className="reminders-background-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(245, 146, 66, 0.10) 0%, rgba(159, 36, 60, 0.07) 45%, transparent 75%)',
                filter: 'blur(90px)',
                zIndex: 0,
              }}
            />

            {/* Hero Banner (Suporta Dark e Light) */}
            <div 
              className={`approvals-hero reminders-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
              style={{ 
                backgroundColor: isDark ? '#111216' : '#ffffff',
                boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)'
              }}
            >
              {/* Feixe quente suavizado */}
              <div 
                className="reminders-hero-flare absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.16) 0%, rgba(100, 12, 30, 0.18) 45%, transparent 75%)'
                    : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
                  filter: 'blur(60px)',
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
                  }`}>
                    <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640c1e, #9F243C, #F59242)' }} />
                    <span>GESTÃO OPERACIONAL & ROTINA</span>
                  </div>
                  <h1 className={`reminders-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Lembretes e{' '}
                    <span className={`reminders-title-highlight inline-block bg-clip-text text-transparent ${
                      isDark
                        ? 'bg-gradient-to-r from-[#F9DE97] via-[#F59242] to-[#9F243C]'
                        : 'bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242]'
                    }`} style={{
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      color: 'transparent'
                    }}>
                      Tarefas
                    </span>
                  </h1>
                  <p className={`reminders-description text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600 font-medium'
                  }`}>
                    Organize reuniões operacionais, controle prazos de publicação de escalas e monitore tarefas de alinhamento com a equipe em tempo real.
                  </p>
                </div>

                <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={handleOpenNewReminderModal}
                    className="reminders-primary-button px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 56%, #F59242 100%)',
                      boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)'
                    }}
                  >
                    <Plus className="w-4 h-4" /> Novo Lembrete / Tarefa
                  </button>
                </div>
              </div>
            </div>

                        {/* Aviso de Retenção de 60 Dias em Lembretes */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs relative z-10 ${
              isDark ? 'bg-amber-950/20 border-amber-500/20 text-slate-300' : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#F59242] shrink-0" />
                <span>
                  <strong>Política de Retenção de 60 Dias:</strong> Lembretes anteriores a 60 dias são automaticamente ocultados/expurgados. Você também pode excluir lembretes individualmente a qualquer momento.
                </span>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#F59242]/10 text-[#F59242] font-bold border border-[#F59242]/20 shrink-0 hidden sm:inline-block">
                Expiração 60d
              </span>
            </div>

            {/* Filter Bar (Suporta Dark e Light) */}
            <div 
              className={`approval-filter-bar reminders-filter-bar p-3.5 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 ${
                isDark ? 'border-[#282a33]' : 'border-slate-200 shadow-xs'
              }`} 
              style={{ background: isDark ? '#15161b' : '#ffffff' }}
            >
              {/* Search */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className={`reminders-search-icon w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={reminderSearch}
                  onChange={(e) => setReminderSearch(e.target.value)}
                  placeholder="Buscar tarefas por título, pauta, tag ou colaborador..."
                  className={`reminders-search-input w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors border ${
                    isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                  style={{ 
                    background: isDark ? '#0e0f12' : '#f8fafc', 
                    border: isDark ? '1px solid #282a33' : '1px solid #e2e8f0' 
                  }}
                />
              </div>

              {/* Type Filter Pills */}
              <div className={`reminders-type-filter flex items-center gap-1 p-1 rounded-full border overflow-x-auto custom-scrollbar ${
                isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-100 border-slate-200'
              }`}>
                {[
                  { id: 'all', label: 'Todos os Tipos' },
                  { id: 'reuniao', label: 'Reuniões' },
                  { id: 'atividade', label: 'Atividades' },
                  { id: 'plantao', label: 'Plantões' },
                  { id: 'treinamento', label: 'Treinamentos' },
                ].map((tab) => {
                  const isActive = reminderFilterType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setReminderFilterType(tab.id)}
                      data-active={isActive ? 'true' : 'false'}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'shadow-md'
                          : isDark
                          ? 'text-slate-300 hover:text-[#F9DE97]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                      style={
                        isActive 
                          ? { background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 100%)', color: '#F9DE97', boxShadow: '0 2px 10px rgba(100, 12, 30, 0.4)' } 
                          : undefined
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Filter by allocated collaborator */}
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${
                isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-100 border-slate-200'
              }`}>
                <Users className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#F59242]' : 'text-[#96183c]'}`} />
                <select
                  value={reminderCollaboratorFilter}
                  onChange={(e) => setReminderCollaboratorFilter(e.target.value)}
                  className={`bg-transparent text-xs font-semibold outline-none cursor-pointer pr-1 ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                >
                  <option value="all" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>
                    Todos os Responsáveis
                  </option>
                  {allAssignablePeople.map((emp) => (
                    <option key={emp.id} value={emp.id} className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid de Cards de Tarefas (Identidade Visual Dark e Light) */}
            {filteredReminders.length === 0 ? (
              <div className={`reminders-empty-state flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-3xl relative z-10 ${
                isDark ? 'border-[#282a33] bg-[#15161b]' : 'border-slate-300 bg-white shadow-xs'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-white/5' : 'bg-slate-100'
                }`}>
                  <Sparkles className={`w-6 h-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Nenhum lembrete ou tarefa encontrado
                </h3>
                <p className={`text-xs mt-1 max-w-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  {reminderSearch || reminderCollaboratorFilter !== 'all' 
                    ? 'Tente ajustar sua busca ou limpar os filtros de colaboradores.' 
                    : 'Clique em "Novo Lembrete / Tarefa" para criar seu primeiro compromisso.'}
                </p>
              </div>
            ) : (
              <div className="reminders-grid grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                {filteredReminders.map((rem) => {
                  const badge = getTypeBadge(rem.type);
                  const allocatedPeople = (rem.assignedEmployeeIds || [])
                    .map(id => allAssignablePeople.find(p => p.id === id))
                    .filter(Boolean) as Employee[];

                  return (
                    <div
                      key={rem.id}
                      className={`reminders-task-card group relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                        rem.completed
                          ? isDark ? 'bg-[#15161b]/60 border-[#282a33]/60 opacity-75 hover:opacity-100' : 'bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-100'
                          : isDark ? 'bg-[#15161b] border-[#282a33] hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
                      }`}
                      data-reminder-type={rem.type}
                      style={{ 
                        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)',
                        borderLeft: rem.completed ? undefined : `3px solid ${badge.accentColor}`,
                      }}
                    >
                      {/* Top Header: Badge, Tag & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="reminder-type-badge inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                            data-reminder-type={rem.type}
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            <span 
                              className="w-1.5 h-1.5 rounded-full" 
                              style={{ background: badge.dotColor }} 
                            />
                            {badge.label}
                          </span>
                          <span className={`reminder-tag text-[11px] font-mono px-2.5 py-0.5 rounded-lg border ${
                            isDark ? 'text-slate-400 bg-[#0e0f12] border-[#282a33]' : 'text-slate-600 bg-slate-100 border-slate-200'
                          }`}>
                            #{rem.tag}
                          </span>
                        </div>

                        {/* Actions: Toggle Complete, Edit & Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              const newStatus = !rem.completed;
                              setReminders(prev => prev.map(r => r.id === rem.id ? { ...r, completed: newStatus } : r));
                              await toggleCompletedSupabase(rem.id, rem.completed);
                            }}
                            title={rem.completed ? "Marcar como pendente" : "Marcar como concluída"}
                            data-completed={rem.completed ? 'true' : 'false'}
                            className={`reminders-complete-button p-1.5 rounded-lg transition-colors cursor-pointer ${
                              rem.completed
                                ? isDark
                                  ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30'
                                  : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                                : isDark
                                ? 'text-slate-400 hover:text-emerald-400 hover:bg-white/5 border border-white/5'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditReminderModal(rem)}
                            title="Editar lembrete / alocar pessoas"
                            className={`reminders-edit-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                              isDark
                                ? 'text-slate-400 hover:text-[#F59242] hover:bg-white/5 border-transparent hover:border-[#F59242]/20'
                                : 'text-slate-400 hover:text-[#9F243C] hover:bg-slate-100 border-transparent hover:border-slate-300'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Deseja realmente excluir o lembrete individual "${rem.title}"? Esta ação é definitiva.`)) {
                                setReminders(prev => prev.filter(r => r.id !== rem.id));
                                await deleteReminderSupabase(rem.id);
                                showPolishedToast({
                                  id: `del-rem-${rem.id}`,
                                  title: 'Lembrete Excluído',
                                  description: `O lembrete "${rem.title}" foi excluído com sucesso.`,
                                  rimVariant: 'destructive',
                                });
                              }
                            }}
                            title="Excluir este lembrete individualmente"
                            className={`reminders-delete-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                              isDark
                                ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-transparent hover:border-rose-500/25'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-300'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content: Title & Description */}
                      <div className="space-y-1.5 mb-2">
                        <h3 className={`reminders-task-title font-bold text-sm tracking-tight leading-snug transition-colors ${
                          rem.completed ? 'text-slate-400 line-through' : isDark ? 'text-white group-hover:text-slate-200' : 'text-slate-900 group-hover:text-slate-700'
                        }`}>
                          {rem.title}
                        </h3>
                        <p className={`reminders-task-description text-xs leading-relaxed line-clamp-2 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {rem.description}
                        </p>
                      </div>

                      {/* Allocated Collaborators Banner */}
                      <div className={`my-2.5 p-2 rounded-xl border flex items-center justify-between gap-2.5 ${
                        isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {allocatedPeople.length > 0 ? (
                            <div className="flex items-center shrink-0">
                              <div className="flex -space-x-1.5 overflow-hidden">
                                {allocatedPeople.slice(0, 3).map((person, idx) => (
                                  <img
                                    key={person.id || idx}
                                    src={person.avatar}
                                    alt={person.name}
                                    title={`${person.name} • ${person.role} (${person.department})`}
                                    className={`inline-block w-6 h-6 rounded-full ring-2 object-cover ${
                                      isDark ? 'ring-[#15161b]' : 'ring-white'
                                    }`}
                                  />
                                ))}
                              </div>
                              {allocatedPeople.length > 3 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                  isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  +{allocatedPeople.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                              isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'
                            }`}>
                              <Users className="w-3 h-3" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className={`text-[9px] uppercase font-bold tracking-wider block font-mono ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {allocatedPeople.length === 1 
                                ? 'Pessoa Alocada' 
                                : allocatedPeople.length > 1 
                                ? `${allocatedPeople.length} Pessoas Alocadas` 
                                : 'Equipe / Responsáveis'}
                            </span>
                            <span 
                              className={`font-medium truncate block text-xs ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`} 
                              title={allocatedPeople.length > 0 ? allocatedPeople.map(p => p.name).join(', ') : rem.assigneeName || 'Equipe Geral'}
                            >
                              {allocatedPeople.length > 0 
                                ? allocatedPeople.map(p => p.name).join(', ') 
                                : (rem.assigneeName || 'Equipe Geral')}
                            </span>
                          </div>
                        </div>

                        {allocatedPeople.length > 0 ? (
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono border ${
                            isDark ? 'text-[#F9DE97] bg-[#F59242]/10 border-[#F59242]/20' : 'text-amber-800 bg-amber-50 border-amber-200'
                          }`}>
                            {allocatedPeople.length === 1 ? '1 alocado' : `${allocatedPeople.length} alocados`}
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono border ${
                            isDark ? 'text-slate-400 bg-white/5 border-white/10' : 'text-slate-600 bg-slate-200 border-slate-300'
                          }`}>
                            Geral
                          </span>
                        )}
                      </div>

                      {/* Footer Row: Date, Time & Meeting Link */}
                      <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isDark ? 'border-white/5' : 'border-slate-100'
                      }`}>
                        <div className={`flex items-center gap-2 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <Calendar className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{formatDateBR(rem.date)}</span>
                          </div>
                          <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            <Clock className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                            <span>{rem.time}</span>
                          </div>
                        </div>

                        {rem.link ? (
                          <a
                            href={rem.link}
                            target="_blank"
                            rel="noreferrer"
                            className="reminder-call-button px-3.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all hover:opacity-80 shadow-sm text-white"
                            style={{
                              background: '#1d5c42',
                              border: '1px solid rgba(16,185,129,0.25)',
                            }}
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Acessar Chamada</span>
                          </a>
                        ) : (
                          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {rem.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal para Novo Lembrete / Tarefa ou Edição com Alocação de Pessoas */}
            {isNewReminderModalOpen && (
              <div
                className="reminders-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
                onClick={() => {
                  setIsNewReminderModalOpen(false);
                  setEditingReminderId(null);
                }}
              >
                <div
                  className={`reminders-modal relative w-full max-w-xl max-h-[90vh] rounded-3xl border shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 my-auto ${
                    isDark ? 'border-white/10 bg-[#15161b] text-white' : 'border-slate-200 bg-white text-slate-900'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${
                    isDark ? 'border-white/10' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#F59242]" />
                      <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {editingReminderId ? 'Editar Lembrete / Tarefa' : 'Criar Novo Lembrete / Tarefa'}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setIsNewReminderModalOpen(false);
                        setEditingReminderId(null);
                      }}
                      className={`reminders-modal-close w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Form Scrollable */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newReminderData.title.trim()) return;

                      const assignedNames = newReminderData.assignedEmployeeIds
                        .map(id => allAssignablePeople.find(p => p.id === id)?.name)
                        .filter(Boolean) as string[];

                      const computedAssigneeName = assignedNames.length > 0 
                        ? assignedNames.join(', ') 
                        : 'Equipe Geral';

                      const reminderPayload: Partial<ReminderItem> = {
                        type: newReminderData.type,
                        tag: newReminderData.tag.trim() || 'Geral',
                        title: newReminderData.title.trim(),
                        description: newReminderData.description.trim() || 'Sem descrição adicional.',
                        date: newReminderData.date,
                        time: newReminderData.time,
                        link: newReminderData.link.trim() || undefined,
                        assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                        assigneeName: computedAssigneeName,
                      };

                      if (editingReminderId) {
                        const updated = await updateReminderSupabase(editingReminderId, reminderPayload);
                        setReminders(prev => prev.map(r => r.id === editingReminderId ? {
                          ...r,
                          ...(updated || reminderPayload)
                        } : r));
                      } else {
                        const created = await createReminderSupabase(
                          {
                            ...reminderPayload,
                            completed: false,
                          },
                          {
                            creatorId: activeEmployee?.id,
                            companyId: activeEmployee?.companyId
                          }
                        );
                        if (created) {
                          setReminders(prev => [created, ...prev]);
                        } else {
                          setReminders(prev => [
                            {
                              id: `rem-${Date.now()}`,
                              type: newReminderData.type,
                              tag: newReminderData.tag.trim() || 'Geral',
                              title: newReminderData.title.trim(),
                              description: newReminderData.description.trim() || 'Sem descrição adicional.',
                              date: newReminderData.date,
                              time: newReminderData.time,
                              link: newReminderData.link.trim() || undefined,
                              assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                              assigneeName: computedAssigneeName,
                              completed: false,
                            },
                            ...prev
                          ]);
                        }
                      }

                      setIsNewReminderModalOpen(false);
                      setEditingReminderId(null);
                    }}
                    className="space-y-4 text-xs overflow-y-auto pr-1 flex-1"
                  >
                    <div>
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        TÍTULO DO COMPROMISSO
                      </label>
                      <input
                        type="text"
                        required
                        value={newReminderData.title}
                        onChange={(e) => setNewReminderData({ ...newReminderData, title: e.target.value })}
                        placeholder="Ex: Alinhamento de Metas Mensais"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                          isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          TIPO
                        </label>
                        <select
                          value={newReminderData.type}
                          onChange={(e) => setNewReminderData({ ...newReminderData, type: e.target.value as any })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        >
                          <option value="atividade" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Atividade Operacional</option>
                          <option value="reuniao" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Reunião de Equipe</option>
                          <option value="plantao" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Plantão / Sobreaviso</option>
                          <option value="treinamento" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Treinamento / Onboarding</option>
                        </select>
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          TAG / PROJETO
                        </label>
                        <input
                          type="text"
                          value={newReminderData.tag}
                          onChange={(e) => setNewReminderData({ ...newReminderData, tag: e.target.value })}
                          placeholder="Ex: Gestão, Suporte, Metas"
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          DATA
                        </label>
                        <input
                          type="date"
                          value={newReminderData.date}
                          onChange={(e) => setNewReminderData({ ...newReminderData, date: e.target.value })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        />
                      </div>

                      <div>
                        <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          HORÁRIO
                        </label>
                        <input
                          type="time"
                          value={newReminderData.time}
                          onChange={(e) => setNewReminderData({ ...newReminderData, time: e.target.value })}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                            isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        />
                      </div>
                    </div>

                    {/* ALOCAR PESSOAS / COLABORADORES RESPONSÁVEIS */}
                    <div className={`rounded-2xl border p-3.5 space-y-3 ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className={`w-4 h-4 ${isDark ? 'text-[#F59242]' : 'text-[#9F243C]'}`} />
                          <div>
                            <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              ALOCAR PESSOAS PARA A TAREFA
                            </span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Selecione uma ou mais pessoas da equipe
                            </span>
                          </div>
                        </div>

                        {/* Quick Selection Actions */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setNewReminderData(prev => ({
                                ...prev,
                                assignedEmployeeIds: allAssignablePeople.map(p => p.id)
                              }));
                            }}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                          >
                            Selecionar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewReminderData(prev => ({
                                ...prev,
                                assignedEmployeeIds: []
                              }));
                            }}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-rose-600'
                            }`}
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {/* Mini Search inside modal */}
                      <div className="relative">
                        <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`} />
                        <input
                          type="text"
                          value={collaboratorSearchInModal}
                          onChange={(e) => setCollaboratorSearchInModal(e.target.value)}
                          placeholder="Buscar colaborador por nome, cargo ou setor..."
                          className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#F59242] transition-colors border ${
                            isDark ? 'bg-[#15161b] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>

                      {/* Selected Chips */}
                      {newReminderData.assignedEmployeeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newReminderData.assignedEmployeeIds.map(id => {
                            const person = allAssignablePeople.find(p => p.id === id);
                            if (!person) return null;
                            return (
                              <span
                                key={id}
                                className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                  isDark ? 'bg-[#F59242]/15 border-[#F59242]/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
                                }`}
                              >
                                <img
                                  src={person.avatar}
                                  alt={person.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                                <span>{person.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewReminderData(prev => ({
                                      ...prev,
                                      assignedEmployeeIds: prev.assignedEmployeeIds.filter(item => item !== id)
                                    }));
                                  }}
                                  className="hover:opacity-75 transition-opacity cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Collaborator Grid / List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allAssignablePeople
                          .filter(p => {
                            if (!collaboratorSearchInModal.trim()) return true;
                            const query = collaboratorSearchInModal.toLowerCase();
                            return (
                              (p.name || '').toLowerCase().includes(query) ||
                              (p.role || '').toLowerCase().includes(query) ||
                              (p.department || '').toLowerCase().includes(query)
                            );
                          })
                          .map((person) => {
                            const isSelected = newReminderData.assignedEmployeeIds.includes(person.id);
                            return (
                              <div
                                key={person.id}
                                onClick={() => {
                                  setNewReminderData(prev => {
                                    const exists = prev.assignedEmployeeIds.includes(person.id);
                                    return {
                                      ...prev,
                                      assignedEmployeeIds: exists
                                        ? prev.assignedEmployeeIds.filter(id => id !== person.id)
                                        : [...prev.assignedEmployeeIds, person.id]
                                    };
                                  });
                                }}
                                className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                                  isSelected
                                    ? isDark ? 'bg-[#F59242]/15 border-[#F59242] shadow-sm' : 'bg-amber-50 border-amber-400 shadow-xs'
                                    : isDark ? 'bg-[#15161b] border-[#282a33] hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-[#F59242] border-[#F59242] text-black font-bold'
                                    : isDark ? 'border-slate-600 bg-black/40' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>

                                <img
                                  src={person.avatar}
                                  alt={person.name}
                                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                                />

                                <div className="min-w-0 flex-1">
                                  <span className={`block font-semibold text-xs truncate ${
                                    isSelected ? (isDark ? 'text-white' : 'text-slate-900 font-bold') : (isDark ? 'text-slate-200' : 'text-slate-800')
                                  }`}>
                                    {person.name}
                                  </span>
                                  <span className={`block text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {person.role} • {person.department}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className={`flex items-center justify-between text-[11px] pt-1 font-mono ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <span>
                          {newReminderData.assignedEmployeeIds.length === 0
                            ? 'Nenhuma pessoa alocada (será atribuído à Equipe Geral)'
                            : `${newReminderData.assignedEmployeeIds.length} pessoa(s) alocada(s)`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        LINK DE VÍDEO (OPCIONAL)
                      </label>
                      <input
                        type="url"
                        value={newReminderData.link}
                        onChange={(e) => setNewReminderData({ ...newReminderData, link: e.target.value })}
                        placeholder="https://meet.google.com/..."
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                          isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        DESCRIÇÃO / PAUTA
                      </label>
                      <textarea
                        rows={2}
                        value={newReminderData.description}
                        onChange={(e) => setNewReminderData({ ...newReminderData, description: e.target.value })}
                        placeholder="Descreva detalhes ou orientações para a equipe..."
                        className={`w-full px-3.5 py-2 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors resize-none border ${
                          isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>

                    {/* Modal Footer Buttons */}
                    <div className={`flex items-center justify-end gap-3 pt-3 border-t shrink-0 ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewReminderModalOpen(false);
                          setEditingReminderId(null);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:scale-105 cursor-pointer"
                        style={{
                          background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 58%, #F59242 100%)',
                          boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)'
                        }}
                      >
                        {editingReminderId ? 'Salvar Alterações' : 'Salvar Compromisso'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── TAB 5: CHAT EQUIPE (ESTILO EXATO DO GESTOR COM BACKEND SUPABASE) ─── */}
      {activeTab === 'chat' && (() => {
        const quickSuggestions = [
          '📅 Alinhamento sobre a escala do fim de semana',
          '⚡ Aviso urgente de cobertura de plantão',
          '✅ Horários confirmados e ponto conferido',
          '❓ Solicitação de ajuste de turno',
        ];

        return (
          <div className="approvals-page w-full animate-in fade-in duration-200 relative">
            {/* Main Chat Workspace Container */}
            <div 
              className={`rounded-3xl border overflow-hidden shadow-2xl relative z-10 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] min-h-[660px] transition-all ${
                isDark 
                  ? 'border-[#282a33] bg-[#111216]' 
                  : 'border-[#E8DCCB] bg-white shadow-xl'
              }`}
            >
              {/* Left Channel & Presence Column */}
              <aside className={`hidden lg:flex flex-col border-r p-4 justify-between transition-all ${
                isDark 
                  ? 'border-[#282a33] bg-[#15161b]/95' 
                  : 'border-[#E8DCCB] bg-[#FFFDF8]'
              }`}>
                <div className="space-y-4">
                  {/* Channels section */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          Canais da Equipe
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {visibleTeamChannels.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsNewGroupModalOpen(true)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs transition-all hover:scale-105 cursor-pointer flex items-center gap-1"
                        style={{ background: 'linear-gradient(135deg, #96183C, #F89847)' }}
                        title="Criar novo canal de equipe"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Novo</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {visibleTeamChannels.map((chan) => {
                        const isCurrent = activeChatMode === 'channel' && activeChatChannel === chan.id;
                        return (
                          <div
                            key={chan.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setActiveChatMode('channel');
                              setActiveChatChannel(chan.id);
                            }}
                            className={`group/chan relative w-full text-left p-3 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 ${
                              isCurrent
                                ? 'border-[#F59242]/40 shadow-lg'
                                : isDark
                                  ? 'border-transparent hover:bg-white/5 text-slate-400 hover:text-white'
                                  : 'border-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                            style={isCurrent ? {
                              background: 'linear-gradient(135deg, rgba(100, 12, 30, 0.45) 0%, rgba(159, 36, 60, 0.35) 60%, rgba(245, 146, 66, 0.20) 100%)',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
                            } : {}}
                          >
                            <div 
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${
                                isCurrent 
                                  ? 'text-white' 
                                  : isDark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-100'
                              }`}
                              style={isCurrent && !chan.avatar ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                            >
                              {chan.avatar ? (
                                <img src={chan.avatar} alt={chan.name} className="w-full h-full object-cover" />
                              ) : (
                                <MessageSquare className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs font-bold truncate ${
                                  isCurrent 
                                    ? isDark ? 'text-white font-black' : 'text-[#640C1E] font-black'
                                    : isDark ? 'text-slate-300' : 'text-slate-700'
                                }`}>
                                  #{chan.name}
                                </p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePromptDeleteGroup(chan);
                                    }}
                                    className="p-1 rounded-lg hover:bg-rose-500/25 text-slate-400 hover:text-rose-400 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
                                    title={`Excluir canal #${chan.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className={`text-[10px] truncate mt-0.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {chan.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Equipe Conectada (Privado 1 a 1) */}
                  <div className={`pt-2 border-t ${
                    isDark ? 'border-[#282a33]/60' : 'border-[#E8DCCB]'
                  }`}>
                    <div className="px-2 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Equipe Conectada (Privado)
                      </span>
                    </div>

                      {directEmployees.length === 0 ? (
                        <div className={`p-3 text-center text-[10px] italic rounded-xl border border-dashed ${
                          isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
                        }`}>
                          Nenhum outro integrante cadastrado nesta empresa ainda.
                        </div>
                      ) : (
                        directEmployees.map((emp) => {
                          const isSelected = activeChatMode === 'direct' && selectedDirectEmployeeId === emp.id;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setActiveChatMode('direct');
                                setSelectedDirectEmployeeId(emp.id);
                              }}
                              className={`w-full text-left flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer border ${
                                isSelected
                                  ? 'border-[#F59242] shadow-md'
                                  : isDark ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-slate-100'
                              }`}
                              style={isSelected ? {
                                background: 'linear-gradient(135deg, rgba(100, 12, 30, 0.40) 0%, rgba(245, 146, 66, 0.16) 100%)',
                              } : {}}
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                                  alt={emp.name}
                                  className={`w-7 h-7 rounded-full object-cover ${
                                    isSelected ? 'ring-2 ring-[#F59242]' : isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                                  }`}
                                />
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                                  isDark ? 'border-[#15161b]' : 'border-white'
                                }`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-[11px] font-bold truncate ${
                                    isSelected ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'
                                  }`}>
                                    {emp.name}
                                  </p>
                                  {isSelected && (
                                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-[#F59242] text-black shrink-0">
                                      PRIVADO
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[9px] truncate ${
                                  isDark ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {emp.role} • {emp.department}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                  </div>
                </div>
              </aside>

              {/* Main Chat Conversation Column */}
              <div 
                className="flex flex-col min-w-0" 
                style={{ 
                  background: isDark 
                    ? 'radial-gradient(circle at 95% 5%, rgba(245, 146, 66, 0.08) 0%, transparent 40%), radial-gradient(circle at 70% 0%, rgba(100, 12, 30, 0.08) 0%, transparent 35%), #0e0f12' 
                    : '#FCFAF5'
                }}
              >
                {/* Conversation Header */}
                <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 backdrop-blur-xs transition-all ${
                  isDark ? 'border-[#282a33] bg-[#111216]/90' : 'border-[#E8DCCB] bg-[#FFFDF8]'
                }`}>
                  <div className="flex items-center gap-3">
                    {activeChatMode === 'direct' ? (
                      <div className="relative shrink-0">
                        <img 
                          src={selectedDirectEmployee?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={selectedDirectEmployee?.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#F59242]"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111216]" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setChannelToEditAvatar(activeChannelInfo);
                          managerActiveGroupAvatarInputRef.current?.click();
                        }}
                        title="Clique para alterar a imagem do grupo"
                        className="group/av relative w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 overflow-hidden cursor-pointer"
                        style={!activeChannelInfo.avatar ? { background: 'linear-gradient(135deg, #640C1E, #F59242)' } : {}}
                      >
                        {activeChannelInfo.avatar ? (
                          <img src={activeChannelInfo.avatar} alt={activeChannelInfo.name} className="w-full h-full object-cover" />
                        ) : (
                          <MessageSquare className="w-5 h-5" />
                        )}
                        <span className="absolute inset-0 bg-black/55 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-white" />
                        </span>
                      </button>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#640C1E]'}`}>
                          {activeChatMode === 'direct' 
                            ? `Chat Privado: ${selectedDirectEmployee?.name}` 
                            : `#${activeChannelInfo.name}`}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={managerActiveGroupAvatarInputRef}
                      accept="image/*"
                      onChange={handleUpdateExistingChannelAvatar}
                      className="hidden"
                    />
                    {activeChatMode === 'channel' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setChannelToEditAvatar(activeChannelInfo);
                            managerActiveGroupAvatarInputRef.current?.click();
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isDark
                              ? 'border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                          title={`Alterar imagem do canal #${activeChannelInfo.name}`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#F59242]" />
                          <span className="hidden sm:inline">Foto do Grupo</span>
                        </button>
                      <button
                        type="button"
                        onClick={() => handlePromptDeleteGroup(activeChannelInfo)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-[11px] font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={`Excluir canal #${activeChannelInfo.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Excluir Grupo</span>
                      </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages Feed */}
                <div ref={chatMessagesContainerRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 min-h-[380px] max-h-[520px]">
                  <div className="flex items-center gap-3">
                    <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Mensagens de Hoje
                    </span>
                    <div className={`h-px flex-1 ${isDark ? 'bg-[#282a33]' : 'bg-[#E8DCCB]'}`} />
                  </div>

                  {chatLoading && chatMessages.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Carregando mensagens em tempo real...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="w-8 h-8 text-slate-600 mb-2 opacity-40" />
                      <p className="text-xs text-slate-400">Nenhuma mensagem neste canal ainda.</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {activeChatMode === 'direct'
                          ? `Envie uma mensagem direta para ${selectedDirectEmployee?.name}.`
                          : `Envie a primeira mensagem no canal #${activeChannelInfo.name}!`}
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.sender_id === activeEmployee?.id;
                      const isManagerRole = msg.sender_role?.toUpperCase().includes('GESTOR') || msg.sender_role?.toUpperCase().includes('GERENTE') || msg.sender_role?.toUpperCase().includes('RH');
                      const timeStr = msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : 'Agora';
                      const parsed = parseChatMessage(msg.text, msg.attachment);

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
                        >
                          <div className="relative shrink-0">
                            <img
                              src={msg.sender_avatar || (isManagerRole ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                              alt={msg.sender_name}
                              className={`w-9 h-9 rounded-2xl object-cover ${
                                isMe ? 'ring-2 ring-[#F59242]' : isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-slate-200'
                              }`}
                            />
                            {!isMe && (
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 ${
                                isDark ? 'border-[#0e0f12]' : 'border-white'
                              }`} />
                            )}
                          </div>

                          <div className={`max-w-[75%] space-y-1 ${isMe ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <strong className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                {msg.sender_name}
                              </strong>
                              <span className="text-slate-400">•</span>
                              <span className={isMe ? 'text-[#F59242] font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}>
                                {msg.sender_role}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-mono text-slate-400">{timeStr}</span>
                            </div>

                            <div
                              className="inline-block p-3.5 text-xs leading-relaxed text-left rounded-2xl shadow-lg break-words"
                              style={isMe ? {
                                background: 'linear-gradient(135deg, #640C1E 0%, #9F243C 100%)',
                                color: '#F9DE97',
                                borderRadius: '18px 4px 18px 18px',
                                boxShadow: '0 10px 24px rgba(100, 12, 30, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.12)'
                              } : {
                                background: isDark ? '#1b1d24' : '#ffffff',
                                color: isDark ? '#e2e8f0' : '#1e293b',
                                border: isDark ? '1px solid #282a33' : '1px solid #E8DCCB',
                                borderRadius: '4px 18px 18px 18px',
                                boxShadow: isDark ? '0 8px 20px rgba(0, 0, 0, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.05)'
                              }}
                            >
                              {parsed.text && (
                                <p className="leading-relaxed">{parsed.text}</p>
                              )}

                              {/* Anexo de Imagem Salvo no Banco */}
                              {parsed.attachment && parsed.attachment.type === 'image' && (
                                <div className="mt-2">
                                  <div 
                                    className="relative group/img rounded-xl overflow-hidden border border-black/15 dark:border-white/15 cursor-pointer max-w-[260px] shadow-sm bg-black/20"
                                    onClick={() => setManagerPreviewModalImage({ url: parsed.attachment!.url, name: parsed.attachment!.name })}
                                    title="Clique para ampliar a imagem"
                                  >
                                    <img
                                      src={parsed.attachment.url}
                                      alt={parsed.attachment.name}
                                      className="w-full max-h-52 object-cover group-hover/img:scale-102 transition-transform duration-200"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                                      <span className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80">
                                        <Eye className="w-3.5 h-3.5" />
                                      </span>
                                      <a
                                        href={parsed.attachment.url}
                                        download={parsed.attachment.name}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80"
                                        title="Baixar imagem"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                    <div className="px-2.5 py-1 bg-black/60 backdrop-blur-xs text-[9px] text-white/90 flex items-center justify-between">
                                      <span className="truncate max-w-[150px]">{parsed.attachment.name}</span>
                                      {parsed.attachment.size && <span className="opacity-80">{parsed.attachment.size}</span>}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className={`px-4 py-2 border-t flex items-center gap-2 overflow-x-auto scrollbar-none ${
                  isDark ? 'bg-[#111216] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
                }`}>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#F59242]" /> Sugestões:
                  </span>
                  {quickSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewChatInput(sug)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                        isDark 
                          ? 'bg-[#15161b] hover:bg-[#1f222c] border-[#282a33] text-slate-300 hover:text-white' 
                          : 'bg-white hover:bg-slate-100 border-[#E8DCCB] text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Banner de Preview do Anexo Pendente do Gestor */}
                {pendingManagerAttachment && (
                  <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 text-xs transition-colors shrink-0 ${
                    !isDark ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img 
                        src={pendingManagerAttachment.url} 
                        alt="Preview do anexo" 
                        className="w-9 h-9 rounded-lg object-cover border border-amber-500/30 shrink-0 shadow-xs" 
                      />
                      <div className="min-w-0">
                        <p className="font-bold truncate text-[11px] text-amber-400">{pendingManagerAttachment.name}</p>
                        <p className="text-[9px] opacity-75">{pendingManagerAttachment.size || 'Imagem pronta para envio'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingManagerAttachment(null)}
                      className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer"
                      title="Remover anexo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Input Area */}
                <form
                  onSubmit={handleSendMessage}
                  className={`p-3 sm:p-4 border-t flex items-center gap-2 ${
                    isDark ? 'bg-[#15161b] border-[#282a33]' : 'bg-[#FFFDF8] border-[#E8DCCB]'
                  }`}
                >
                  {/* Input oculto para anexar arquivos */}
                  <input
                    type="file"
                    ref={managerFileInputRef}
                    accept="image/*"
                    onChange={handleManagerFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => managerFileInputRef.current?.click()}
                    disabled={isAttachingManager}
                    aria-label="Anexar arquivo ou comprovante"
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      pendingManagerAttachment
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Anexar imagem ou documento"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    id="chat-main-input"
                    type="text"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    placeholder={
                      pendingManagerAttachment
                        ? 'Adicionar legenda para a imagem (opcional)...'
                        : activeChatMode === 'direct'
                          ? `Mensagem privada para ${selectedDirectEmployee?.name || 'Colaborador'}...`
                          : `Mensagem no canal #${activeChannelInfo.name}...`
                    }
                    className={`flex-1 border rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all ${
                      isDark 
                        ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242]/60' 
                        : 'bg-white border-[#E8DCCB] text-slate-900 placeholder:text-slate-400 focus:border-[#9F243C]'
                    }`}
                  />

                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    disabled={!newChatInput.trim() && !pendingManagerAttachment}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                    style={{
                      background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                      boxShadow: '0 4px 16px rgba(100, 12, 30, 0.35)'
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Novo Grupo da Equipe */}
            {isNewGroupModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90%] ${
                  isDark ? 'bg-[#161720] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="px-4 py-3.5 border-b flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}>
                    <div className="flex items-center gap-2 text-white">
                      <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
                        <Hash className="w-4 h-4 text-[#faf0ac]" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs leading-tight">Novo Grupo de Equipe</h4>
                        <p className="text-[10px] text-[#faf0ac]/90">Crie um canal corporativo no Supabase</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNewGroupModalOpen(false)}
                      className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateNewGroup} className="p-4 space-y-3 overflow-y-auto flex-1">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={managerGroupAvatarInputRef}
                        accept="image/*"
                        onChange={handleManagerGroupAvatarSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => managerGroupAvatarInputRef.current?.click()}
                        className={`w-14 h-14 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center shrink-0 overflow-hidden transition-all cursor-pointer relative group ${
                          isDark ? 'border-white/20 bg-white/5 hover:border-[#f89642]' : 'border-slate-300 bg-slate-100 hover:border-[#96183c]'
                        }`}
                        title="Selecionar imagem do grupo"
                      >
                        {newGroupAvatar ? (
                          <img src={newGroupAvatar} alt="Avatar do grupo" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <ImageIcon className="w-5 h-5 opacity-60" />
                            <span className="text-[8px] font-bold opacity-60 mt-0.5">Foto</span>
                          </>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] font-bold mb-1 opacity-80">Nome do Grupo (#canal)</label>
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="ex: noturno, plantao-uti, vendas"
                          required
                          className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                            isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                          }`}
                        />
                        {newGroupAvatar && (
                          <button
                            type="button"
                            onClick={() => setNewGroupAvatar('')}
                            className="text-[10px] text-rose-400 hover:underline mt-1 font-semibold cursor-pointer"
                          >
                            Remover imagem
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">Descrição do Canal</label>
                      <input
                        type="text"
                        value={newGroupDesc}
                        onChange={(e) => setNewGroupDesc(e.target.value)}
                        placeholder="ex: Plantonistas do final de semana"
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">Tag / Badge</label>
                      <select
                        value={newGroupBadge}
                        onChange={(e) => setNewGroupBadge(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer ${
                          isDark ? 'bg-[#1C1D26] border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="Equipe">Equipe</option>
                        <option value="Plantão">Plantão</option>
                        <option value="Urgente">Urgente</option>
                        <option value="Setor">Setor</option>
                        <option value="Liderança">Liderança</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold opacity-80">Membros Participantes</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMemberIds.length === employees.length) {
                              setSelectedMemberIds([]);
                            } else {
                              setSelectedMemberIds(employees.map(e => e.id));
                            }
                          }}
                          className="text-[10px] text-[#f89642] hover:underline cursor-pointer font-bold"
                        >
                          {selectedMemberIds.length === employees.length ? 'Desmarcar todos' : 'Todos'}
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border rounded-xl p-2 border-white/10">
                        {employees.map((emp) => {
                          const isChecked = selectedMemberIds.includes(emp.id);
                          return (
                            <label
                              key={emp.id}
                              className={`flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                                isChecked ? (isDark ? 'bg-white/10' : 'bg-slate-200') : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100')
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedMemberIds(prev => 
                                    prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                                  );
                                }}
                                className="rounded accent-[#f89642] shrink-0"
                              />
                              <img
                                src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                                alt={emp.name}
                                className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                              />
                              <span className="truncate font-semibold">{emp.name}</span>
                              <span className="text-[10px] text-slate-400 ml-auto truncate max-w-[130px]">{emp.role}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsNewGroupModalOpen(false)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isDark ? 'text-slate-300 bg-white/10 hover:bg-white/15' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingGroup || !newGroupName.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}
                      >
                        {isCreatingGroup ? 'Criando...' : 'Criar Canal'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: CONFIRMAR EXCLUSÃO DO GRUPO */}
            {groupToDelete && (
              <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 text-center transition-all ${
                  !isDark ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161720] border-white/15 text-white'
                }`}>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-3 border border-rose-500/30 shadow-xs">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-black leading-tight">Excluir Grupo #{groupToDelete.name}?</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Esta ação removerá permanentemente o canal e todas as mensagens para todos os colaboradores. Esta ação não pode ser desfeita.
                  </p>

                  <div className="flex items-center gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={() => setGroupToDelete(null)}
                      disabled={isDeletingGroup}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        !isDark ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 bg-white/10 hover:bg-white/15'
                      }`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteGroup}
                      disabled={isDeletingGroup}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isDeletingGroup ? 'Excluindo...' : 'Sim, Excluir'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: VISUALIZAÇÃO AMPLIADA DA IMAGEM NO CHAT DO GESTOR */}
            {managerPreviewModalImage && (
              <div 
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={() => setManagerPreviewModalImage(null)}
              >
                <div className="relative max-w-full max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full flex items-center justify-between pb-2 text-white text-xs">
                    <span className="font-semibold truncate max-w-[200px] sm:max-w-md">{managerPreviewModalImage.name}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={managerPreviewModalImage.url}
                        download={managerPreviewModalImage.name}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                        title="Baixar imagem"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setManagerPreviewModalImage(null)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                        title="Fechar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <img
                    src={managerPreviewModalImage.url}
                    alt={managerPreviewModalImage.name}
                    className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 🛑 TAB 6: GESTÃO DA EQUIPE & COLABORADORES */}
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

                <div className={`p-3 rounded-xl border text-xs ${
                  isDark ? 'bg-black/20 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="flex items-center justify-between font-medium">
                    <span>Registros a exportar:</span>
                    <span className="font-bold text-amber-500">
                      {activeMonths.find(m => m.key === selectedExportMonth)?.count || 0}
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
                      const rowsToExport = selectedExportMonth === 'all'
                        ? approvalsData
                        : approvalsData.filter(row => row.date && normalizeDateToISO(row.date).startsWith(selectedExportMonth));

                      handleExportApprovalsCsv(rowsToExport, selectedExportMonth);
                      setIsExportModalOpen(false);
                    } else {
                      onExportCsv(selectedExportMonth);
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
