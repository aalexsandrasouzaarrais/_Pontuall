import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/shared/services/supabase';
import { mapBneToEmployee, createGestorSupabase } from '../services/colaboradorService';
import { Employee } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';
import { PasswordResetPage } from './PasswordResetPage';

// Imagens originais idênticas ao login do projeto
import logoPontualTransparente from '../assets/images/logo_pontual_transparente.png';
import logoPontualClaro from '../assets/images/logo_pontual_claro.png';
import pontualBranco from '../assets/images/Pontual-Branco.png';

// CSS com as classes e regras visuais originais
import '../assets/css/login.css';

interface LoginViewProps {
  onLoginSuccess: (user: Employee, role: 'manager' | 'employee') => void;
}

// Usuários locais de fallback caso a rede esteja offline
const DEFAULT_FALLBACK_USERS = [
  {
    id: 'mgr-1',
    nome: 'Camila Duarte',
    email: 'gestor@pontual.com',
    emailSecundario: 'camila.duarte@employer.com.br',
    senha: '123456',
    perfil: 'gestor',
    role: 'manager',
    cargo: 'Gerente Geral de Escalas',
    departamento: 'Gestão de Pessoas & Operações',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'emp-1',
    nome: 'Lucas Silva',
    email: 'colaborador@pontual.com',
    emailSecundario: 'lucas.silva@employer.com.br',
    senha: '123456',
    perfil: 'colaborador',
    role: 'employee',
    cargo: 'Analista de Atendimento',
    departamento: 'Atendimento',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  }
];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  // Modo: 'login', 'register' (cadastro autônomo do gestor) ou 'reset-password'
  const [viewMode, setViewMode] = useState<'login' | 'register' | 'reset-password'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true' || urlParams.get('type') === 'recovery') {
        return 'reset-password';
      }
    } catch {}
    return 'login';
  });

  const [currentRole, setCurrentRole] = useState<'colaborador' | 'gestor'>('colaborador');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Estados do formulário de cadastro de gestor
  const [regNome, setRegNome] = useState('');
  const [regCnpj, setRegCnpj] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCargo, setRegCargo] = useState('Gestor de Operações');
  const [regSenha, setRegSenha] = useState('');
  const [regConfirmarSenha, setRegConfirmarSenha] = useState('');
  const [showRegSenha, setShowRegSenha] = useState(false);
  const [showRegConfirmarSenha, setShowRegConfirmarSenha] = useState(false);
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Feedback flutuante
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const continueBtnRef = useRef<HTMLButtonElement>(null);

  const regNomeInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ message, type });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const clearFeedback = () => {
    if (feedback) {
      setFeedback(null);
    }
  };

  // Formatador de CNPJ: XX.XXX.XXX/XXXX-XX
  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  };

  // Cálculo da Força de Senha
  const checkPasswordStrength = (pass: string) => {
    if (!pass) return { status: '', label: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (pass.length < 6 || score <= 2) {
      return { status: 'weak', label: 'Senha fraca' };
    } else if (score <= 3) {
      return { status: 'medium', label: 'Senha média' };
    } else {
      return { status: 'strong', label: 'Senha forte' };
    }
  };

  const regStrength = checkPasswordStrength(regSenha);

  // Cálculo das Etapas para Login
  const hasEmailText = loginInput.trim().length > 0;
  const isEmailValid = loginInput.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput.trim())
    : loginInput.trim().length >= 3;

  const hasPasswordText = password.length > 0;
  const isPassValid = password.length >= 4;

  const step1ActiveLogin = true;
  const step1CompletedLogin = isSuccess || (hasEmailText && isEmailValid);

  const step2ActiveLogin = isSuccess || hasPasswordText || isPasswordFocused;
  const step2CompletedLogin = isSuccess || (hasPasswordText && isPassValid);

  const step3ActiveLogin = isSuccess || (hasEmailText && hasPasswordText);
  const step3CompletedLogin = isSuccess || (isEmailValid && isPassValid);

  // Cálculo das Etapas para Cadastro de Gestor
  const isRegEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
  const isRegStep1Complete = regSuccess || (regNome.trim().length >= 3 && isRegEmailValid);
  const isRegPassMatch = regSenha.length >= 6 && regSenha === regConfirmarSenha;
  const isRegStep2Complete = regSuccess || isRegPassMatch;
  const isRegStep3Complete = regSuccess;

  // Alterna entre abas de perfil (Colaborador / Gestor) no Login
  const handleRoleChange = (role: 'colaborador' | 'gestor') => {
    setCurrentRole(role);
    clearFeedback();
  };

  // Abrir tela de cadastro do gestor
  const handleOpenRegister = () => {
    setViewMode('register');
    setCurrentRole('gestor');
    clearFeedback();
    setTimeout(() => {
      regNomeInputRef.current?.focus();
    }, 100);
  };

  // Voltar para a tela de login
  const handleBackToLogin = () => {
    setViewMode('login');
    setCurrentRole('gestor');
    clearFeedback();
  };

  // Autenticação oficial com Supabase e Fallback
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearFeedback();

    const cleanInput = loginInput.trim();

    if (!cleanInput) {
      showFeedback('Por favor, digite seu email ou ID de colaborador.', 'error');
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      showFeedback('Por favor, digite sua senha.', 'error');
      passwordInputRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      // 1. Busca na tabela TAB_Colaborador do Supabase
      let query = supabase.from('TAB_Colaborador').select('*').eq('Flg_Ativo', true);

      if (cleanInput.includes('@')) {
        query = query.or(`Eml_Corporativo.ilike.${cleanInput},Eml_Secundario.ilike.${cleanInput}`);
      } else {
        const isNumeric = /^\d+$/.test(cleanInput);
        if (isNumeric) {
          query = query.or(`Cod_Matricula.ilike.${cleanInput},Idf_Colaborador.eq.${parseInt(cleanInput, 10)}`);
        } else {
          query = query.ilike('Cod_Matricula', cleanInput);
        }
      }

      const { data, error } = await query.maybeSingle();

      let matchedUser: any = data;

      // Se não encontrou no Supabase, busca nos gestores registrados localmente no navegador
      if (!matchedUser) {
        const norm = cleanInput.toLowerCase();
        try {
          const localRegistered = JSON.parse(localStorage.getItem('pontual_registered_users') || '[]');
          matchedUser = localRegistered.find(
            (u: any) =>
              u.Eml_Corporativo?.toLowerCase() === norm ||
              (u.Cod_Matricula && u.Cod_Matricula.toLowerCase() === norm)
          );
        } catch {}
      }

      // Se ainda não encontrou, tenta os usuários fixos de fallback
      if (!matchedUser) {
        const norm = cleanInput.toLowerCase();
        const fallback = DEFAULT_FALLBACK_USERS.find(
          (u) =>
            u.email.toLowerCase() === norm ||
            (u.emailSecundario && u.emailSecundario.toLowerCase() === norm)
        );
        if (fallback) {
          matchedUser = {
            Idf_Colaborador: fallback.id,
            Nme_Colaborador: fallback.nome,
            Eml_Corporativo: fallback.email,
            Des_Senha_Hash: fallback.senha,
            Tpo_Perfil: fallback.perfil,
            Tpo_Cargo: fallback.cargo,
            Des_Departamento: fallback.departamento,
            Des_Avatar_Url: fallback.avatar,
            Flg_Ativo: true,
          };
        }
      }

      if (!matchedUser) {
        showFeedback('Usuário não cadastrado. Verifique o email ou ID informado.', 'error');
        setIsLoading(false);
        emailInputRef.current?.focus();
        return;
      }

      // 2. Verifica se a role bate com a aba selecionada
      const userPerfil = (matchedUser.Tpo_Perfil || 'colaborador').toLowerCase();
      if (userPerfil !== currentRole) {
        const perfilCorreto = userPerfil === 'gestor' ? 'Gestor' : 'Colaborador';
        showFeedback(
          `Esta conta pertence ao perfil de ${perfilCorreto}. Por favor, selecione a aba "${perfilCorreto}" acima para entrar.`,
          'warning'
        );
        setIsLoading(false);
        return;
      }

      // 3. Validação da senha (compatível com senha provisória de primeiro acesso = Cod_Matricula)
      const senhaValida =
        matchedUser.Des_Senha_Hash === password ||
        (matchedUser.Cod_Matricula && matchedUser.Cod_Matricula.toLowerCase() === password.toLowerCase());

      if (!senhaValida) {
        showFeedback('Senha incorreta. Lembre-se: no primeiro acesso de colaboradores, sua senha é o seu ID de matrícula.', 'error');
        setIsLoading(false);
        passwordInputRef.current?.focus();
        return;
      }

      // 4. Sucesso!
      setIsSuccess(true);
      showFeedback(`Bem-vindo(a), ${matchedUser.Nme_Colaborador}! Redirecionando...`, 'success');

      const employeeObj = mapBneToEmployee(matchedUser);
      const systemRole: 'manager' | 'employee' = userPerfil === 'gestor' ? 'manager' : 'employee';

      localStorage.setItem('pontual_role', systemRole);
      localStorage.setItem('pontual_active_user', JSON.stringify(matchedUser));

      setTimeout(() => {
        onLoginSuccess(employeeObj, systemRole);
      }, 750);
    } catch (err) {
      console.error('Erro ao autenticar:', err);
      showFeedback('Ocorreu um erro ao processar o login. Tente novamente.', 'error');
      setIsLoading(false);
    }
  };

  // Cadastro de Novo Gestor
  const handleRegisterGestor = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    const cleanNome = regNome.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanCnpj = regCnpj.trim();

    if (!cleanNome || cleanNome.length < 3) {
      showFeedback('Por favor, informe seu nome completo.', 'error');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showFeedback('Por favor, informe um e-mail corporativo válido.', 'error');
      return;
    }

    if (regSenha.length < 6) {
      showFeedback('A senha deve possuir pelo menos 6 caracteres.', 'error');
      return;
    }

    if (regSenha !== regConfirmarSenha) {
      showFeedback('As senhas não coincidem. Digite a mesma senha em ambos os campos.', 'error');
      return;
    }

    setIsRegLoading(true);

    try {
      let createdEmployee: Employee;
      const matricula = `GST-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Tenta salvar na tabela TAB_Colaborador do Supabase
      try {
        createdEmployee = await createGestorSupabase({
          name: cleanNome,
          email: cleanEmail,
          password: regSenha,
          cnpj: cleanCnpj,
          role: regCargo.trim() || 'Gestor Geral',
          department: 'Gestão de Pessoas & Operações'
        });
      } catch (dbErr: any) {
        console.warn('Supabase offline ou retorno com aviso, operando com contingência local:', dbErr?.message);

        // Se for erro de violação de unicidade de email
        if (
          dbErr?.message &&
          (dbErr.message.includes('unique') ||
            dbErr.message.includes('23505') ||
            dbErr.message.includes('already exists'))
        ) {
          showFeedback('Este e-mail corporativo já está cadastrado. Faça login para acessar sua conta.', 'warning');
          setIsRegLoading(false);
          return;
        }

        createdEmployee = {
          id: `mgr-${Date.now()}`,
          name: cleanNome,
          role: regCargo.trim() || 'Gestor Geral',
          department: 'Gestão de Pessoas & Operações',
          avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
          email: cleanEmail,
          phone: '(11) 98765-4321',
          standardHoursPerWeek: 44,
          registrationId: matricula
        };
      }

      // 2. Registra também no localStorage para suporte offline/local garantido
      try {
        const registeredUsers = JSON.parse(localStorage.getItem('pontual_registered_users') || '[]');
        const userRecord = {
          Idf_Colaborador: createdEmployee.id,
          Nme_Colaborador: createdEmployee.name,
          Eml_Corporativo: createdEmployee.email,
          Des_Senha_Hash: regSenha,
          Cod_Matricula: createdEmployee.registrationId || matricula,
          Tpo_Perfil: 'gestor',
          Tpo_Cargo: createdEmployee.role,
          Des_Departamento: createdEmployee.department,
          Des_Avatar_Url: createdEmployee.avatar,
          Idf_Empresa: createdEmployee.companyId || `emp-${cleanCnpj}`,
          Num_CNPJ: createdEmployee.companyCnpj || cleanCnpj,
          Flg_Gestor_Master: createdEmployee.isMasterManager ?? true,
          Flg_Ativo: true,
        };

        const filtered = registeredUsers.filter((u: any) => u.Eml_Corporativo?.toLowerCase() !== cleanEmail);
        filtered.push(userRecord);
        localStorage.setItem('pontual_registered_users', JSON.stringify(filtered));
        localStorage.setItem('pontual_role', 'manager');
        localStorage.setItem('pontual_active_user', JSON.stringify(userRecord));
      } catch (storageErr) {
        console.warn('Erro ao salvar no storage local:', storageErr);
      }

      // 3. Sucesso!
      setRegSuccess(true);
      showFeedback(`Conta de Gestor criada com sucesso! Bem-vindo(a), ${cleanNome}!`, 'success');

      setTimeout(() => {
        onLoginSuccess(createdEmployee, 'manager');
      }, 750);
    } catch (err) {
      console.error('Erro ao cadastrar gestor:', err);
      showFeedback('Ocorreu um erro ao realizar o cadastro. Tente novamente.', 'error');
      setIsRegLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      showFeedback('Conectando ao Google Workspace...', 'warning');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.warn('Erro na autenticação Google:', err.message);
      showFeedback(
        'Para habilitar o Google Workspace, configure o Client ID e Secret do Google no painel do Supabase (Auth > Providers > Google).',
        'warning'
      );
      setIsLoading(false);
    }
  };

  if (viewMode === 'reset-password') {
    return (
      <PasswordResetPage
        onBackToLogin={() => setViewMode('login')}
        onSuccess={(colaboradorData) => {
          if (colaboradorData) {
            const emp = mapBneToEmployee(colaboradorData);
            onLoginSuccess(emp, 'employee');
          } else {
            setViewMode('login');
          }
        }}
      />
    );
  }

  return (
    <main className={`pontual-login-page page ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <section className="signup-container">
        {/* =================================================
             LADO ESQUERDO
        ================================================== */}
        <div className="left-panel">
          {/* Logo */}
          <div className="logo2">
            <img src={logoPontualTransparente} alt="Pontual Logo" width="160px" />
            <img src={pontualBranco} alt="" />
          </div>

          {/* Conteúdo */}
          <div className="hero-content">
            <div className="badge">Junte-se a nós</div>

            <h1 id="heroTitle">
              {viewMode === 'register' ? (
                <>
                  Comece sua
                  <br />
                  <span>jornada</span>
                </>
              ) : currentRole === 'gestor' ? (
                <>
                  Painel do
                  <br />
                  <span>gestor</span>
                </>
              ) : (
                <>
                  Acesse sua
                  <br />
                  <span>jornada</span>
                </>
              )}
            </h1>

            <p className="hero-description" id="heroDesc">
              {viewMode === 'register'
                ? 'Siga estes passos simples para configurar sua conta de gestor.'
                : currentRole === 'gestor'
                ? 'Informe seus dados para acessar o painel de gestão.'
                : 'Siga estes passos simples para acessar sua conta.'}
            </p>

            {/* ETAPAS */}
            <div className="steps">
              {/* Etapa 1 */}
              <div
                className={`step ${
                  viewMode === 'register'
                    ? 'active ' + (isRegStep1Complete ? 'completed' : '')
                    : (step1ActiveLogin ? 'active ' : '') + (step1CompletedLogin ? 'completed' : '')
                }`}
                id="step1"
                onClick={() => {
                  if (viewMode === 'register') {
                    regNomeInputRef.current?.focus();
                  } else {
                    emailInputRef.current?.focus();
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum1">
                  {viewMode === 'register'
                    ? (isRegStep1Complete ? '✓' : '1')
                    : (step1CompletedLogin ? '✓' : '1')}
                </div>
                <div className="step-text" id="stepText1">
                  {viewMode === 'register' ? (
                    <>
                      Informe seus
                      <br />
                      dados
                    </>
                  ) : (
                    <>
                      Informe seu
                      <br />
                      email ou ID
                    </>
                  )}
                </div>
              </div>

              {/* Etapa 2 */}
              <div
                className={`step ${
                  viewMode === 'register'
                    ? ((regSenha.length > 0 || isRegStep1Complete) ? 'active ' : '') + (isRegStep2Complete ? 'completed' : '')
                    : (step2ActiveLogin ? 'active ' : '') + (step2CompletedLogin ? 'completed' : '')
                }`}
                id="step2"
                onClick={() => {
                  if (viewMode === 'register') {
                    document.getElementById('regSenha')?.focus();
                  } else {
                    passwordInputRef.current?.focus();
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum2">
                  {viewMode === 'register'
                    ? (isRegStep2Complete ? '✓' : '2')
                    : (step2CompletedLogin ? '✓' : '2')}
                </div>
                <div className="step-text" id="stepText2">
                  {viewMode === 'register' ? (
                    <>
                      Configure sua
                      <br />
                      senha
                    </>
                  ) : (
                    <>
                      Digite sua
                      <br />
                      senha
                    </>
                  )}
                </div>
              </div>

              {/* Etapa 3 */}
              <div
                className={`step ${
                  viewMode === 'register'
                    ? ((isRegStep1Complete && isRegStep2Complete) ? 'active ' : '') + (isRegStep3Complete ? 'completed' : '')
                    : (step3ActiveLogin ? 'active ' : '') + (step3CompletedLogin ? 'completed' : '')
                }`}
                id="step3"
                onClick={() => {
                  if (viewMode === 'register') {
                    document.getElementById('btnSubmitRegister')?.focus();
                  } else {
                    continueBtnRef.current?.focus();
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum3">
                  {viewMode === 'register'
                    ? (isRegStep3Complete ? '✓' : '3')
                    : (step3CompletedLogin ? '★' : '3')}
                </div>
                <div className="step-text" id="stepText3">
                  {viewMode === 'register' ? (
                    <>
                      Confirme seu
                      <br />
                      cadastro
                    </>
                  ) : currentRole === 'gestor' ? (
                    <>
                      Acesse o painel
                      <br />
                      Pontual
                    </>
                  ) : (
                    <>
                      Aproveite sua experiência
                      <br />
                      Pontual
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
             LADO DIREITO
        ================================================== */}
        <div className="right-panel">
          {/* SELETOR DE TEMA */}
          <div className="theme-switcher" id="themeSwitcher" aria-label="Escolha o tema">
            <button
              type="button"
              className={`theme-option theme-option--dark ${theme === 'dark' ? 'is-active' : ''}`}
              onClick={() => setTheme('dark')}
              aria-label="Tema escuro"
              aria-pressed={theme === 'dark'}
              title="Tema escuro"
            >
              <svg
                className="theme-option__icon"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>

            <button
              type="button"
              className={`theme-option theme-option--light ${theme === 'light' ? 'is-active' : ''}`}
              onClick={() => setTheme('light')}
              aria-label="Tema claro"
              aria-pressed={theme === 'light'}
              title="Tema claro"
            >
              <svg
                className="theme-option__icon"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
              </svg>
            </button>
          </div>

          <div className="form-container">
            {/* Logo */}
            <img
              className={`icon-login ${isDark ? 'icon-login--dark' : 'icon-login--light'}`}
              src={isDark ? logoPontualTransparente : logoPontualClaro}
              alt="Pontual Logo"
            />

            {/* MENSAGEM DE FEEDBACK FLUTUANTE */}
            {feedback && (
              <div
                id="loginFeedback"
                className="login-feedback"
                style={{
                  display: 'block',
                  position: 'fixed',
                  top: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 9999,
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                  transition: 'all .25s ease',
                  background:
                    feedback.type === 'error'
                      ? 'rgba(220, 38, 38, 0.95)'
                      : feedback.type === 'warning'
                      ? 'rgba(217, 119, 6, 0.95)'
                      : 'rgba(16, 185, 129, 0.95)',
                  border:
                    feedback.type === 'error'
                      ? '1px solid rgba(239, 68, 68, 0.8)'
                      : feedback.type === 'warning'
                      ? '1px solid rgba(245, 158, 11, 0.8)'
                      : '1px solid rgba(16, 185, 129, 0.8)',
                  color: '#ffffff',
                }}
              >
                {feedback.message}
              </div>
            )}

            {/* =================================================
                 FORMULÁRIO DE LOGIN
            ================================================== */}
            {viewMode === 'login' ? (
              <>
                {/* SELETOR DE PERFIL (COLABORADOR / GESTOR) */}
                <div className="role-selector" role="tablist" aria-label="Selecione o perfil de acesso">
                  <button
                    type="button"
                    className={`role-btn ${currentRole === 'colaborador' ? 'active' : ''}`}
                    id="btnRoleColaborador"
                    role="tab"
                    aria-selected={currentRole === 'colaborador'}
                    onClick={() => handleRoleChange('colaborador')}
                  >
                    <svg
                      className="role-icon"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>Colaborador</span>
                  </button>

                  <button
                    type="button"
                    className={`role-btn ${currentRole === 'gestor' ? 'active' : ''}`}
                    id="btnRoleGestor"
                    role="tab"
                    aria-selected={currentRole === 'gestor'}
                    onClick={() => handleRoleChange('gestor')}
                  >
                    <svg
                      className="role-icon"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>Gestor</span>
                  </button>
                </div>

                <h2 id="formTitle">
                  {currentRole === 'gestor' ? 'Entrar como Gestor' : 'Entrar como Colaborador'}
                </h2>
                <p className="form-subtitle" id="formSubtitle">
                  {currentRole === 'gestor'
                    ? 'Acesse o painel de controle e acompanhamento de ponto.'
                    : 'Acesse com seu email corporativo (ou ID) e senha.'}
                </p>

                <form onSubmit={handleLogin}>
                  {/* EMAIL OU ID */}
                  <div className="input-group">
                    <label htmlFor="email">Email ou ID do Colaborador</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="email"
                        ref={emailInputRef}
                        placeholder="Digite seu email ou ID (ex: PNT-8478)"
                        value={loginInput}
                        onChange={(e) => {
                          setLoginInput(e.target.value);
                          clearFeedback();
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* SENHA */}
                  <div className="input-group">
                    <label htmlFor="password">Senha</label>
                    <div className="password-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        ref={passwordInputRef}
                        placeholder="••••••••••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearFeedback();
                        }}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        required
                      />
                      <button
                        type="button"
                        className="eye"
                        id="togglePassword"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Mostrar ou ocultar senha"
                      >
                        {showPassword ? (
                          <svg
                            id="eyeIcon"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8 a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8 a18.5 18.5 0 0 1-2.16 3.19 m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg
                            id="eyeIcon"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('reset-password')}
                        className="text-xs text-[#f89847] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Esqueceu ou deseja redefinir sua senha?
                      </button>
                    </div>
                  </div>

                  {/* BOTÃO ENTRAR */}
                  <button
                    type="submit"
                    className="continue-button"
                    id="continueButton"
                    ref={continueBtnRef}
                    disabled={isLoading}
                    style={
                      isSuccess
                        ? {
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                          }
                        : undefined
                    }
                  >
                    <span id="continueButtonText">
                      {isLoading
                        ? 'Autenticando...'
                        : isSuccess
                        ? '✓ Acesso autorizado!'
                        : 'Entrar'}
                    </span>
                  </button>
                </form>

                {/* CRIAR CONTA (GESTOR AGORA PODE SE CADASTRAR) */}
                {currentRole === 'gestor' && (
                  <p className="login-text" id="signupPrompt">
                    <span id="signupPromptText">Ainda não possui uma conta? </span>
                    <a
                      href="#cadastrar-gestor"
                      id="toggleSignMode"
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenRegister();
                      }}
                      style={{ fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Criar conta de Gestor
                    </a>
                  </p>
                )}

                {/* DIVISOR OU */}
                <div className="divider">
                  <span></span>
                  <p>Ou</p>
                  <span></span>
                </div>

                {/* BOTÃO GOOGLE */}
                <button
                  type="button"
                  className="google-button"
                  id="googleButton"
                  onClick={handleGoogleLogin}
                >
                  <span className="google-icon">G</span>
                  <span id="googleButtonText">Entrar com Google</span>
                </button>
              </>
            ) : (
              /* =================================================
                 FORMULÁRIO DE CADASTRO DO GESTOR
              ================================================== */
              <div className="signup-flow-container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: 'rgba(248, 150, 66, 0.15)',
                      color: '#f89642',
                      border: '1px solid rgba(248, 150, 66, 0.3)',
                    }}
                  >
                    Novo Gestor
                  </span>
                </div>

                <h2>Crie sua conta</h2>
                <p className="form-subtitle">Preencha seus dados para gerenciar sua equipe na Pontual.</p>

                <form onSubmit={handleRegisterGestor} noValidate>
                  {/* GRID NOME E CNPJ */}
                  <div className="signup-grid-2">
                    <div className="input-group">
                      <label htmlFor="regNome">Nome completo*</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="regNome"
                          ref={regNomeInputRef}
                          placeholder="Ex: Carlos Silva"
                          value={regNome}
                          onChange={(e) => {
                            setRegNome(e.target.value);
                            clearFeedback();
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label htmlFor="regCnpj">CNPJ da Empresa</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="regCnpj"
                          placeholder="00.000.000/0001-00"
                          value={regCnpj}
                          maxLength={18}
                          onChange={(e) => {
                            setRegCnpj(formatCnpj(e.target.value));
                            clearFeedback();
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* GRID EMAIL E CARGO */}
                  <div className="signup-grid-2">
                    <div className="input-group">
                      <label htmlFor="regEmail">Email corporativo*</label>
                      <div className="input-wrapper">
                        <input
                          type="email"
                          id="regEmail"
                          placeholder="gestor@empresa.com.br"
                          value={regEmail}
                          onChange={(e) => {
                            setRegEmail(e.target.value);
                            clearFeedback();
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div className="input-group">
                      <label htmlFor="regCargo">Cargo / Função</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          id="regCargo"
                          placeholder="Ex: Gerente Geral de Escalas"
                          value={regCargo}
                          onChange={(e) => {
                            setRegCargo(e.target.value);
                            clearFeedback();
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SENHA */}
                  <div className="input-group">
                    <label htmlFor="regSenha">Senha* (mínimo 6 caracteres)</label>
                    <div className="password-wrapper">
                      <input
                        type={showRegSenha ? 'text' : 'password'}
                        id="regSenha"
                        placeholder="Crie uma senha segura"
                        value={regSenha}
                        onChange={(e) => {
                          setRegSenha(e.target.value);
                          clearFeedback();
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="eye"
                        onClick={() => setShowRegSenha(!showRegSenha)}
                        aria-label="Mostrar ou ocultar senha"
                      >
                        {showRegSenha ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8 a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8 a18.5 18.5 0 0 1-2.16 3.19 m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Barra de força da senha */}
                    {regSenha && (
                      <div className="password-strength" id="passwordStrength">
                        <div className="strength-track">
                          <div className={`strength-bar ${regStrength.status}`}></div>
                        </div>
                        <div className="strength-info">
                          <span className={`strength-label ${regStrength.status}`}>
                            {regStrength.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CONFIRMAR SENHA */}
                  <div className="input-group">
                    <label htmlFor="regConfirmarSenha">Confirmar senha*</label>
                    <div className="password-wrapper">
                      <input
                        type={showRegConfirmarSenha ? 'text' : 'password'}
                        id="regConfirmarSenha"
                        placeholder="Repita sua senha"
                        value={regConfirmarSenha}
                        onChange={(e) => {
                          setRegConfirmarSenha(e.target.value);
                          clearFeedback();
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="eye"
                        onClick={() => setShowRegConfirmarSenha(!showRegConfirmarSenha)}
                        aria-label="Mostrar ou ocultar senha"
                      >
                        {showRegConfirmarSenha ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8 a18.45 18.45 0 0 1 5.06-5.94 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8 a18.5 18.5 0 0 1-2.16 3.19 m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* BOTÃO CADASTRAR GESTOR */}
                  <button
                    type="submit"
                    className="continue-button"
                    id="btnSubmitRegister"
                    disabled={isRegLoading}
                    style={
                      regSuccess
                        ? {
                            background: 'linear-gradient(90deg, #10b981, #059669)',
                          }
                        : undefined
                    }
                  >
                    <span>
                      {isRegLoading
                        ? 'Criando sua conta...'
                        : regSuccess
                        ? '✓ Conta criada com sucesso!'
                        : 'Criar conta de Gestor'}
                    </span>
                  </button>
                </form>

                {/* VOLTAR AO LOGIN */}
                <p className="login-text" style={{ marginTop: '16px' }}>
                  <span>Já possui uma conta? </span>
                  <a
                    href="#voltar-login"
                    onClick={(e) => {
                      e.preventDefault();
                      handleBackToLogin();
                    }}
                    style={{ fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Entrar
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
