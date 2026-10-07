import React, { useState, useEffect } from 'react';
import { User, X, Check, Sparkles, RefreshCw, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Employee } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';
import { safeStorage } from '@/shared/utils/safeStorage';
import { sendWelcomeEmail as sendWelcomeEmailService } from '@/modules/auth/services/emailService';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (employee: Employee) => void;
  theme?: 'light' | 'dark';
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
  theme: propTheme,
}) => {
  const { theme: ctxTheme } = useTheme();
  const currentTheme = propTheme || ctxTheme || 'dark';
  const isDark = currentTheme !== 'light';

  const [activeTab, setActiveTab] = useState<'PERFIL' | 'ATRIBUIÇÕES'>('PERFIL');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Função para gerar uma matrícula aleatória única
  const generateRandomId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `PNT-${randomNum}`;
  };

  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Atendimento');
  const [userRole, setUserRole] = useState('Colaborador');
  const [employmentType, setEmploymentType] = useState('CLT');

  // Formata o número de telefone no padrão brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  const formatPhoneNumber = (value: string) => {
    let digits = value.replace(/\D/g, '');

    // Se colar com código de país do Brasil (+55), remove o 55 inicial
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }

    // Limita estritamente ao tamanho máximo de telefone brasileiro (11 dígitos: DDD + 9 dígitos)
    digits = digits.slice(0, 11);

    if (!digits) return '';
    if (digits.length <= 2) {
      return `(${digits}`;
    }
    if (digits.length <= 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Estados de validação e feedback
  const [firstNameError, setFirstNameError] = useState(false);
  const [lastNameError, setLastNameError] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [startDateError, setStartDateError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Reseta ou inicializa o formulário ao abrir
  useEffect(() => {
    if (isOpen) {
      setActiveTab('PERFIL');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setEmployeeId(generateRandomId());
      setRole('');
      setDepartment('Atendimento');
      setUserRole('Colaborador');
      setEmploymentType('CLT');
      setStartDate(new Date().toISOString().split('T')[0]);
      setSendWelcomeEmail(true);
      setFirstNameError(false);
      setLastNameError(false);
      setRoleError(false);
      setStartDateError(false);
      setErrorMessage(null);
      setIsSaved(false);
    }
  }, [isOpen]);

  // Fechamento via tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Validação da etapa 1
  const validateStep1 = () => {
    const isFirstEmpty = !firstName.trim();
    const isLastEmpty = !lastName.trim();

    setFirstNameError(isFirstEmpty);
    setLastNameError(isLastEmpty);

    if (isFirstEmpty || isLastEmpty) {
      setErrorMessage('Preencha os campos obrigatórios da Etapa 1 (Nome e Sobrenome) para prosseguir.');
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Validação da etapa 2
  const validateStep2 = () => {
    const isRoleEmpty = !role.trim();
    const isDateEmpty = !startDate;

    setRoleError(isRoleEmpty);
    setStartDateError(isDateEmpty);

    if (isRoleEmpty || isDateEmpty) {
      setErrorMessage('Preencha as informações obrigatórias da Etapa 2 (Cargo / Função) para salvar o colaborador.');
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setActiveTab('ATRIBUIÇÕES');
    }
  };

  const handleTabChange = (targetTab: 'PERFIL' | 'ATRIBUIÇÕES') => {
    if (targetTab === 'PERFIL') {
      setActiveTab('PERFIL');
      setErrorMessage(null);
    } else {
      // Para ir para Atribuições, precisa preencher a etapa 1 primeiro
      if (validateStep1()) {
        setActiveTab('ATRIBUIÇÕES');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se estiver na etapa 1, não permite salvar! Deve avançar para a etapa 2.
    if (activeTab === 'PERFIL') {
      handleNextStep();
      return;
    }

    // Se estiver na etapa 2:
    // 1. Valida se a etapa 1 continua válida
    if (!validateStep1()) {
      setActiveTab('PERFIL');
      return;
    }

    // 2. Valida se a etapa 2 foi preenchida
    if (!validateStep2()) {
      return;
    }

    let activeCompanyId: string | undefined = undefined;
    let activeGestorId: string | undefined = undefined;

    try {
      const activeUser = JSON.parse(safeStorage.getItem('pontual_active_user') || '{}');
      activeCompanyId = activeUser.Idf_Empresa || activeUser.companyId;
      activeGestorId = activeUser.Idf_Colaborador || activeUser.id;
    } catch {}

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanId = employeeId.trim() || generateRandomId();
    const isRhSelected = userRole === 'Administrador' || userRole === 'RH';
    const isGestorSelected = userRole === 'Gestor';
    const roleTypeVal: 'rh' | 'gestor' | 'colaborador' = isRhSelected ? 'rh' : isGestorSelected ? 'gestor' : 'colaborador';

    const newEmp: Employee = {
      id: `emp-${cleanId}`,
      registrationId: cleanId,
      name: fullName,
      role: role.trim(),
      department: department.trim() || 'Operações',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      email: email.trim() || `${firstName.toLowerCase().replace(/\s+/g, '')}@pontual.com.br`,
      phone: phone.trim() || '(11) 98765-4321',
      standardHoursPerWeek: employmentType === 'PJ' ? 40 : 44,
      contractType: employmentType as 'CLT' | 'PJ' | 'TEMPORARIO',
      workplace: 'Sede Pontual - Matriz',
      companyId: activeCompanyId,
      roleType: roleTypeVal,
      isRh: isRhSelected,
      isMasterManager: isRhSelected,
      managerIds: activeGestorId ? [activeGestorId] : []
    };

    onAddEmployee(newEmp);

    if (sendWelcomeEmail && newEmp.email) {
      try {
        await sendWelcomeEmailService({
          email: newEmp.email,
          nome: newEmp.name,
          matricula: cleanId,
        });
      } catch (err) {
        console.warn('Erro ao disparar e-mail de ativação:', err);
      }
    }

    setIsSaved(true);
    setErrorMessage(null);

    // Fecha suavemente após confirmar o salvamento na tela
    setTimeout(() => {
      onClose();
      setIsSaved(false);
    }, 700);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 font-sans border transition-colors ${
          isDark
            ? 'bg-[#12131A] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl'
        }`}
        style={{ maxHeight: '92vh' }}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89847] to-[#faf0ac]" />

        {/* Modal Header */}
        <div className={`px-6 py-4.5 flex items-start justify-between border-b ${
          isDark ? 'border-white/10' : 'border-slate-150 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Adicionar Novo Colaborador
              </h2>
              <p className={`text-xs mt-0.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Cadastre as informações de perfil e atribuições no sistema Pontual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/10'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Fechar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`px-6 py-2.5 flex items-center gap-2 border-b ${
          isDark ? 'bg-[#0B0C10]/80 border-white/8' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => handleTabChange('PERFIL')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PERFIL'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            style={activeTab === 'PERFIL' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
            } : undefined}
          >
            {firstName.trim() && lastName.trim() && (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>1. PERFIL</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('ATRIBUIÇÕES')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ATRIBUIÇÕES'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            style={activeTab === 'ATRIBUIÇÕES' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
            } : undefined}
          >
            {role.trim() && (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>2. ATRIBUIÇÕES</span>
          </button>
        </div>

        {/* Banner de Mensagem de Erro / Orientação */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-500 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Banner de Mensagem de Sucesso */}
        {isSaved && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Colaborador salvo com sucesso! Concluindo cadastro...</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 210px)' }}>
          <div className="p-6 space-y-5">

            {activeTab === 'PERFIL' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Top Row: First Name, Last Name, Avatar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold mb-1.5 block ${
                          firstNameError ? 'text-rose-500 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          Nome*
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            if (e.target.value.trim()) setFirstNameError(false);
                          }}
                          placeholder="Ex: Carlos"
                          className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                            firstNameError
                              ? 'border-rose-500 ring-2 ring-rose-500/20'
                              : isDark
                                ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                          }`}
                        />
                        {firstNameError && (
                          <span className="text-[11px] text-rose-500 mt-1 block">Nome é obrigatório</span>
                        )}
                      </div>
                      <div>
                        <label className={`text-xs font-semibold mb-1.5 block ${
                          lastNameError ? 'text-rose-500 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          Sobrenome*
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => {
                            setLastName(e.target.value);
                            if (e.target.value.trim()) setLastNameError(false);
                          }}
                          placeholder="Ex: Silva"
                          className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                            lastNameError
                              ? 'border-rose-500 ring-2 ring-rose-500/20'
                              : isDark
                                ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                          }`}
                        />
                        {lastNameError && (
                          <span className="text-[11px] text-rose-500 mt-1 block">Sobrenome é obrigatório</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className={`text-xs font-semibold mb-1.5 block ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        E-mail Corporativo
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="carlos.silva@pontual.com.br"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                          isDark
                            ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Avatar Preview Box */}
                  <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${
                    isDark
                      ? 'border-white/10 bg-white/5'
                      : 'border-slate-200 bg-slate-50 shadow-2xs'
                  }`}>
                    <div className={`w-16 h-16 rounded-full overflow-hidden mb-2 ring-2 shadow-md flex items-center justify-center ${
                      isDark ? 'ring-[#f89847] bg-black/40' : 'ring-[#96183c] bg-white'
                    }`}>
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${
                      isDark ? 'text-[#faf0ac]' : 'text-[#96183c]'
                    }`}>
                      Foto de Perfil
                    </span>
                    <span className={`text-[10px] mt-0.5 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Automático
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Celular / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                      placeholder="(11) 98765-4321"
                      maxLength={15}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-xs font-semibold ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        ID do Colaborador (Matrícula / RE)
                      </label>
                      <button
                        type="button"
                        onClick={() => setEmployeeId(generateRandomId())}
                        className="text-[11px] flex items-center gap-1 font-semibold text-[#f89847] hover:underline cursor-pointer"
                        title="Gerar nova matrícula aleatória"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Gerar Novo</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                        placeholder="PNT-7842"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-wide outline-none transition-all border ${
                          isDark
                            ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Caixa de Notificação de Convite e Primeiro Acesso */}
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                }`}>
                  <input
                    type="checkbox"
                    id="sendWelcomeEmail"
                    checked={sendWelcomeEmail}
                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                    className="mt-0.5 rounded cursor-pointer accent-[#f89847] w-4 h-4"
                  />
                  <label htmlFor="sendWelcomeEmail" className="text-xs leading-relaxed cursor-pointer select-none">
                    <span className={`font-semibold block ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                      📧 Enviar e-mail de ativação com link e credencial de primeiro acesso
                    </span>
                    <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-[11px]`}>
                      O código <strong className="font-mono text-[#f89847]">{employeeId || 'PNT-XXXX'}</strong> será enviado ao colaborador como senha temporária de primeiro login para definição de sua senha pessoal.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'ATRIBUIÇÕES' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      roleError ? 'text-rose-500 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Cargo / Função*
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value);
                        if (e.target.value.trim()) setRoleError(false);
                      }}
                      placeholder="Ex: Analista Operacional"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        roleError
                          ? 'border-rose-500 ring-2 ring-rose-500/20'
                          : isDark
                            ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                    {roleError && (
                      <span className="text-[11px] text-rose-500 mt-1 block">Cargo / Função é obrigatório</span>
                    )}
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Departamento / Setor*
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="Atendimento" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Atendimento</option>
                      <option value="Suporte Técnico" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Suporte Técnico</option>
                      <option value="Operações" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Operações</option>
                      <option value="Comercial" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Comercial</option>
                      <option value="Tecnologia" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Tecnologia</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      startDateError ? 'text-rose-500 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Data de Início*
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (e.target.value) setStartDateError(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        startDateError
                          ? 'border-rose-500 ring-2 ring-rose-500/20'
                          : isDark
                            ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                      style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    />
                    {startDateError && (
                      <span className="text-[11px] text-rose-500 mt-1 block">Data de início é obrigatória</span>
                    )}
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Perfil de Acesso*
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="Colaborador" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Colaborador</option>
                      <option value="Gestor" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Gestor</option>
                      <option value="Administrador" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Regime Contratual*
                    </label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="CLT" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>CLT Integral (44h)</option>
                      <option value="PJ" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>PJ / Prestador (160h)</option>
                      <option value="TEMPORARIO" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Temporário</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Info Banner */}
            <div className={`p-4 rounded-2xl flex items-center gap-3.5 text-xs border ${
              isDark
                ? 'bg-[#f89847]/10 border-[#f89847]/25 text-slate-300'
                : 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-2xs'
            }`}>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-[#f89847]/20 text-[#f89847]' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="leading-relaxed">
                <strong className={`block mb-0.5 ${isDark ? 'text-[#faf0ac]' : 'text-amber-950 font-bold'}`}>
                  Integração com Ponto Digital
                </strong>
                <span className={isDark ? 'text-slate-300' : 'text-amber-800/90'}>
                  Após o cadastro, o colaborador terá acesso automático ao Portal do Colaborador para registro de turnos.
                </span>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? 'border-white/10 bg-[#0e1017]' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Cancelar
              </button>

              {activeTab === 'ATRIBUIÇÕES' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('PERFIL');
                    setErrorMessage(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isDark
                      ? 'text-slate-300 hover:text-white hover:bg-white/10'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar: Perfil</span>
                </button>
              )}
            </div>

            {activeTab === 'PERFIL' ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-95 active:scale-95 shadow-md flex items-center gap-2 cursor-pointer text-white"
                style={{
                  background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
                }}
              >
                <span>Avançar para Atribuições</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaved}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer text-white ${
                  isSaved
                    ? 'bg-emerald-600 hover:bg-emerald-600 cursor-default ring-2 ring-emerald-400/40'
                    : 'hover:opacity-95 active:scale-95'
                }`}
                style={!isSaved ? {
                  background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
                } : undefined}
              >
                <Check className="w-4 h-4" />
                <span>{isSaved ? 'Salvo com Sucesso!' : 'Salvar Colaborador'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
