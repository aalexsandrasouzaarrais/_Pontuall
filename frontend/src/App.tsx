import { getTodayDateString, evaluatePunchTolerance } from '@/shared/utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { 
  EmployeeSidebar 
} from '@/shared/components/EmployeeSidebar';
import { 
  EmployeeMainView 
} from '@/modules/attendance/components/EmployeeMainView';
import { 
  EmployeeCalendarView 
} from '@/modules/shifts/components/EmployeeCalendarView';
import { 
  ManagerView 
} from '@/modules/manager/components/ManagerView';
import { 
  ManagerRequestsModal 
} from '@/modules/requests/components/ManagerRequestsModal';
import { 
  ShiftDetailModal 
} from '@/modules/shifts/components/ShiftDetailModal';
import { 
  ShiftSwapModal 
} from '@/modules/requests/components/ShiftSwapModal';
import { 
  JustificationModal 
} from '@/modules/justifications/components/JustificationModal';
import { 
  NotificationsModal 
} from '@/modules/notifications/components/NotificationsModal';
import { 
  ChatModal 
} from '@/modules/chat/components/ChatModal';
import { useUnreadChatCount } from '@/shared/hooks/useUnreadChatCount';
import { 
  LoginView 
} from '@/modules/auth/components/LoginView';
import { 
  ProfileEditModal 
} from '@/shared/components/ProfileEditModal';
import { 
  PjDeliverablesView 
} from '@/modules/attendance/components/PjDeliverablesView';
import { 
  getPjReportsSupabase, 
  updatePjReportStatusSupabase 
} from '@/modules/attendance/services/pjReportService';
import { supabase } from '@/shared/services/supabase';

import { 
  getColaboradoresSupabase, 
  getColaboradorByIdSupabase,
  createColaboradorSupabase,
  deactivateColaboradorSupabase,
  updateColaboradorSupabase,
  syncGoogleUserWithSupabase,
  isUuid
} from '@/modules/auth/services/colaboradorService';
import { 
  getShiftsSupabase, 
  createShiftSupabase, 
  updateShiftSupabase,
  updateShiftAttendanceStatusSupabase,
  registerPunchSupabase,
  deleteShiftSupabase,
  deleteBulkShiftsSupabase
} from '@/modules/shifts/services/shiftService';
import { getRemindersSupabase } from '@/modules/shifts/services/reminderService';
import {
  getJustificativasSupabase,
  createJustificativaSupabase,
  updateJustificativaStatusSupabase,
  getSolicitacoesSupabase,
  createSolicitacaoSupabase,
  updateSolicitacaoStatusSupabase,
  updateSolicitacaoPeerStatusSupabase
} from '@/modules/requests/services/requestService';
import { findShiftOverlapConflict } from '@/shared/utils/shiftValidation';
import {
  getNotificationsSupabase,
  createNotificationSupabase,
  markAllNotificationsAsReadSupabase,
  subscribeNotificationsRealtime,
  deleteNotificationSupabase,
  clearAllNotificationsSupabase
} from '@/modules/notifications/services/notificationService';
import { openDocumentSafe } from '@/shared/services/storageService';
import { 
  Employee, 
  Shift, 
  TimeOffRequest, 
  AbsenceJustification, 
  NotificationItem,
  ManagerReminder,
  PjDeliverableReport
} from './types';
import { 
  CheckCircle2, 
  Clock, 
  CalendarDays, 
  FileText, 
  ArrowLeftRight, 
  Sparkles, 
  AlertCircle, 
  Plus, 
  SlidersHorizontal, 
  LayoutGrid, 
  MessageSquare, 
  Send, 
  Sun, 
  Moon, 
  LogOut,
  X 
} from 'lucide-react';
import { ThemeProvider, useTheme } from '@/shared/context/ThemeContext';
import { showPolishedToast, PolishedToaster, type RimVariant } from '@/components/ui/halo-toast';
import { safeStorage } from '@/shared/utils/safeStorage';
import logoWideDark from './assets/logo-pontual-wide-dark.png';
import logoWideLight from './assets/logo-pontual-wide.png';

function AppContent() {
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const isResetOrFirstAccess = 
          urlParams.get('primeiro_acesso') === 'true' || 
          urlParams.get('reset') === 'true' || 
          urlParams.get('type') === 'recovery' || 
          window.location.pathname.includes('/redefinir-senha');

        if (isResetOrFirstAccess) {
          // Limpa sessão residual para forçar a abertura da tela de definição/redefinição de senha
          safeStorage.removeItem('pontual_active_user');
          safeStorage.removeItem('pontual_role');
          safeStorage.removeItem('pontual_google_avatar');
          try {
            window.sessionStorage.removeItem('pontual_active_user');
            window.sessionStorage.removeItem('pontual_role');
            window.localStorage.removeItem('pontual_active_user');
            window.localStorage.removeItem('pontual_role');
          } catch {}
          return false;
        }
      }
      return !!safeStorage.getItem('pontual_active_user');
    } catch {
      return false;
    }
  });

  // Garante que, se a página carregar com os parâmetros de redefinição/primeiro acesso, a tela de reset seja exibida
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isResetOrFirstAccess = 
        urlParams.get('primeiro_acesso') === 'true' || 
        urlParams.get('reset') === 'true' || 
        urlParams.get('type') === 'recovery' || 
        window.location.pathname.includes('/redefinir-senha');

      if (isResetOrFirstAccess) {
        safeStorage.removeItem('pontual_active_user');
        safeStorage.removeItem('pontual_role');
        safeStorage.removeItem('pontual_google_avatar');
        try {
          window.sessionStorage.removeItem('pontual_active_user');
          window.sessionStorage.removeItem('pontual_role');
          window.localStorage.removeItem('pontual_active_user');
          window.localStorage.removeItem('pontual_role');
        } catch {}
        setIsAuthenticated(false);
      }
    }
  }, []);

  const [authFeedback, setAuthFeedback] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);

  // Global Role Mode: 'manager' (Visual requested in photo) vs 'employee'
  const [currentRole, setCurrentRole] = useState<'manager' | 'employee'>(() => {
    try {
      const saved = safeStorage.getItem('pontual_role');
      if (saved === 'manager' || saved === 'employee') return saved;
    } catch {}
    return 'manager';
  });

  const handleLoginSuccess = (user: Employee, role: 'manager' | 'employee') => {
    setActiveEmployee(user);
    setCurrentRole(role);
    setEmployeeTab('overview');
    setIsAuthenticated(true);
  };

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<Employee>(() => {
    try {
      const savedUserStr = safeStorage.getItem('pontual_active_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        const isRhParsed = parsed.isRh !== undefined ? parsed.isRh : (parsed.roleType === 'rh' || parsed.perfil === 'rh');
        const isColaborador = parsed.roleType === 'colaborador' || parsed.Tpo_Perfil === 'colaborador';
        const fullName = parsed.Nme_Colaborador || parsed.nome || parsed.name || (isColaborador ? 'Colaborador' : 'Gestor');
        return {
          id: parsed.Idf_Colaborador || parsed.id || `emp-${Date.now()}`,
          name: fullName,
          role: parsed.Tpo_Cargo || parsed.cargo || parsed.role || (isColaborador ? 'Colaborador' : 'Gestor Geral'),
          department: parsed.Des_Departamento || parsed.departamento || parsed.department || 'Geral',
          avatar: parsed.Des_Avatar_Url || parsed.avatar || (parsed.Eml_Corporativo || parsed.email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=96183c&color=fff&size=150` : ''),
          email: parsed.Eml_Corporativo || parsed.email || '',
          phone: parsed.Num_Telefone || parsed.phone || '',
          standardHoursPerWeek: parsed.Num_Horas_Semanais || parsed.standardHoursPerWeek || 44,
          registrationId: parsed.Cod_Matricula || parsed.registrationId || (isRhParsed ? 'GST-0001' : 'COL-0001'),
          companyId: parsed.Idf_Empresa || parsed.companyId || undefined,
          isMasterManager: parsed.Flg_Gestor_Master !== undefined ? parsed.Flg_Gestor_Master : (parsed.isMasterManager || false),
          isRh: isRhParsed,
          roleType: parsed.roleType || (isRhParsed ? 'rh' : (parsed.Flg_Gestor_Master || parsed.perfil === 'gestor' || parsed.Tpo_Perfil === 'gestor' ? 'gestor' : 'colaborador')),
          companyCnpj: parsed.companyCnpj || undefined,
          managerIds: parsed.managerIds || [],
          contractType: parsed.contractType || parsed.Tpo_Regime_Contrato || undefined,
          contractStartDate: parsed.contractStartDate || parsed.Dta_Inicio_Contrato || undefined,
          contractEndDate: parsed.contractEndDate || parsed.Dta_Fim_Contrato || undefined,
          pjMonthlyHoursQuota: parsed.pjMonthlyHoursQuota || undefined
        };
      }
    } catch {}
    return {
      id: '',
      name: 'Usuário',
      role: 'Colaborador',
      department: 'Geral',
      avatar: '',
      email: '',
      phone: '',
      standardHoursPerWeek: 44,
      roleType: 'colaborador'
    };
  });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [justifications, setJustifications] = useState<AbsenceJustification[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<ManagerReminder[]>([]);
  const [pjReports, setPjReports] = useState<PjDeliverableReport[]>([]);
  
  // Employee Tabs
  const [employeeTab, setEmployeeTab] = useState<'overview' | 'pj_reports' | 'calendar' | 'requests' | 'justifications' | 'chat'>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sincronização e filtragem por empresa/gestor com o Supabase
  React.useEffect(() => {
    async function loadDataFromSupabase() {
      if (!isAuthenticated || !activeEmployee?.id) return;

      let currentEmp = activeEmployee;
      if (isUuid(activeEmployee.id) && !activeEmployee.companyId) {
        const fresh = await getColaboradorByIdSupabase(activeEmployee.id);
        if (fresh && fresh.companyId) {
          currentEmp = { ...activeEmployee, ...fresh };
          setActiveEmployee(currentEmp);
        }
      }

      try {
        const isRhUser = currentEmp.isRh || currentEmp.roleType === 'rh' || currentEmp.isMasterManager;
        const isSectorManager = (currentRole === 'manager' || currentEmp.roleType === 'gestor') && !isRhUser && currentRole !== 'employee';
        const filter = {
          companyId: currentEmp.companyId || undefined,
          gestorId: (isSectorManager && currentEmp.companyId) ? currentEmp.id : undefined
        };

        const dbEmployees = await getColaboradoresSupabase(filter);
        
        let finalEmployees: Employee[] = (dbEmployees && dbEmployees.length > 0) ? dbEmployees : [];
        if (currentRole === 'employee' && currentEmp && !isRhUser) {
          if (!finalEmployees.some(e => e.id === currentEmp.id || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase()))) {
            finalEmployees = [currentEmp, ...finalEmployees];
          }
        }

        const meInDb = finalEmployees.find(e => e.id === currentEmp.id);
        if (meInDb) {
          currentEmp = { ...currentEmp, ...meInDb };
          setActiveEmployee(prev => ({
            ...prev,
            managerIds: meInDb.managerIds?.length ? meInDb.managerIds : prev.managerIds,
            contractType: meInDb.contractType || prev.contractType,
            contractStartDate: meInDb.contractStartDate || prev.contractStartDate,
            contractEndDate: meInDb.contractEndDate || prev.contractEndDate,
            pjMonthlyHoursQuota: meInDb.pjMonthlyHoursQuota || prev.pjMonthlyHoursQuota
          }));
        }

        setEmployees(finalEmployees);

        // Busca turnos estritamente dos colaboradores pertencentes à empresa/equipe
        const empIds = finalEmployees.map(e => e.id);
        const dbShifts = await getShiftsSupabase(empIds);
        setShifts(dbShifts || []);

        // Busca lembretes da gestão no Supabase filtrados por empresa e equipe
        const dbReminders = await getRemindersSupabase({
          companyId: currentEmp.companyId,
          creatorId: currentEmp.id,
          visibleEmployeeIds: empIds
        });
        setReminders(dbReminders || []);

        // Busca solicitações e justificativas salvas no Supabase vinculadas à equipe
        const validScopeIds = empIds.filter(isUuid);
        const dbRequests = await getSolicitacoesSupabase(validScopeIds.length > 0 ? validScopeIds : undefined);
        const dbJustifications = await getJustificativasSupabase(validScopeIds.length > 0 ? validScopeIds : undefined);

        const enrichedRequests = (dbRequests || []).map(r => {
          const emp = finalEmployees.find(e => e.id === r.employeeId || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase())) 
            || (r.employeeId === currentEmp.id ? currentEmp : undefined);
          const targetEmp = finalEmployees.find(e => e.id === r.targetEmployeeId);
          return {
            ...r,
            employeeName: emp?.name || r.employeeName || 'Colaborador',
            employeeAvatar: emp?.avatar || r.employeeAvatar || '',
            targetEmployeeName: targetEmp?.name || r.targetEmployeeName || ''
          };
        });

        const enrichedJustifications = (dbJustifications || []).map(j => {
          const emp = finalEmployees.find(e => e.id === j.employeeId || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase())) 
            || (j.employeeId === currentEmp.id ? currentEmp : undefined);
          return {
            ...j,
            employeeName: emp?.name || j.employeeName || 'Colaborador',
            employeeAvatar: emp?.avatar || j.employeeAvatar || ''
          };
        });

        setRequests(enrichedRequests);
        setJustifications(enrichedJustifications);

        const dbNotifications = await getNotificationsSupabase(currentEmp.id);
        setNotifications(dbNotifications || []);

        const dbPjReports = await getPjReportsSupabase();
        setPjReports(dbPjReports || []);

      } catch (err) {
        console.warn('Erro ao carregar dados do Supabase:', err);
      }
    }

    loadDataFromSupabase();
  }, [activeEmployee?.id, activeEmployee?.companyId, isAuthenticated]);

    // WebSocket Realtime para notificações em tempo real
    useEffect(() => {
      if (!activeEmployee?.id) return;
      const unsubscribe = subscribeNotificationsRealtime(activeEmployee.id, (newNotif) => {
        setNotifications(prev => {
          if (prev.some(n => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });
        showToast(newNotif.title, newNotif.message, 'info');
      });
      return () => unsubscribe();
    }, [activeEmployee?.id]);

  // Modals state
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false);
  const [justificationPrefill, setJustificationPrefill] = useState<{ shiftId?: string; date?: string; reason?: string } | null>(null);

  const handleOpenJustificationModal = (shiftId?: string, date?: string, reason?: string) => {
    setJustificationPrefill({ shiftId, date, reason });
    setIsJustificationModalOpen(true);
  };
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isManagerRequestsModalOpen, setIsManagerRequestsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChatViewActive, setIsChatViewActive] = useState(false);

  const { unreadCount: unreadChatCount, resetUnreadCount: resetUnreadChatCount } = useUnreadChatCount({
    activeEmployee,
    isChatOpen: isChatModalOpen || isChatViewActive,
  });

  // Monitora autenticação via Google Workspace (OAuth redirect)
  React.useEffect(() => {
    const handleGoogleSession = async (session: any, isExplicitOAuthLogin: boolean = false) => {
      if (!session?.user?.email) return;

      const isOAuthRedirect = isExplicitOAuthLogin || (
        typeof window !== 'undefined' && (
          window.location.hash.includes('access_token') ||
          window.location.hash.includes('id_token') ||
          window.location.search.includes('code=') ||
          safeStorage.getItem('pontual_oauth_in_progress') === 'true'
        )
      );

      // Limpa a flag temporária de oauth em progresso
      safeStorage.removeItem('pontual_oauth_in_progress');

      const hasActiveSession = !!safeStorage.getItem('pontual_active_user');

      // Se NÃO for retorno explícito de login OAuth e o usuário NÃO estiver previamente autenticado:
      // NÃO efetua auto-login no F5 ou ao abrir o link! Permanece na tela de login.
      if (!isOAuthRedirect && !hasActiveSession) {
        return;
      }

      // Se já houver usuário ativo no storage e não for retorno explícito de login OAuth:
      // não sobrescreve a sessão ativa após F5 com conta de sessão antiga do Supabase
      if (hasActiveSession && !isOAuthRedirect) {
        try {
          const savedUserStr = safeStorage.getItem('pontual_active_user');
          if (savedUserStr) {
            const parsed = JSON.parse(savedUserStr);
            const currentEmail = parsed.email || parsed.Eml_Corporativo;
            if (currentEmail && currentEmail.toLowerCase() !== session.user.email.toLowerCase()) {
              return;
            }
          }
        } catch {}
      }

      const googleMeta = session.user.user_metadata || {};
      const googlePicture = googleMeta.avatar_url || googleMeta.picture;
      const googleName = googleMeta.full_name || googleMeta.name || session.user.email.split('@')[0];

      if (googlePicture) {
        safeStorage.setItem('pontual_google_avatar', googlePicture);
      }

      const emp = await syncGoogleUserWithSupabase({
        email: session.user.email,
        name: googleName,
        picture: googlePicture,
        roleHint: currentRole
      });

      // Se a conta Google NÃO estiver previamente cadastrada no sistema:
      if (!emp) {
        await supabase.auth.signOut();
        safeStorage.removeItem('pontual_active_user');
        safeStorage.removeItem('pontual_role');
        setIsAuthenticated(false);

        const unauthorizedMsg = `A conta Google (${session.user.email}) não possui cadastro no sistema Pontual. Solicite ao gestor o seu cadastro prévio.`;
        setAuthFeedback({
          message: unauthorizedMsg,
          type: 'error'
        });

        showToast(
          'Acesso Não Autorizado',
          unauthorizedMsg,
          'error'
        );

        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }

      const isManager = emp.isMasterManager || emp.role?.toLowerCase().includes('gestor') || session.user.email.includes('gestor') || session.user.email.includes('kamile');
      const systemRole: 'manager' | 'employee' = isManager ? 'manager' : 'employee';

      safeStorage.setItem('pontual_role', systemRole);
      safeStorage.setItem('pontual_active_user', JSON.stringify({
        Idf_Colaborador: emp.id,
        Nme_Colaborador: emp.name,
        Eml_Corporativo: emp.email,
        Tpo_Perfil: isManager ? 'gestor' : 'colaborador',
        Tpo_Cargo: emp.role,
        Des_Departamento: emp.department,
        Des_Avatar_Url: emp.avatar,
        Cod_Matricula: emp.registrationId,
        Flg_Gestor_Master: emp.isMasterManager,
        Flg_Ativo: true,
        Idf_Empresa: emp.companyId,
        companyId: emp.companyId,
        isRh: emp.isRh,
        roleType: emp.roleType
      }));

      setActiveEmployee(emp);
      setCurrentRole(systemRole);
      setIsAuthenticated(true);
      showToast('Google Workspace', `Bem-vindo(a), ${emp.name}! Foto conectada.`, 'success');

      // Limpa a URL caso contenha hash de autenticação do Supabase
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isOAuthRedirect = typeof window !== 'undefined' && (
        window.location.hash.includes('access_token') || 
        window.location.hash.includes('id_token') ||
        window.location.search.includes('code=') ||
        safeStorage.getItem('pontual_oauth_in_progress') === 'true'
      );
      const hasActiveSession = !!safeStorage.getItem('pontual_active_user');

      if (session && (isOAuthRedirect || hasActiveSession)) {
        handleGoogleSession(session, isOAuthRedirect);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user?.email) {
        await handleGoogleSession(session, true);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Atualiza foto de perfil em todo o sistema
  const handleUpdateAvatar = (newAvatarUrl: string) => {
    setActiveEmployee(prev => ({
      ...prev,
      avatar: newAvatarUrl
    }));
    setEmployees(prev => prev.map(e => e.id === activeEmployee.id ? { ...e, avatar: newAvatarUrl } : e));
    showToast('Foto Atualizada', 'Sua foto de perfil foi alterada com sucesso.', 'success');
  };

  // Apaga uma notificação específica
  const handleDeleteNotification = async (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    await deleteNotificationSupabase(notifId);
  };

  // Apaga todas as notificações do usuário ativo
  const handleClearAllNotifications = async () => {
    if (notifications.length === 0) return;
    setNotifications([]);
    if (activeEmployee?.id) {
      await clearAllNotificationsSupabase(activeEmployee.id);
    }
    showToast('Notificações Apagadas', 'Todas as notificações foram removidas com sucesso.', 'info');
  };

  // Floating Halo Toast Notification
  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const rimVariant: RimVariant = type === 'error' ? 'destructive' : type === 'success' ? 'success' : 'default';
    showPolishedToast({
      id: 'pontual-toast',
      title,
      description: message,
      rimVariant,
      politeness: type === 'error' ? 'alert' : 'status',
      closeButton: true,
      duration: 5000,
    });
  };



  // Check-In / Check-Out handler for employee
  const handleCheckIn = (
    shiftId: string,
    locationData: {
      address: string;
      gpsValidated: boolean;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      distanceMeters?: number;
      reportedWorkplace?: string;
    },
    punchType: 'entrada' | 'saida' = 'entrada',
    notesOrReason?: string,
    simulatedTime?: string
  ) => {
    const now = new Date();
    const timeStr = simulatedTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetShift = shifts.find(s => s.id === shiftId);

    // Avaliação de tolerância conforme Art. 58 § 1º CLT
    let punchAttendanceStatus: 'present' | 'late' = 'present';
    let lateDiffMinutes = 0;
    let overtimeDiffMinutes = 0;

    if (punchType === 'entrada' && targetShift?.startTime) {
      const tol = evaluatePunchTolerance(targetShift.startTime, timeStr, 'entrada', 10);
      if (tol.isLate) {
        punchAttendanceStatus = 'late';
        lateDiffMinutes = tol.diffMinutes;
      }
    } else if (punchType === 'saida' && targetShift?.endTime) {
      const tol = evaluatePunchTolerance(targetShift.endTime, timeStr, 'saida', 10);
      if (tol.isOvertime) {
        overtimeDiffMinutes = tol.diffMinutes;
      }
    }
    
    // Salva o registro de ponto na TAB_Registro_Ponto no Supabase com coordenadas reais e tipo
    registerPunchSupabase(shiftId, activeEmployee.id, locationData, punchType);
    if (punchType === 'entrada') {
      updateShiftAttendanceStatusSupabase(shiftId, punchAttendanceStatus);
    }

    const isForgetfulness = notesOrReason?.toLowerCase().includes('esqueci') || notesOrReason?.toLowerCase().includes('esquecimento');

    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        if (punchType === 'saida') {
          let updatedNotes = s.notes || '';
          if (overtimeDiffMinutes > 0) {
            const heTag = isForgetfulness
              ? `[Esquecimento de Saída: Saída real no horário previsto (${s.endTime || '15:20'}) - Batida às ${timeStr}]`
              : `[HE +${overtimeDiffMinutes}m: ${notesOrReason || 'Sem justificativa informada'}]`;
            updatedNotes = updatedNotes ? `${updatedNotes} | ${heTag}` : heTag;
          }
          return {
            ...s,
            checkOutTime: timeStr,
            notes: updatedNotes,
            checkOutLocation: {
              latitude: locationData.latitude ?? -23.5505,
              longitude: locationData.longitude ?? -46.6333,
              address: locationData.address,
              gpsValidated: locationData.gpsValidated,
              accuracy: locationData.accuracy,
              distanceMeters: locationData.distanceMeters,
              reportedWorkplace: locationData.reportedWorkplace,
              timestamp: now.toISOString(),
            }
          };
        } else {
          let updatedNotes = s.notes || '';
          if (lateDiffMinutes > 0 && notesOrReason) {
            const lateTag = `[Atraso ${lateDiffMinutes}m: ${notesOrReason}]`;
            updatedNotes = updatedNotes ? `${updatedNotes} | ${lateTag}` : lateTag;
          }
          return {
            ...s,
            attendanceStatus: punchAttendanceStatus,
            checkInTime: timeStr,
            notes: updatedNotes,
            checkInLocation: {
              latitude: locationData.latitude ?? -23.5505,
              longitude: locationData.longitude ?? -46.6333,
              address: locationData.address,
              gpsValidated: locationData.gpsValidated,
              accuracy: locationData.accuracy,
              distanceMeters: locationData.distanceMeters,
              reportedWorkplace: locationData.reportedWorkplace,
              timestamp: now.toISOString(),
            }
          };
        }
      }
      return s;
    }));

    // Mensagem contextual para o colaborador
    let statusMsg = 'GPS Validado no Posto';
    if (locationData.reportedWorkplace) {
      statusMsg = `Posto declarado: ${locationData.reportedWorkplace}`;
    } else if (!locationData.gpsValidated && locationData.distanceMeters) {
      statusMsg = `Aviso: Ponto registrado a ${locationData.distanceMeters}m do posto alocado`;
    }

    const isExit = punchType === 'saida';
    let notifTitle = isExit
      ? (locationData.gpsValidated ? 'Saída Registrada com Sucesso!' : 'Saída Registrada (Aviso de Perímetro)')
      : (locationData.gpsValidated ? 'Entrada Registrada com Sucesso!' : 'Entrada Registrada (Aviso de Perímetro)');
    
    if (punchType === 'entrada' && lateDiffMinutes > 0) {
      notifTitle = `Entrada Registrada (Atraso de ${lateDiffMinutes} min)`;
    } else if (punchType === 'saida' && overtimeDiffMinutes > 0) {
      notifTitle = isForgetfulness
        ? `Saída Registrada (Ajuste de Esquecimento de Ponto)`
        : `Saída Registrada (Hora Extra: +${overtimeDiffMinutes} min)`;
    }

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: notifTitle,
      message: `${isExit ? 'Saída' : 'Presença'} confirmada às ${timeStr} (${statusMsg}). Local: ${locationData.address}`,
      type: 'system',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Localiza gestores do colaborador para notificações operacionais
    const managers = employees.filter(e => 
      activeEmployee.managerIds?.includes(e.id) ||
      (e.roleType === 'gestor' && e.department?.toLowerCase() === activeEmployee.department?.toLowerCase()) ||
      e.isMasterManager ||
      e.isRh
    );

    // Alerta gestor em caso de atraso
    if (punchType === 'entrada' && lateDiffMinutes > 0) {
      managers.forEach(mgr => {
        createNotificationSupabase({
          targetEmployeeId: mgr.id,
          title: 'Alerta de Atraso de Ponto',
          message: `${activeEmployee.name} iniciou o turno com ${lateDiffMinutes} min de atraso às ${timeStr} (previsto: ${targetShift?.startTime || '08:00'}).${notesOrReason ? ` Motivo: "${notesOrReason}".` : ''}`,
          type: 'system',
          actionRequired: true,
        });
      });
    }

    // Alerta gestor em caso de saída após o horário (hora extra ou esquecimento)
    if (punchType === 'saida' && overtimeDiffMinutes > 0) {
      managers.forEach(mgr => {
        createNotificationSupabase({
          targetEmployeeId: mgr.id,
          title: isForgetfulness ? 'Registro de Ponto: Ajuste de Esquecimento' : 'Alerta de Hora Extra / Saída Fora do Horário',
          message: isForgetfulness
            ? `${activeEmployee.name} registrou a saída às ${timeStr} informando esquecimento de batida e encerramento efetivo no horário previsto (${targetShift?.endTime || '15:20'}). Ponto gravado para auditoria (Portaria 671 MTE).`
            : `${activeEmployee.name} registrou saída às ${timeStr} (+${overtimeDiffMinutes} min após o término previsto às ${targetShift?.endTime || '17:00'}). Motivo informado: "${notesOrReason || 'Permanência após o expediente'}". Requer homologação no Banco de Horas.`,
          type: isForgetfulness ? 'system' : 'approval',
          actionRequired: !isForgetfulness,
        });
      });
    }
  };

  const handleUpdateEmployee = async (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    if (activeEmployee?.id === updated.id) {
      setActiveEmployee(updated);
    }
    try {
      await updateColaboradorSupabase(updated);
    } catch (err) {
      console.warn('Erro ao atualizar no Supabase:', err);
    }
    showToast('Cadastro Atualizado', `Informações de ${updated.name} foram salvas.`, 'success');
  };

  const handleDeactivateEmployee = async (employeeId: string) => {
    const target = employees.find(e => e.id === employeeId);
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
    setShifts(prev => prev.filter(s => s.employeeId !== employeeId));
    try {
      await deactivateColaboradorSupabase(employeeId, activeEmployee?.id, activeEmployee?.isMasterManager);
    } catch (err) {
      console.warn('Erro ao inativar no Supabase:', err);
    }
    showToast('Colaborador Desativado', `${target?.name || 'O colaborador'} foi inativado e removido das escalas ativas.`, 'info');
  };

  // Submit swap or time-off request
  const handleSubmitRequest = async (req: Partial<TimeOffRequest>) => {
    const tempId = `req-${Date.now()}`;
    const newRequest: TimeOffRequest = {
      id: tempId,
      employeeId: activeEmployee.id,
      employeeName: activeEmployee.name,
      employeeAvatar: activeEmployee.avatar,
      type: req.type || 'swap',
      date: req.date || getTodayDateString(),
      shiftId: req.shiftId,
      targetEmployeeId: req.targetEmployeeId,
      targetEmployeeName: req.targetEmployeeName,
      reason: req.reason || '',
      status: 'pending',
      createdAt: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setRequests(prev => [newRequest, ...prev]);
    setEmployeeTab('requests');

    try {
      const saved = await createSolicitacaoSupabase(req, activeEmployee);
      if (saved) {
        setRequests(prev => prev.map(r => r.id === tempId ? { ...saved, employeeName: activeEmployee.name, employeeAvatar: activeEmployee.avatar } : r));
      }

      if (req.type === 'swap' && req.targetEmployeeId) {
        // Notifica o colega substituto para que ele aceite ou recuse a proposta
        await createNotificationSupabase({
          targetEmployeeId: req.targetEmployeeId,
          title: 'Proposta de Troca de Turno Recebida',
          message: `${activeEmployee.name} enviou uma proposta para você assumir a escala do dia ${req.date || ''}. Abra a aba 'Solicitações' para aceitar ou recusar.`,
          type: 'swap',
          actionRequired: true,
        });
        showToast('Proposta Enviada', `Proposta enviada para ${req.targetEmployeeName || 'o colega'}. Assim que ele aceitar, o pedido seguirá para homologação do gestor.`, 'info');
      } else {
        // Notifica gestores para folga compensatória
        const managers = employees.filter(e => e.roleType === 'gestor' || e.isMasterManager || e.isRh);
        managers.forEach(mgr => {
          createNotificationSupabase({
            targetEmployeeId: mgr.id,
            title: 'Nova Folga Compensatória',
            message: `${activeEmployee.name} solicitou folga compensatória para ${req.date || 'data selecionada'}.`,
            type: 'swap',
            actionRequired: true,
          });
        });
        showToast('Solicitação Enviada', 'Sua solicitação de folga foi enviada para o Gestor e RH.', 'success');
      }
    } catch (err) {
      console.warn('Erro ao salvar solicitação no Supabase:', err);
    }
  };

  // Submit absence justification
  const handleSubmitJustification = async (just: Partial<AbsenceJustification>) => {
    const tempId = `just-${Date.now()}`;
    const newJust: AbsenceJustification = {
      id: tempId,
      employeeId: activeEmployee.id,
      employeeName: activeEmployee.name,
      employeeAvatar: activeEmployee.avatar,
      shiftId: just.shiftId || '',
      date: just.date || getTodayDateString(),
      reason: just.reason || '',
      documentName: just.documentName,
      documentType: just.documentType,
      status: 'pending',
      submittedAt: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setJustifications(prev => [newJust, ...prev]);
    
    if (just.shiftId) {
      setShifts(prev => prev.map(s => s.id === just.shiftId ? { ...s, attendanceStatus: 'justified' } : s));
    }

    setEmployeeTab('justifications');

    try {
      const saved = await createJustificativaSupabase(just, activeEmployee);
      if (saved) {
        setJustifications(prev => prev.map(j => j.id === tempId ? { ...saved, employeeName: activeEmployee.name, employeeAvatar: activeEmployee.avatar } : j));
        // Notifica gestores/RH
        const managers = employees.filter(e => e.roleType === 'gestor' || e.isMasterManager || e.isRh);
        managers.forEach(mgr => {
          createNotificationSupabase({
            targetEmployeeId: mgr.id,
            title: 'Novo Atestado / Justificativa',
            message: `${activeEmployee.name} enviou atestado/comprovante para ${just.date || 'data de ausência'}.`,
            type: 'justification',
            actionRequired: true,
          });
        });
      }
    } catch (err) {
      console.warn('Erro ao salvar justificativa no Supabase:', err);
    }
    showToast('Atestado Enviado', 'Sua justificativa/atestado foi gravado no banco de dados e enviado para o RH e Gestor.', 'success');
  };

  // Manager Actions
  const handleAddShift = async (newShiftData: Partial<Shift>) => {
    const created: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: newShiftData.employeeId || employees[0]?.id || 'emp-1',
      date: newShiftData.date || getTodayDateString(),
      startTime: newShiftData.startTime || '08:00',
      endTime: newShiftData.endTime || '17:00',
      breakMinutes: newShiftData.breakMinutes !== undefined ? newShiftData.breakMinutes : 60,
      status: newShiftData.status || 'published',
      attendanceStatus: newShiftData.attendanceStatus || 'pending',
      type: newShiftData.type || 'regular',
      title: newShiftData.title || 'Turno de Trabalho',
      notes: newShiftData.notes,
      meetingLink: newShiftData.meetingLink,
      projectTag: newShiftData.projectTag,
      color: newShiftData.color,
      workplace: newShiftData.workplace,
      ...newShiftData,
    };

    // Bloqueia sobreposição de horários do colaborador
    const overlapConflict = findShiftOverlapConflict(created, shifts, employees);
    if (overlapConflict) {
      showToast('Conflito de Escala', overlapConflict.message, 'error');
      return;
    }

    try {
      const saved = await createShiftSupabase(created);
      const finalShift = saved || created;
      setShifts(prev => [...prev, finalShift]);

      if (finalShift.employeeId) {
        await createNotificationSupabase({
          targetEmployeeId: finalShift.employeeId,
          title: 'Nova Escala Publicada',
          message: `Você foi escalado(a) para o dia ${finalShift.date} das ${finalShift.startTime} às ${finalShift.endTime} (${finalShift.title || 'Turno'}).`,
          type: 'shift_change',
          actionRequired: false,
        });
      }
      showToast('Escala Salva', `Turno adicionado para ${finalShift.date}.`, 'success');
    } catch {
      setShifts(prev => [...prev, created]);
    }
  };

  const handleUpdateShift = async (updated: Shift, notifyEmployee: boolean = true, changeReason?: string) => {
    // Bloqueia sobreposição de horários do colaborador (ignorando o próprio turno em edição)
    const overlapConflict = findShiftOverlapConflict(updated, shifts, employees);
    if (overlapConflict) {
      showToast('Conflito de Escala', overlapConflict.message, 'error');
      return;
    }

    const prevShift = shifts.find(s => s.id === updated.id);
    setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));

    try {
      await updateShiftSupabase(updated);
    } catch (err) {
      console.warn('Erro ao atualizar escala no Supabase:', err);
    }

    if ((notifyEmployee || (prevShift && prevShift.status === 'published')) && updated.status === 'published') {
      const emp = employees.find(e => e.id === updated.employeeId);
      const empName = emp?.name || 'Colaborador';
      const reasonMsg = changeReason?.trim() ? ` Motivo: "${changeReason.trim()}".` : '';
      
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: 'Escala Alterada pelo Gestor',
        message: `Atenção: A escala de ${empName} no dia ${updated.date} foi alterada para ${updated.startTime} às ${updated.endTime} (${updated.title || 'Turno'}).${reasonMsg} Por favor, verifique seus novos horários.`,
        type: 'shift_change',
        timestamp: 'Agora',
        read: false,
        actionRequired: true,
      };
      setNotifications(prev => [newNotif, ...prev]);

      if (updated.employeeId) {
        await createNotificationSupabase({
          targetEmployeeId: updated.employeeId,
          title: 'Escala Alterada pelo Gestor',
          message: `Sua escala no dia ${updated.date} foi alterada para ${updated.startTime} às ${updated.endTime} (${updated.title || 'Turno'}).${reasonMsg}`,
          type: 'shift_change',
          actionRequired: true,
        });
      }
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    try {
      await deleteShiftSupabase(shiftId);
    } catch (err) {
      console.warn('Erro ao excluir no Supabase:', err);
    }
  };

  const handleDeleteShiftsBulk = async (shiftIdsToDelete: string[]) => {
    setShifts(prev => prev.filter(s => !shiftIdsToDelete.includes(s.id)));
    try {
      await deleteBulkShiftsSupabase(shiftIdsToDelete);
    } catch (err) {
      console.warn('Erro ao excluir lote no Supabase:', err);
    }
    showToast(
      'Escalas Excluídas',
      `${shiftIdsToDelete.length} escala(s) foram removidas da grade com sucesso.`,
      'info'
    );
  };

  const handleAcceptPeerSwap = async (requestId: string) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;

    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, peerStatus: 'accepted' } : r));
    try {
      await updateSolicitacaoPeerStatusSupabase(requestId, 'accepted');
    } catch (err) {
      console.warn('Erro ao atualizar status do aceite:', err);
    }

    // 1. Notifica o solicitante (Colaborador A)
    if (target.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Troca Aceita pelo Colega!',
        message: `${activeEmployee.name} aceitou sua proposta de troca para ${target.date}! O pedido foi encaminhado para homologação final do gestor.`,
        type: 'swap',
        actionRequired: false,
      });
    }

    // 2. Notifica os gestores
    const managers = employees.filter(e => e.roleType === 'gestor' || e.isMasterManager || e.isRh);
    managers.forEach(mgr => {
      createNotificationSupabase({
        targetEmployeeId: mgr.id,
        title: 'Troca de Turno Pronta para Homologação',
        message: `${target.employeeName} e ${activeEmployee.name} concordaram com a troca de escala do dia ${target.date}. Homologação necessária na Central de Aprovações.`,
        type: 'swap',
        actionRequired: true,
      });
    });

    showToast('Proposta Aceita', `Você aceitou assumir a escala de ${target.employeeName}. O pedido foi encaminhado ao gestor para homologação.`, 'success');
  };

  const handleRejectPeerSwap = async (requestId: string) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;

    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, peerStatus: 'rejected', status: 'rejected' } : r));
    try {
      await updateSolicitacaoPeerStatusSupabase(requestId, 'rejected', 'Recusado pelo colega substituto');
    } catch (err) {
      console.warn('Erro ao atualizar status do aceite:', err);
    }

    // Notifica o solicitante (Colaborador A)
    if (target.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Troca Recusada pelo Colega',
        message: `${activeEmployee.name} não pôde aceitar sua proposta de troca de turno para ${target.date}. A solicitação foi cancelada.`,
        type: 'swap',
        actionRequired: false,
      });
    }

    showToast('Proposta Recusada', `Você recusou a proposta de troca de ${target.employeeName}.`, 'info');
  };

  const handleApproveRequest = async (id: string, customFeedback?: string) => {
    const feedback = customFeedback || 'Aprovado pelo gestor';
    const target = requests.find(r => r.id === id);
    if (!target) return;

    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', managerNotes: feedback } : r));
    await updateSolicitacaoStatusSupabase(id, 'approved', feedback);

    // Se for troca de turno com colega substituto definido
    if (target.type === 'swap' && target.targetEmployeeId) {
      // Localiza a escala correspondente a ser transferida
      const targetShift = shifts.find(s => s.id === target.shiftId) ||
                          shifts.find(s => s.employeeId === target.employeeId && s.date === target.date);

      if (targetShift) {
        const auditNote = `[Troca Homologada] Assumido de ${target.employeeName || 'colega'} em ${new Date().toLocaleDateString('pt-BR')} pelo gestor`;
        const updatedShift: Shift = {
          ...targetShift,
          employeeId: target.targetEmployeeId,
          notes: targetShift.notes ? `${targetShift.notes}\n${auditNote}` : auditNote,
        };

        // Atualiza escala na grade e calendário imediatamente
        setShifts(prev => prev.map(s => s.id === targetShift.id ? updatedShift : s));

        // Atualiza escala no Supabase
        try {
          await updateShiftSupabase(updatedShift);
        } catch (err) {
          console.warn('Erro ao transferir escala no Supabase:', err);
        }
      }

      // 1. Notifica o Solicitante (Colaborador A)
      if (target.employeeId) {
        await createNotificationSupabase({
          targetEmployeeId: target.employeeId,
          title: 'Troca de Turno Homologada',
          message: `Sua troca de turno para o dia ${target.date} com ${target.targetEmployeeName || 'seu colega'} foi homologada pelo gestor. A escala foi transferida com sucesso.`,
          type: 'approval',
          actionRequired: false,
        });
      }

      // 2. Notifica o Substituto (Colega B)
      if (target.targetEmployeeId) {
        await createNotificationSupabase({
          targetEmployeeId: target.targetEmployeeId,
          title: 'Nova Escala Assumida (Troca Homologada)',
          message: `A troca de turno foi homologada pelo gestor! Você assumiu oficialmente a escala do dia ${target.date}${targetShift ? ` (${targetShift.startTime} às ${targetShift.endTime})` : ''} de ${target.employeeName}.`,
          type: 'shift_change',
          actionRequired: true,
        });
      }

      showToast('Troca Homologada', `A escala do dia ${target.date} foi transferida para ${target.targetEmployeeName || 'o colega'} e ambos foram notificados.`, 'success');
      return;
    }

    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Solicitação Aprovada',
        message: `Sua solicitação de folga compensatória para ${target.date} foi aprovada. Parecer: "${feedback}".`,
        type: 'approval',
      });
    }
    showToast('Solicitação Aprovada', 'A solicitação foi aprovada e salva no Supabase.', 'success');
  };

  const handleRejectRequest = async (id: string, customFeedback?: string) => {
    const feedback = customFeedback || 'Recusado pelo gestor';
    const target = requests.find(r => r.id === id);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', managerNotes: feedback } : r));
    await updateSolicitacaoStatusSupabase(id, 'rejected', feedback);
    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Solicitação Recusada',
        message: `Sua solicitação de ${target.type === 'swap' ? 'troca de turno' : 'folga compensatória'} para ${target.date} foi recusada. Motivo: "${feedback}".`,
        type: 'approval',
      });
    }
    showToast('Solicitação Recusada', 'A solicitação foi recusada no Supabase.', 'info');
  };

  const handleApproveJustification = async (id: string, customFeedback?: string) => {
    const feedback = customFeedback || 'Homologado pelo RH';
    const target = justifications.find(j => j.id === id);
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'approved', managerNotes: feedback } : j));
    await updateJustificativaStatusSupabase(id, 'approved', feedback);

    // Sincroniza o turno para 'justified' na memória e no Supabase
    if (target) {
      let shiftIdToUpdate = target.shiftId;
      if (!shiftIdToUpdate && target.employeeId && target.date) {
        const found = shifts.find(s => s.employeeId === target.employeeId && s.date === target.date);
        shiftIdToUpdate = found?.id;
      }
      if (shiftIdToUpdate) {
        setShifts(prev => prev.map(s => s.id === shiftIdToUpdate ? { ...s, attendanceStatus: 'justified' } : s));
        await updateShiftAttendanceStatusSupabase(shiftIdToUpdate, 'justified');
      } else if (target.employeeId && target.date) {
        setShifts(prev => prev.map(s => (s.employeeId === target.employeeId && s.date === target.date) ? { ...s, attendanceStatus: 'justified' } : s));
      }
    }

    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Atestado Homologado',
        message: `Seu atestado médico para ${target.date} foi homologado. Parecer: "${feedback}". As horas do dia foram abonadas.`,
        type: 'justification',
      });
    }
    showToast('Atestado Homologado', 'O atestado/justificativa foi homologado e o turno atualizado no sistema.', 'success');
  };

  const handleRejectJustification = async (id: string, customFeedback?: string) => {
    const feedback = customFeedback || 'Não homologado';
    const target = justifications.find(j => j.id === id);
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'rejected', managerNotes: feedback } : j));
    await updateJustificativaStatusSupabase(id, 'rejected', feedback);

    if (target) {
      let shiftIdToUpdate = target.shiftId;
      if (!shiftIdToUpdate && target.employeeId && target.date) {
        const found = shifts.find(s => s.employeeId === target.employeeId && s.date === target.date);
        shiftIdToUpdate = found?.id;
      }
      if (shiftIdToUpdate) {
        setShifts(prev => prev.map(s => s.id === shiftIdToUpdate ? { ...s, attendanceStatus: 'absent' } : s));
        await updateShiftAttendanceStatusSupabase(shiftIdToUpdate, 'absent');
      }
    }

    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Atestado Recusado',
        message: `Seu atestado médico para ${target.date} não foi homologado. Motivo: "${feedback}".`,
        type: 'justification',
      });
    }
    showToast('Atestado Recusado', 'A justificativa foi marcada como não homologada no Supabase.', 'info');
  };

  const handleApprovePjReport = async (id: string) => {
    const feedback = 'Entregas e horas homologadas pelo gestor.';
    const target = pjReports.find(p => p.id === id);
    setPjReports(prev => prev.map(p => p.id === id ? { ...p, status: 'approved', managerFeedback: feedback } : p));
    await updatePjReportStatusSupabase(id, 'approved', feedback);
    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Entregas PJ Aprovadas',
        message: `Seu relatório de entregas e horas do período "${target.period}" (${target.hoursWorked}h) foi aprovado pelo gestor.`,
        type: 'approval',
      });
    }
    showToast('Relatório PJ Aprovado', 'Horas e entregas homologadas com sucesso.', 'success');
  };

  const handleRejectPjReport = async (id: string, reason?: string) => {
    const feedback = reason || 'Ajustes solicitados pelo gestor.';
    const target = pjReports.find(p => p.id === id);
    setPjReports(prev => prev.map(p => p.id === id ? { ...p, status: 'rejected', managerFeedback: feedback } : p));
    await updatePjReportStatusSupabase(id, 'rejected', feedback);
    if (target?.employeeId) {
      await createNotificationSupabase({
        targetEmployeeId: target.employeeId,
        title: 'Ajustes Solicitados em Entregas PJ',
        message: `O gestor solicitou ajustes no relatório do período "${target.period}". Motivo: "${feedback}".`,
        type: 'approval',
      });
    }
    showToast('Relatório PJ Recusado', 'Status atualizado com solicitação de ajustes.', 'info');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao deslogar do Supabase:', err);
    }
    try {
      safeStorage.removeItem('pontual_active_user');
      safeStorage.removeItem('pontual_role');
      safeStorage.removeItem('pontual_google_avatar');

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('pontual_active_user');
        window.sessionStorage.removeItem('pontual_role');
        window.sessionStorage.removeItem('pontual_google_avatar');
        window.localStorage.removeItem('pontual_active_user');
        window.localStorage.removeItem('pontual_role');
        window.localStorage.removeItem('pontual_google_avatar');

        // Limpa tokens de autenticação do Supabase residuais no storage
        try {
          Object.keys(window.localStorage || {}).forEach(k => {
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
              window.localStorage.removeItem(k);
            }
          });
          Object.keys(window.sessionStorage || {}).forEach(k => {
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
              window.sessionStorage.removeItem(k);
            }
          });
        } catch {}
      }
    } catch {}
    setIsAuthenticated(false);
  };

  const handleAddEmployee = async (newEmp: Employee) => {
    try {
      // Salva diretamente na tabela TAB_Colaborador do Supabase e vincula ao gestor ativo (M:N)
      const saved = await createColaboradorSupabase(newEmp, activeEmployee?.id);
      setEmployees(prev => [...prev, saved]);
    } catch (err) {
      console.warn('Fallback local ao salvar colaborador:', err);
      setEmployees(prev => [...prev, newEmp]);
    }
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Novo Colaborador Cadastrado',
      message: `${newEmp.name} foi adicionado(a) à equipe e salvo no Supabase (${newEmp.role} - ${newEmp.contractType || 'CLT'}).`,
      type: 'system',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);

    // Mensagem indicando que o colaborador foi salvo com sucesso!
    showToast(
      'Colaborador salvo com sucesso!',
      `${newEmp.name} foi adicionado(a) à equipe como ${newEmp.role || 'Colaborador'}.`,
      'success'
    );
  };

  const handleOpenShiftDetails = (shift: Shift) => {
    setSelectedShiftForDetail(shift);
    setIsDetailModalOpen(true);
  };

  const visibleEmployees = React.useMemo(() => {
    const isRhUser = activeEmployee?.isRh || activeEmployee?.roleType === 'rh' || activeEmployee?.isMasterManager;
    if (isRhUser) {
      return employees;
    }
    return employees.filter(e => e.id === activeEmployee?.id || (e.managerIds && e.managerIds.includes(activeEmployee?.id)));
  }, [employees, activeEmployee]);

  const pendingRequestsCount = 
    requests.filter(r => r.status === 'pending').length + 
    justifications.filter(j => j.status === 'pending').length +
    pjReports.filter(p => p.status === 'pending').length;
  const myRequests = requests.filter(r => r.employeeId === activeEmployee.id);
  const incomingSwapRequests = requests.filter(r => r.type === 'swap' && r.targetEmployeeId === activeEmployee.id && r.peerStatus === 'pending');
  const myJustifications = justifications.filter(j => j.employeeId === activeEmployee.id);

  const isManagerLight = currentRole === 'manager' && !isDark;

  // Se o usuário não estiver autenticado, exibe a tela de Login oficial integrada ao Supabase
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} externalFeedback={authFeedback} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-[#BBF7D0] selection:text-[#166534] ${
      isManagerLight ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#0B0B0E] text-slate-100'
    }`}>
      
      {/* Top Global Header Bar — Design moderno com suporte para Gestor e Colaborador */}
      <header className={`backdrop-blur-xl border-b px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs sticky top-0 z-50 shadow-md transition-colors ${
        !isDark ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#0D0F15]/95 border-[#222634]/80 text-white'
      }`}>
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <img
            src={!isDark ? logoWideDark : logoWideLight}
            alt="Pontual"
            className="h-6 sm:h-7 w-auto object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="${!isDark ? 'text-slate-900' : 'text-white'} font-extrabold text-sm tracking-tight">Pontual</span>`;
              }
            }}
          />
        </div>

        {/* Right: Perfil (mobile) + Tema + Sair (desktop) */}
        <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
          {/* Foto de Perfil — Apenas no Mobile (no desktop já fica na barra lateral) */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            aria-label="Meu Perfil"
            title="Meu Perfil"
            className="md:hidden relative cursor-pointer shrink-0 group"
          >
            <img
              src={activeEmployee.avatar}
              alt={activeEmployee.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-[#F89847]/70 group-hover:ring-[#F89847] active:scale-95 transition-all shadow-xs"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#0D0F15]" />
          </button>

          {/* Botão de Tema Moderno (Claro / Escuro) ativo tanto para Gestor quanto para Colaborador */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            title={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                : 'border-[#252A3A] bg-[#151822] text-slate-300 hover:text-white hover:bg-[#96183c] hover:border-[#96183c]'
            }`}
          >
            {!isDark ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
            <span className="hidden sm:inline font-semibold">
              {!isDark ? 'Escuro' : 'Claro'}
            </span>
          </button>

          {/* Botão Sair / Logout — Apenas no Desktop */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair da conta e voltar ao Login"
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                : 'border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="font-semibold">Sair</span>
          </button>
        </div>
      </header>

      {/* RENDER VIEW ACCORDING TO ROLE */}
      {currentRole === 'manager' ? (
        /* MANAGER VIEW (Full screen width) */
        <div className={`flex-1 w-full flex flex-col min-h-0 manager-scope ${theme}`}>
          <ManagerView
            employees={visibleEmployees}
            shifts={shifts}
            activeEmployee={activeEmployee}
            notificationsCount={notifications.filter(n => !n.read).length}
            onAddShift={handleAddShift}
            onUpdateShift={handleUpdateShift}
            onDeleteShift={handleDeleteShift}
            onDeleteShiftsBulk={handleDeleteShiftsBulk}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeactivateEmployee={handleDeactivateEmployee}
            onOpenRequests={() => setIsManagerRequestsModalOpen(true)}
            onOpenChat={() => setIsChatModalOpen(true)}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            pendingRequestsCount={pendingRequestsCount}
            unreadChatCount={unreadChatCount}
            onResetUnreadChat={resetUnreadChatCount}
            onChatViewActive={setIsChatViewActive}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            justifications={justifications}
            requests={requests}
            pjReports={pjReports}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onApproveJustification={handleApproveJustification}
            onRejectJustification={handleRejectJustification}
            onApprovePjReport={handleApprovePjReport}
            onRejectPjReport={handleRejectPjReport}
          />
        </div>
      ) : (
        /* EMPLOYEE VIEW */
        <div className={`flex-1 flex flex-col md:flex-row overflow-hidden ${(employeeTab === 'requests' || employeeTab === 'justifications') && activeEmployee.contractType !== 'PJ' ? (!isDark ? 'bg-[#f4f5f8]' : 'colaborador-page-container') : (!isDark ? 'bg-[#f4f5f8]' : 'bg-[#050104]')}`}>
          {/* Full-height Collapsible Sidebar on Desktop / Horizontal Sub-Header Bar on Mobile */}
          <EmployeeSidebar
            activeTab={
              activeEmployee.contractType === 'PJ'
                ? (employeeTab === 'chat' || employeeTab === 'pj_reports' ? employeeTab : 'overview')
                : (employeeTab === 'pj_reports' ? 'overview' : employeeTab)
            }
            onTabChange={(tab) => {
              if (tab === 'chat') {
                setIsChatModalOpen(true);
              } else {
                setEmployeeTab(tab);
              }
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            activeEmployee={activeEmployee}
            employees={employees}
            onSelectEmployee={(emp) => {
              setActiveEmployee(emp);
              setEmployeeTab('overview');
              safeStorage.setItem('pontual_active_user', JSON.stringify({
                ...emp,
                Idf_Colaborador: emp.id,
                Nme_Colaborador: emp.name,
                Eml_Corporativo: emp.email,
                Tpo_Perfil: emp.roleType || 'colaborador',
                Tpo_Cargo: emp.role,
                Des_Departamento: emp.department,
                Des_Avatar_Url: emp.avatar,
                Cod_Matricula: emp.registrationId,
                Flg_Gestor_Master: emp.isMasterManager,
                Flg_Ativo: true,
                Idf_Empresa: emp.companyId,
                companyId: emp.companyId,
                isRh: emp.isRh,
                roleType: emp.roleType,
                contractType: emp.contractType,
                contractStartDate: emp.contractStartDate,
                contractEndDate: emp.contractEndDate,
                monthlyHoursQuota: emp.monthlyHoursQuota,
                hourlyRate: emp.hourlyRate
              }));
            }}
            notifications={notifications}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            unreadChatCount={unreadChatCount}
            incomingSwapCount={incomingSwapRequests.length}
            isLightTheme={!isDark}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative">
            {/* Tab 1: Overview & Digital Punch Clock (Apenas CLT / Temporário) */}
            {activeEmployee.contractType !== 'PJ' && (employeeTab === 'overview' || employeeTab === 'pj_reports') && (() => {
              const filteredReminders = (reminders || []).filter(rem => {
                if (rem.completed) return false;
                if (!rem.assignedEmployeeIds || rem.assignedEmployeeIds.length === 0) return true;
                return rem.assignedEmployeeIds.includes(activeEmployee.id);
              });

              return (
                <EmployeeMainView
                  employee={activeEmployee}
                  shifts={shifts}
                  reminders={filteredReminders}
                  onCheckIn={handleCheckIn}
                  onNavigateToCalendar={() => setEmployeeTab('calendar')}
                  onNavigateToRequests={() => setEmployeeTab('requests')}
                  onNavigateToJustifications={() => setEmployeeTab('justifications')}
                  onNavigateToPjReports={() => setEmployeeTab('pj_reports')}
                  onShiftClick={handleOpenShiftDetails}
                  isLightTheme={!isDark}
                  employees={employees}
                  justifications={justifications}
                  onOpenJustificationModal={handleOpenJustificationModal}
                />
              );
            })()}

            {/* Tab PJ: Painel & Notas PJ (overview) OU Timesheet & Entregas PJ (pj_reports) */}
            {activeEmployee.contractType === 'PJ' && (employeeTab === 'pj_reports' || employeeTab === 'overview' || employeeTab === 'calendar' || employeeTab === 'requests' || employeeTab === 'justifications') && (() => {
              const pjReminders = (reminders || []).filter(rem => {
                if (rem.completed) return false;
                if (!rem.assignedEmployeeIds || rem.assignedEmployeeIds.length === 0) return true;
                return rem.assignedEmployeeIds.includes(activeEmployee.id);
              });

              return (
                <PjDeliverablesView
                  employee={activeEmployee}
                  isDark={isDark}
                  activeSubView={employeeTab === 'pj_reports' ? 'timesheet' : 'overview'}
                  reminders={pjReminders}
                  employees={employees}
                  onNavigateToCalendar={() => setEmployeeTab('calendar')}
                  onNavigateToTimesheet={() => setEmployeeTab('pj_reports')}
                  onReportCreated={(created) => {
                    setPjReports(prev => [created, ...prev.filter(p => p.id !== created.id)]);
                  }}
                />
              );
            })()}

            {/* Tab 2: Monthly / Weekly Calendar */}
            {employeeTab === 'calendar' && (
              <EmployeeCalendarView
                employee={activeEmployee}
                shifts={shifts}
                onShiftClick={handleOpenShiftDetails}
                onRequestTimeOff={() => setIsSwapModalOpen(true)}
                onSendJustification={() => setIsJustificationModalOpen(true)}
                isLightTheme={!isDark}
              />
            )}

            {/* Tab 3: Time Off & Swaps (Apenas CLT / Temporário) */}
            {activeEmployee.contractType !== 'PJ' && employeeTab === 'requests' && (
              <div
                className={`relative z-10 space-y-4 transition-colors duration-300 ${
                  !isDark ? 'text-slate-800' : 'text-white'
                }`}
              >
                {/* Modern Dashboard Banner */}
                <div
                  className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
                    !isDark
                      ? 'border-slate-200 bg-white shadow-slate-200/60'
                      : 'border-white/10 bg-[#0b0b0e]'
                  }`}
                  style={
                    !isDark
                      ? {
                          background:
                            'radial-gradient(ellipse 95% 130% at 95% 50%, rgba(150, 24, 60, 0.35) 0%, rgba(248, 150, 66, 0.23) 40%, rgba(255, 240, 172, 0.14) 65%, rgba(255, 255, 255, 0) 90%), #ffffff',
                        }
                      : {
                          background:
                            'radial-gradient(ellipse 75% 100% at 95% 50%, rgba(150, 24, 60, 0.40) 0%, rgba(248, 150, 66, 0.16) 45%, rgba(11, 11, 14, 0) 75%), #0b0b0e',
                        }
                  }
                >
                  <div className="relative z-10 space-y-2">
                    {/* Tag Superior */}
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md transition-colors duration-300 ${
                        !isDark
                          ? 'bg-slate-100 border border-slate-200'
                          : 'bg-white/[0.05] border border-white/10'
                      }`}
                    >
                      <ArrowLeftRight
                        className={`w-3.5 h-3.5 ${
                          !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold tracking-wider uppercase ${
                          !isDark ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        Solicitações & Escalas
                      </span>
                    </div>

                    {/* Título */}
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      <span className={`block ${!isDark ? 'text-slate-900' : 'text-white'}`}>
                        Minhas Solicitações
                      </span>
                      <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
                        de Folga e Troca de Turno
                      </span>
                    </h2>

                    {/* Subtítulo */}
                    <p
                      className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
                        !isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Acompanhe o status dos seus pedidos enviados para a gestão
                    </p>
                  </div>

                  {/* Botão Nova Solicitação */}
                  <button
                    type="button"
                    onClick={() => setIsSwapModalOpen(true)}
                    className="relative z-10 shrink-0 self-start md:self-center px-6 py-3 rounded-full bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#96183c]/25 hover:shadow-[#96183c]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Nova Solicitação</span>
                  </button>
                </div>

                {/* 1. Propostas de Troca Recebidas (Aguardando Meu Aceite) */}
                {incomingSwapRequests.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      <h3 className={`text-xs font-bold tracking-wider uppercase font-mono flex items-center gap-2 ${
                        !isDark ? 'text-amber-800' : 'text-amber-300'
                      }`}>
                        <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                        <span>Propostas de Troca Recebidas ({incomingSwapRequests.length})</span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {incomingSwapRequests.map(req => {
                        const shiftOnDate = shifts.find(s => s.employeeId === activeEmployee.id && s.date === req.date);

                        return (
                          <div
                            key={req.id}
                            className={`rounded-2xl border p-4 shadow-xl flex flex-col justify-between transition-all ${
                              !isDark
                                ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/40 border-amber-300 text-slate-800 shadow-amber-900/5'
                                : 'bg-gradient-to-br from-amber-950/25 to-black/60 border-amber-500/40 text-white shadow-black/50'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={req.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                                    alt={req.employeeName}
                                    className="w-9 h-9 rounded-full object-cover border border-amber-500/40 shrink-0"
                                  />
                                  <div>
                                    <p className="text-xs font-bold leading-tight flex items-center gap-1.5 flex-wrap">
                                      <span>{req.employeeName}</span>
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30">
                                        Deseja trocar com você
                                      </span>
                                    </p>
                                    <p className="text-[11px] opacity-80 mt-0.5">
                                      Turno do dia <strong className="font-mono text-amber-600 dark:text-amber-300">{req.date}</strong>
                                      {req.shiftStartTime && req.shiftEndTime && (
                                        <span> ({req.shiftStartTime} às {req.shiftEndTime})</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className={`p-2.5 rounded-xl text-xs italic ${
                                !isDark ? 'bg-white/80 border border-amber-200 text-slate-700' : 'bg-black/30 border border-white/5 text-slate-300'
                              }`}>
                                "{req.reason}"
                              </div>

                              {shiftOnDate && (
                                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-[11px] font-medium flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Aviso: Você já possui a escala "{shiftOnDate.title || 'Turno'}" ({shiftOnDate.startTime} - {shiftOnDate.endTime}) nesta mesma data!</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-3.5 pt-2.5 border-t border-amber-500/20 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectPeerSwap(req.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              >
                                Recusar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptPeerSwap(req.id)}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aceitar Troca</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Minhas Solicitações Enviadas */}
                <div className="space-y-3">
                  <h3 className={`text-xs font-bold tracking-wider uppercase font-mono ${
                    !isDark ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Minhas Solicitações Enviadas ({myRequests.length})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myRequests.length === 0 ? (
                    <div
                      className={`md:col-span-2 p-8 rounded-xl border text-center text-xs transition-all duration-300 ${
                        !isDark
                          ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                          : 'bg-[#0d0d10] border-white/10 text-slate-400'
                      }`}
                    >
                      Você ainda não possui solicitações de folga ou troca enviadas.
                    </div>
                  ) : (
                    myRequests.map(req => {
                      const isPendingPeer = req.type === 'swap' && req.peerStatus === 'pending';
                      const isAcceptedPeer = req.type === 'swap' && req.peerStatus === 'accepted';
                      const isRejectedPeer = req.type === 'swap' && req.peerStatus === 'rejected';

                      return (
                      <div
                        key={req.id}
                        className={`relative rounded-xl border overflow-hidden shadow-lg flex flex-col transition-all duration-300 ${
                          !isDark
                            ? 'bg-white border-slate-200 shadow-slate-200/60'
                            : 'bg-[#0d0d10] border-white/10'
                        }`}
                        style={{
                          borderLeft: `3px solid ${
                            req.type === 'swap' ? '#f89642' : '#96183c'
                          }`,
                        }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                                req.type === 'swap'
                                  ? !isDark
                                    ? 'bg-orange-50 text-orange-600 border border-orange-200'
                                    : 'bg-[#f89642]/15 text-[#f89642] border border-[#f89642]/30'
                                  : !isDark
                                  ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                                  : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                              }`}
                            >
                              {req.type === 'swap'
                                ? 'Troca de Turno'
                                : 'Folga Compensatória'}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                req.status === 'approved'
                                  ? !isDark
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : req.status === 'rejected' || isRejectedPeer
                                  ? !isDark
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : isAcceptedPeer
                                  ? !isDark
                                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                    : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                  : !isDark
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  req.status === 'approved'
                                    ? 'bg-emerald-400'
                                    : req.status === 'rejected' || isRejectedPeer
                                    ? 'bg-rose-400'
                                    : isAcceptedPeer
                                    ? 'bg-indigo-400'
                                    : 'bg-amber-300'
                                }`}
                              />
                              {req.status === 'approved'
                                ? 'Homologado pelo Gestor'
                                : isRejectedPeer
                                ? 'Recusado pelo Colega'
                                : req.status === 'rejected'
                                ? 'Recusado pelo Gestor'
                                : isAcceptedPeer
                                ? 'Colega Aceitou • Aguardando Gestor'
                                : isPendingPeer
                                ? 'Aguardando Aceite do Colega'
                                : 'Em Análise pelo Gestor'}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                              !isDark
                                ? 'text-slate-500 bg-slate-100 border border-slate-200'
                                : 'text-slate-400 bg-white/5 border border-white/10'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            {req.date}
                          </div>
                        </div>

                        <div
                          className={`mx-4 border-t ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        />

                        <div className="px-4 py-3 flex-1 space-y-2">
                          {req.targetEmployeeName && (
                            <div
                              className={`flex items-center gap-2 text-[11px] ${
                                !isDark ? 'text-slate-600' : 'text-slate-300'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 text-[#f89642] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                              <span>
                                Troca com{' '}
                                <strong className={!isDark ? 'text-slate-900' : 'text-white'}>
                                  {req.targetEmployeeName}
                                </strong>
                              </span>
                            </div>
                          )}

                          <p
                            className={`text-xs leading-relaxed line-clamp-3 ${
                              !isDark ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            "{req.reason}"
                          </p>
                        </div>

                        {req.managerNotes && (
                          <div
                            className={`mx-4 mb-2.5 p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                              req.status === 'approved'
                                ? !isDark
                                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                                : req.status === 'rejected'
                                ? !isDark
                                  ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                                : !isDark
                                ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-80" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold font-mono uppercase block tracking-wider opacity-75">
                                Parecer / Feedback da Gestão
                              </span>
                              <p className="leading-snug mt-0.5">{req.managerNotes}</p>
                            </div>
                          </div>
                        )}

                        <div
                          className={`px-4 pb-3 flex items-center justify-between gap-2 border-t pt-2 ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-mono ${
                              !isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Enviado: {req.createdAt}
                          </span>
                        </div>
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            </div>
          )}

            {/* Tab 4: Justifications & Medical Notes (Apenas CLT / Temporário) */}
            {activeEmployee.contractType !== 'PJ' && employeeTab === 'justifications' && (
              <div
                className={`relative z-10 space-y-4 transition-colors duration-300 ${
                  !isDark ? 'text-slate-800' : 'text-white'
                }`}
              >
                {/* Modern Dashboard Banner */}
                <div
                  className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl transition-all duration-300 ${
                    !isDark
                      ? 'border-slate-200 bg-white shadow-slate-200/60'
                      : 'border-white/10 bg-[#0b0b0e]'
                  }`}
                  style={
                    !isDark
                      ? {
                          background:
                            'radial-gradient(ellipse 95% 130% at 95% 50%, rgba(150, 24, 60, 0.35) 0%, rgba(248, 150, 66, 0.23) 40%, rgba(255, 240, 172, 0.14) 65%, rgba(255, 255, 255, 0) 90%), #ffffff',
                        }
                      : {
                          background:
                            'radial-gradient(ellipse 75% 100% at 95% 50%, rgba(150, 24, 60, 0.40) 0%, rgba(248, 150, 66, 0.16) 45%, rgba(11, 11, 14, 0) 75%), #0b0b0e',
                        }
                  }
                >
                  <div className="relative z-10 space-y-2">
                    {/* Tag Superior */}
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md transition-colors duration-300 ${
                        !isDark
                          ? 'bg-slate-100 border border-slate-200'
                          : 'bg-white/[0.05] border border-white/10'
                      }`}
                    >
                      <FileText
                        className={`w-3.5 h-3.5 ${
                          !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-bold tracking-wider uppercase ${
                          !isDark ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      >
                        Atestados & Abonos
                      </span>
                    </div>

                    {/* Título */}
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      <span className={`block ${!isDark ? 'text-slate-900' : 'text-white'}`}>
                        Atestados Médicos
                      </span>
                      <span className="block bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent">
                        & Justificativas de Ausência
                      </span>
                    </h2>

                    {/* Subtítulo */}
                    <p
                      className={`text-xs sm:text-sm font-normal max-w-xl leading-relaxed ${
                        !isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Comprovantes enviados para abono e auditoria de ponto
                    </p>
                  </div>

                  {/* Botão Enviar Novo Atestado */}
                  <button
                    type="button"
                    onClick={() => setIsJustificationModalOpen(true)}
                    className="relative z-10 shrink-0 self-start md:self-center px-6 py-3 rounded-full bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac] hover:brightness-110 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#96183c]/25 hover:shadow-[#96183c]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Enviar Novo Atestado</span>
                  </button>
                </div>

                {/* Lista */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myJustifications.length === 0 ? (
                    <div
                      className={`md:col-span-2 p-8 rounded-xl border text-center text-xs transition-all duration-300 ${
                        !isDark
                          ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                          : 'bg-[#0d0d10] border-white/10 text-slate-400'
                      }`}
                    >
                      Nenhuma justificativa ou atestado registrado para este perfil.
                    </div>
                  ) : (
                    myJustifications.map(just => (
                      <div
                        key={just.id}
                        className={`relative rounded-xl border overflow-hidden shadow-lg flex flex-col transition-all duration-300 ${
                          !isDark
                            ? 'bg-white border-slate-200 shadow-slate-200/60'
                            : 'bg-[#0d0d10] border-white/10'
                        }`}
                        style={{
                          borderLeft: '3px solid #96183c',
                        }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${
                                !isDark
                                  ? 'bg-rose-50 text-[#96183c] border border-rose-200'
                                  : 'bg-[#96183c]/20 text-[#faf0ac] border border-[#96183c]/30'
                              }`}
                            >
                              📄 Atestado / Declaração
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                                just.status === 'approved'
                                  ? !isDark
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : just.status === 'rejected'
                                  ? !isDark
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : !isDark
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  just.status === 'approved'
                                    ? 'bg-emerald-400'
                                    : just.status === 'rejected'
                                    ? 'bg-rose-400'
                                    : 'bg-amber-300'
                                }`}
                              />
                              {just.status === 'approved'
                                ? 'Homologado'
                                : just.status === 'rejected'
                                ? 'Recusado'
                                : 'Em Análise pelo RH'}
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg shrink-0 ${
                              !isDark
                                ? 'text-slate-500 bg-slate-100 border border-slate-200'
                                : 'text-slate-400 bg-white/5 border border-white/10'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            {just.date}
                          </div>
                        </div>

                        <div
                          className={`mx-4 border-t ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        />

                        <div className="px-4 py-3 flex-1 space-y-2">
                          <p
                            className={`text-xs leading-relaxed line-clamp-3 ${
                              !isDark ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            "{just.reason}"
                          </p>

                          {just.documentName && (
                            <button
                              type="button"
                              onClick={() => openDocumentSafe(just.documentUrl, just.documentName)}
                              title="Clique para visualizar o atestado"
                              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-all cursor-pointer ${
                                !isDark
                                  ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[#96183c]'
                                  : 'bg-[#96183c]/10 hover:bg-[#96183c]/20 border border-[#96183c]/25 text-[#f89642]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    !isDark ? 'text-[#96183c]' : 'text-[#f89642]'
                                  }`}
                                />
                                <span
                                  className={`text-[11px] font-semibold truncate ${
                                    !isDark ? 'text-[#96183c]' : 'text-[#faf0ac]'
                                  }`}
                                >
                                  {just.documentName}
                                </span>
                              </div>
                              <span className="text-[10px] font-medium underline opacity-80 shrink-0">
                                Visualizar
                              </span>
                            </button>
                          )}
                        </div>

                        {just.managerNotes && (
                          <div
                            className={`mx-4 mb-2.5 p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                              just.status === 'approved'
                                ? !isDark
                                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                                : just.status === 'rejected'
                                ? !isDark
                                  ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                                : !isDark
                                ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-80" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold font-mono uppercase block tracking-wider opacity-75">
                                Parecer / Feedback da Gestão
                              </span>
                              <p className="leading-snug mt-0.5">{just.managerNotes}</p>
                            </div>
                          </div>
                        )}

                        <div
                          className={`px-4 pb-3 border-t pt-2 ${
                            !isDark ? 'border-slate-200' : 'border-white/5'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-mono ${
                              !isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Enviado: {just.submittedAt}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 5: Chat da Equipe */}
            {employeeTab === 'chat' && (
              <div className="space-y-4">
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[420px]">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96183c] to-[#f89847] text-white flex items-center justify-center shadow-lg">
                    <MessageSquare className="w-8 h-8 text-[#faf0ac]" />
                  </div>
                  <div className="max-w-md">
                    <h2 className="text-lg font-extrabold text-slate-900">Chat da Equipe & Gestão em Tempo Real</h2>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Conectado ao Supabase com canais corporativos (<span className="font-mono text-slate-700">#geral</span>, <span className="font-mono text-slate-700">#escalas</span>), grupos dinâmicos e conversa privada 1 a 1 com a gestão.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChatModalOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#96183c] to-[#f89847] hover:brightness-110 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-[#faf0ac]" />
                    <span>Abrir Chat da Equipe</span>
                    {unreadChatCount > 0 && (
                      <span className="px-2 py-0.5 bg-white text-[#96183c] rounded-full text-[11px] font-extrabold shadow-sm">
                        {unreadChatCount} {unreadChatCount === 1 ? 'nova' : 'novas'}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      )}

      {/* Modals */}
      <ManagerRequestsModal
        isOpen={isManagerRequestsModalOpen}
        onClose={() => setIsManagerRequestsModalOpen(false)}
        requests={requests}
        justifications={justifications}
        pjReports={pjReports}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onApproveJustification={handleApproveJustification}
        onRejectJustification={handleRejectJustification}
        onApprovePjReport={handleApprovePjReport}
        onRejectPjReport={handleRejectPjReport}
      />

      <ShiftDetailModal
        shift={selectedShiftForDetail}
        employees={employees}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedShiftForDetail(null);
        }}
        isLightTheme={!isDark}
      />

      <ShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        currentEmployee={activeEmployee}
        employees={employees}
        myShifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        allShifts={shifts}
        onSubmitRequest={handleSubmitRequest}
        isLightTheme={!isDark}
      />

      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => {
          setIsJustificationModalOpen(false);
          setJustificationPrefill(null);
        }}
        currentEmployee={activeEmployee}
        shifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitJustification={handleSubmitJustification}
        isLightTheme={!isDark}
        initialShiftId={justificationPrefill?.shiftId}
        initialDate={justificationPrefill?.date}
        initialReason={justificationPrefill?.reason}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          if (activeEmployee?.id) {
            markAllNotificationsAsReadSupabase(activeEmployee.id);
          }
        }}
        onClearAll={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        isLightTheme={!isDark}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          resetUnreadChatCount();
        }}
        currentEmployee={activeEmployee}
        employees={employees}
        isLightTheme={!isDark}
      />

      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={activeEmployee}
        employees={employees}
        onUpdateAvatar={handleUpdateAvatar}
        onLogout={handleLogout}
        theme={theme}
      />

      {/* Halo Toaster */}
      <PolishedToaster position="top-right" />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
