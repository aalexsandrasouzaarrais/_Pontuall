import React, { useState } from 'react';
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
import { 
  LoginView 
} from '@/modules/auth/components/LoginView';
import { 
  ProfileEditModal 
} from '@/shared/components/ProfileEditModal';
import { supabase } from '@/shared/services/supabase';
import { 
  INITIAL_EMPLOYEES, 
  getInitialShifts, 
  INITIAL_REQUESTS, 
  INITIAL_JUSTIFICATIONS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_REMINDERS,
  MANAGER_PROFILE
} from './data/mockData';
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
  updateSolicitacaoStatusSupabase
} from '@/modules/requests/services/requestService';
import { 
  Employee, 
  Shift, 
  TimeOffRequest, 
  AbsenceJustification, 
  NotificationItem,
  ManagerReminder
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
  ShieldCheck, 
  User, 
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
import { safeStorage } from '@/shared/utils/safeStorage';
import logoWideDark from './assets/logo-pontual-wide-dark.png';
import logoWideLight from './assets/logo-pontual-wide.png';

function AppContent() {
  const { theme, isDark, toggleTheme } = useTheme();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return !!safeStorage.getItem('pontual_active_user');
    } catch {
      return false;
    }
  });

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
    setIsAuthenticated(true);
  };

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<Employee>(() => {
    try {
      const savedUserStr = safeStorage.getItem('pontual_active_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        const match = INITIAL_EMPLOYEES.find(e => 
          e.id === parsed.id || 
          e.id === parsed.Idf_Colaborador ||
          e.email?.toLowerCase() === parsed.email?.toLowerCase() ||
          e.email?.toLowerCase() === parsed.Eml_Corporativo?.toLowerCase() ||
          (parsed.emailSecundario && e.email?.toLowerCase() === parsed.emailSecundario?.toLowerCase())
        );
        if (match && !parsed.Idf_Empresa && !parsed.companyId) return match;

          const isRhParsed = parsed.isRh !== undefined ? parsed.isRh : (parsed.roleType === 'rh' || parsed.perfil === 'rh' || parsed.email?.toLowerCase() === 'gestor@pontual.com');
          return {
            id: parsed.Idf_Colaborador || parsed.id || `emp-${Date.now()}`,
            name: parsed.Nme_Colaborador || parsed.nome || parsed.name || 'Gestor',
            role: parsed.Tpo_Cargo || parsed.cargo || parsed.role || 'Gestor Geral',
            department: parsed.Des_Departamento || parsed.departamento || parsed.department || 'Gestão de Pessoas & Operações',
            avatar: parsed.Des_Avatar_Url || parsed.avatar || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
            email: parsed.Eml_Corporativo || parsed.email || '',
            phone: parsed.Num_Telefone || parsed.phone || '(11) 98765-4321',
            standardHoursPerWeek: parsed.Num_Horas_Semanais || parsed.standardHoursPerWeek || 44,
            registrationId: parsed.Cod_Matricula || parsed.registrationId || 'GST-0001',
            companyId: parsed.Idf_Empresa || parsed.companyId || undefined,
            isMasterManager: parsed.Flg_Gestor_Master !== undefined ? parsed.Flg_Gestor_Master : (parsed.isMasterManager || false),
            isRh: isRhParsed,
            roleType: parsed.roleType || (isRhParsed ? 'rh' : (parsed.Flg_Gestor_Master || parsed.perfil === 'gestor' ? 'gestor' : 'colaborador')),
            companyCnpj: parsed.companyCnpj || undefined,
            managerIds: parsed.managerIds || []
          };
        }
      } catch {}
      return INITIAL_EMPLOYEES[0];
    });
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [requests, setRequests] = useState<TimeOffRequest[]>([]);
    const [justifications, setJustifications] = useState<AbsenceJustification[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [reminders, setReminders] = useState<ManagerReminder[]>([]);
    
    // Employee Tabs
    const [employeeTab, setEmployeeTab] = useState<'overview' | 'calendar' | 'requests' | 'justifications' | 'chat'>('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Sincronização e filtragem por empresa/gestor com o Supabase (TAB_Colaborador, TAB_Escala_Turno, TAB_Solicitacao_Colaborador, TAB_Justificativa_Ausencia, TAB_Lembrete)
    React.useEffect(() => {
      async function loadDataFromSupabase() {
        if (!isAuthenticated || !activeEmployee) return;

        // Se o usuário ativo for um UUID do Supabase e não tiver companyId carregado no safeStorage, reidrata do banco
        let currentEmp = activeEmployee;
        if (isUuid(activeEmployee.id) && !activeEmployee.companyId) {
          const fresh = await getColaboradorByIdSupabase(activeEmployee.id);
          if (fresh && fresh.companyId) {
            currentEmp = { ...activeEmployee, ...fresh };
            setActiveEmployee(currentEmp);
          }
        }

        const isDemoUser = !currentEmp.companyId && (
          currentEmp.id === 'mgr-1' || 
          currentEmp.id === 'mgr-2' ||
          currentEmp.id === 'emp-1' ||
          currentEmp.email === 'gestor@pontual.com' ||
          currentEmp.email === 'gestor.ti@pontual.com' ||
          currentEmp.email === 'colaborador@pontual.com'
        );

        try {
          const isRhUser = currentEmp.isRh || currentEmp.roleType === 'rh' || currentEmp.isMasterManager;
          const filter = {
            companyId: currentEmp.companyId || undefined,
            gestorId: (isRhUser || !currentEmp.companyId) ? undefined : currentEmp.id
          };

          const dbEmployees = await getColaboradoresSupabase(filter);
          
          let finalEmployees: Employee[] = (dbEmployees && dbEmployees.length > 0) ? dbEmployees : (isDemoUser ? INITIAL_EMPLOYEES : []);
          if (currentRole === 'employee' && currentEmp && !isRhUser) {
            if (!finalEmployees.some(e => e.id === currentEmp.id || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase()))) {
              finalEmployees = [currentEmp, ...finalEmployees];
            }
          }

          setEmployees(finalEmployees);

          // Busca turnos estritamente dos colaboradores pertencentes à empresa/equipe
          const empIds = finalEmployees.map(e => e.id);
          const dbShifts = await getShiftsSupabase(empIds);
          setShifts((dbShifts && dbShifts.length > 0) ? dbShifts : (isDemoUser ? getInitialShifts() : []));

          // Busca lembretes da gestão no Supabase filtrados por empresa e equipe
          const dbReminders = await getRemindersSupabase({
            companyId: currentEmp.companyId,
            creatorId: currentEmp.id,
            visibleEmployeeIds: empIds
          });
          if (dbReminders && dbReminders.length > 0) {
            setReminders(dbReminders);
          } else if (isDemoUser) {
            setReminders(INITIAL_REMINDERS);
          } else {
            setReminders([]);
          }

          // Busca solicitações e justificativas salvas no Supabase vinculadas à equipe
          const validScopeIds = empIds.filter(isUuid);
          const dbRequests = await getSolicitacoesSupabase(validScopeIds.length > 0 ? validScopeIds : undefined);
          const dbJustifications = await getJustificativasSupabase(validScopeIds.length > 0 ? validScopeIds : undefined);

          const enrichedRequests = dbRequests.map(r => {
            const emp = finalEmployees.find(e => e.id === r.employeeId || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase())) 
              || INITIAL_EMPLOYEES.find(e => e.id === r.employeeId) 
              || (r.employeeId === currentEmp.id ? currentEmp : undefined);
            const targetEmp = finalEmployees.find(e => e.id === r.targetEmployeeId) || INITIAL_EMPLOYEES.find(e => e.id === r.targetEmployeeId);
            return {
              ...r,
              employeeName: emp?.name || r.employeeName || 'Colaborador',
              employeeAvatar: emp?.avatar || r.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              targetEmployeeName: targetEmp?.name || r.targetEmployeeName || ''
            };
          });

          const enrichedJustifications = dbJustifications.map(j => {
            const emp = finalEmployees.find(e => e.id === j.employeeId || (e.email && currentEmp.email && e.email.toLowerCase() === currentEmp.email.toLowerCase())) 
              || INITIAL_EMPLOYEES.find(e => e.id === j.employeeId) 
              || (j.employeeId === currentEmp.id ? currentEmp : undefined);
            return {
              ...j,
              employeeName: emp?.name || j.employeeName || 'Colaborador',
              employeeAvatar: emp?.avatar || j.employeeAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
            };
          });

          setRequests(prev => {
            const mapById = new Map<string, TimeOffRequest>();
            if (isDemoUser) {
              INITIAL_REQUESTS.forEach(r => mapById.set(r.id, r));
            }
            enrichedRequests.forEach(r => mapById.set(r.id, r));
            prev.forEach(r => { if (!mapById.has(r.id)) mapById.set(r.id, r); });
            return Array.from(mapById.values());
          });

          setJustifications(prev => {
            const mapById = new Map<string, AbsenceJustification>();
            if (isDemoUser) {
              INITIAL_JUSTIFICATIONS.forEach(j => mapById.set(j.id, j));
            }
            enrichedJustifications.forEach(j => mapById.set(j.id, j));
            prev.forEach(j => { if (!mapById.has(j.id)) mapById.set(j.id, j); });
            return Array.from(mapById.values());
          });

          setNotifications(isDemoUser ? INITIAL_NOTIFICATIONS : []);

        } catch (err) {
          console.warn('Erro ao carregar dados do Supabase:', err);
        }
      }

      loadDataFromSupabase();
    }, [activeEmployee?.id, activeEmployee?.companyId, isAuthenticated]);

  // Modals state
  const [selectedShiftForDetail, setSelectedShiftForDetail] = useState<Shift | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isJustificationModalOpen, setIsJustificationModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isManagerRequestsModalOpen, setIsManagerRequestsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Monitora autenticação via Google Workspace (OAuth redirect)
  React.useEffect(() => {
    const handleGoogleSession = async (session: any) => {
      if (!session?.user?.email) return;

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
        Flg_Ativo: true
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
      if (session) {
        handleGoogleSession(session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user?.email) {
        await handleGoogleSession(session);
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

  // Floating Toast Notification
  const [toast, setToast] = useState<{
    id: number;
    title: string;
    message: string;
    type?: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ id, title, message, type });
    setTimeout(() => {
      setToast(current => (current?.id === id ? null : current));
    }, 5000);
  };



  // Check-In handler for employee
  const handleCheckIn = (shiftId: string, locationData: { address: string; gpsValidated: boolean }) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Salva o registro de ponto na TAB_Registro_Ponto no Supabase
    registerPunchSupabase(shiftId, activeEmployee.id, locationData);

    setShifts(prev => prev.map(s => {
      if (s.id === shiftId) {
        return {
          ...s,
          attendanceStatus: 'present',
          checkInTime: timeStr,
          checkInLocation: {
            latitude: -23.5505,
            longitude: -46.6333,
            address: locationData.address,
            gpsValidated: locationData.gpsValidated,
          }
        };
      }
      return s;
    }));

    // Add confirmation notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Ponto Registrado com Sucesso!',
      message: `Sua presença foi confirmada às ${timeStr} na Sede Employer (GPS Validado).`,
      type: 'system',
      timestamp: 'Agora',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleUpdateEmployee = async (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
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
      date: req.date || new Date().toISOString().split('T')[0],
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
    } catch (err) {
      console.warn('Erro ao salvar solicitação no Supabase:', err);
    }
    showToast('Solicitação Enviada', 'Sua solicitação foi gravada no banco de dados e enviada para o Gestor e RH.', 'success');
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
      date: just.date || new Date().toISOString().split('T')[0],
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
      date: newShiftData.date || new Date().toISOString().split('T')[0],
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
    try {
      const saved = await createShiftSupabase(created);
      setShifts(prev => [...prev, saved || created]);
    } catch {
      setShifts(prev => [...prev, created]);
    }
  };

  const handleUpdateShift = (updated: Shift, notifyEmployee: boolean = true, changeReason?: string) => {
    const prevShift = shifts.find(s => s.id === updated.id);
    setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));

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

  const handleApproveRequest = async (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', managerNotes: 'Aprovado pelo gestor' } : r));
    await updateSolicitacaoStatusSupabase(id, 'approved', 'Aprovado pelo gestor');
    showToast('Solicitação Aprovada', 'A solicitação foi aprovada e salva no Supabase.', 'success');
  };

  const handleRejectRequest = async (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected', managerNotes: 'Recusado pelo gestor' } : r));
    await updateSolicitacaoStatusSupabase(id, 'rejected', 'Recusado pelo gestor');
    showToast('Solicitação Recusada', 'A solicitação foi recusada no Supabase.', 'info');
  };

  const handleApproveJustification = async (id: string) => {
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'approved', managerNotes: 'Homologado pelo RH' } : j));
    await updateJustificativaStatusSupabase(id, 'approved', 'Homologado pelo RH');
    showToast('Atestado Homologado', 'O atestado/justificativa foi homologado e atualizado no Supabase.', 'success');
  };

  const handleRejectJustification = async (id: string) => {
    setJustifications(prev => prev.map(j => j.id === id ? { ...j, status: 'rejected', managerNotes: 'Não homologado' } : j));
    await updateJustificativaStatusSupabase(id, 'rejected', 'Não homologado');
    showToast('Atestado Recusado', 'A justificativa foi marcada como não homologada no Supabase.', 'info');
  };

  const handleLogout = () => {
    try {
      safeStorage.removeItem('pontual_active_user');
      safeStorage.removeItem('pontual_role');
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

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length + justifications.filter(j => j.status === 'pending').length;
  const myRequests = requests.filter(r => r.employeeId === activeEmployee.id || r.targetEmployeeId === activeEmployee.id);
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

        {/* Center/Right: Switcher de Perfil + Botão de Tema */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Switcher Pill de Perfil */}
          <div className={`flex items-center gap-1.5 p-1 rounded-full border transition-colors ${
            !isDark ? 'bg-slate-100 border-slate-200' : 'bg-[#151822] border-[#252A3A]'
          }`}>
            <button
              onClick={() => {
                setCurrentRole('manager');
                safeStorage.setItem('pontual_role', 'manager');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'manager'
                  ? 'text-white shadow-md font-black'
                  : !isDark ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              style={currentRole === 'manager' ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : {}}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>👔 Visão do Gestor</span>
            </button>

            <button
              onClick={() => {
                setCurrentRole('employee');
                safeStorage.setItem('pontual_role', 'employee');
              }}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentRole === 'employee'
                  ? 'text-white shadow-md font-black'
                  : !isDark ? 'text-[#96183c] hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
              style={currentRole === 'employee' ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : {}}
            >
              <User className="w-3.5 h-3.5" />
              <span>👤 Portal do Colaborador</span>
            </button>
          </div>

          {/* Botão de Tema Moderno (Claro / Escuro) ativo tanto para Gestor quanto para Colaborador */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            title={!isDark ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
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

          {/* Botão Sair / Logout para retornar ao Login */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair da conta e voltar ao Login"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                : 'border-rose-900/40 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Sair</span>
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
            onSwitchToEmployee={() => setCurrentRole('employee')}
            pendingRequestsCount={pendingRequestsCount}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            justifications={justifications}
            requests={requests}
            onApproveJustification={handleApproveJustification}
            onRejectJustification={handleRejectJustification}
          />
        </div>
      ) : (
        /* EMPLOYEE VIEW */
        <div className={`flex-1 flex overflow-hidden ${(employeeTab === 'requests' || employeeTab === 'justifications') ? (!isDark ? 'bg-[#f4f5f8]' : 'colaborador-page-container') : (!isDark ? 'bg-[#f4f5f8]' : 'bg-[#050104]')}`}>
          {/* Full-height Collapsible Sidebar */}
          <EmployeeSidebar
            activeTab={employeeTab}
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
            onSelectEmployee={setActiveEmployee}
            notifications={notifications}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            isLightTheme={!isDark}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative">
            {/* Tab 1: Overview & Digital Punch Clock */}
            {employeeTab === 'overview' && (() => {
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
                  onShiftClick={handleOpenShiftDetails}
                  isLightTheme={!isDark}
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

            {/* Tab 3: Time Off & Swaps */}
            {employeeTab === 'requests' && (
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

                {/* Lista */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myRequests.length === 0 ? (
                    <div
                      className={`md:col-span-2 p-8 rounded-xl border text-center text-xs transition-all duration-300 ${
                        !isDark
                          ? 'bg-white border-slate-200 text-slate-500 shadow-sm'
                          : 'bg-[#0d0d10] border-white/10 text-slate-400'
                      }`}
                    >
                      Você ainda não possui solicitações de folga ou troca cadastradas.
                    </div>
                  ) : (
                    myRequests.map(req => (
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
                                  : req.status === 'rejected'
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
                                  req.status === 'approved'
                                    ? 'bg-emerald-400'
                                    : req.status === 'rejected'
                                    ? 'bg-rose-400'
                                    : 'bg-amber-300'
                                }`}
                              />
                              {req.status === 'approved'
                                ? 'Aprovado'
                                : req.status === 'rejected'
                                ? 'Rejeitado'
                                : 'Em Análise'}
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

                          {req.managerNotes && (
                            <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              {req.managerNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Justifications & Medical Notes */}
            {employeeTab === 'justifications' && (
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
                            <div
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                                !isDark
                                  ? 'bg-rose-50 border border-rose-200'
                                  : 'bg-[#96183c]/10 border border-[#96183c]/25'
                              }`}
                            >
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
                          )}
                        </div>

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
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onApproveJustification={handleApproveJustification}
        onRejectJustification={handleRejectJustification}
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
        onSubmitRequest={handleSubmitRequest}
        isLightTheme={!isDark}
      />

      <JustificationModal
        isOpen={isJustificationModalOpen}
        onClose={() => setIsJustificationModalOpen(false)}
        currentEmployee={activeEmployee}
        shifts={shifts.filter(s => s.employeeId === activeEmployee.id)}
        onSubmitJustification={handleSubmitJustification}
        isLightTheme={!isDark}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        isLightTheme={!isDark}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        currentEmployee={
          currentRole === 'manager'
            ? (employees.find(e => e.role?.toLowerCase().includes('gerente') || e.role?.toLowerCase().includes('gestor')) || {
                id: 'gestor-camila',
                name: 'Camila Duarte',
                role: 'Gestora Geral',
                department: 'Gestão de Pessoas & Operações',
                avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
                email: 'gestor@pontual.com',
                phone: '(11) 98765-4321',
                standardHoursPerWeek: 44
              })
            : activeEmployee
        }
        employees={employees}
        isLightTheme={!isDark}
      />

      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={activeEmployee}
        onUpdateAvatar={handleUpdateAvatar}
        theme={theme}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-sm w-full animate-in slide-in-from-top-3 fade-in duration-200">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
              isDark 
                ? 'bg-[#181A24]/95 border-emerald-500/40 text-white shadow-black/70' 
                : 'bg-white/95 border-emerald-500/40 text-slate-800 shadow-slate-300/60'
            }`}
            style={{ borderLeft: '4px solid #10b981' }}
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                {toast.title}
              </h4>
              <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
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
