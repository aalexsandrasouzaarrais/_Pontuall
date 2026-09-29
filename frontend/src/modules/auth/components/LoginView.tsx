import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/shared/services/supabase';
import { mapBneToEmployee } from '../services/colaboradorService';
import { Employee } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';

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

  const [currentRole, setCurrentRole] = useState<'colaborador' | 'gestor'>('colaborador');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Feedback flutuante
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const continueBtnRef = useRef<HTMLButtonElement>(null);


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

  // Cálculo das Etapas (1, 2, 3) idêntico ao script.js original
  const hasEmailText = loginInput.trim().length > 0;
  const isEmailValid = loginInput.includes('@')
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginInput.trim())
    : loginInput.trim().length >= 3;

  const hasPasswordText = password.length > 0;
  const isPassValid = password.length >= 4;

  const step1Active = true;
  const step1Completed = isSuccess || (hasEmailText && isEmailValid);

  const step2Active = isSuccess || hasPasswordText || isPasswordFocused;
  const step2Completed = isSuccess || (hasPasswordText && isPassValid);

  const step3Active = isSuccess || (hasEmailText && hasPasswordText);
  const step3Completed = isSuccess || (isEmailValid && isPassValid);

  // Alterna entre abas de perfil (Colaborador / Gestor)
  const handleRoleChange = (role: 'colaborador' | 'gestor') => {
    setCurrentRole(role);
    clearFeedback();
  };

  // Autenticação oficial com Supabase
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

      // Se não encontrou no Supabase, tenta o fallback local
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
        showFeedback('Senha incorreta. Lembre-se: no primeiro acesso, sua senha é o seu ID de matrícula.', 'error');
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

  const handleGoogleLogin = () => {
    showFeedback('Autenticação com Google Workspace em integração.', 'warning');
  };

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
              {currentRole === 'gestor' ? (
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
              {currentRole === 'gestor'
                ? 'Informe seus dados para acessar o painel de gestão.'
                : 'Siga estes passos simples para acessar sua conta.'}
            </p>

            {/* ETAPAS */}
            <div className="steps">
              {/* Etapa 1 */}
              <div
                className={`step ${step1Active ? 'active' : ''} ${step1Completed ? 'completed' : ''}`}
                id="step1"
                onClick={() => emailInputRef.current?.focus()}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum1">
                  {step1Completed ? '✓' : '1'}
                </div>
                <div className="step-text" id="stepText1">
                  Informe seu
                  <br />
                  email ou ID
                </div>
              </div>

              {/* Etapa 2 */}
              <div
                className={`step ${step2Active ? 'active' : ''} ${step2Completed ? 'completed' : ''}`}
                id="step2"
                onClick={() => passwordInputRef.current?.focus()}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum2">
                  {step2Completed ? '✓' : '2'}
                </div>
                <div className="step-text" id="stepText2">
                  Digite sua
                  <br />
                  senha
                </div>
              </div>

              {/* Etapa 3 */}
              <div
                className={`step ${step3Active ? 'active' : ''} ${step3Completed ? 'completed' : ''}`}
                id="step3"
                onClick={() => continueBtnRef.current?.focus()}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number" id="stepNum3">
                  {step3Completed ? '★' : '3'}
                </div>
                <div className="step-text" id="stepText3">
                  {currentRole === 'gestor' ? (
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
              className="icon-login icon-login--dark"
              src={logoPontualTransparente}
              alt="Pontual Logo"
            />
            <img
              className="icon-login icon-login--light"
              src={logoPontualClaro}
              alt="Pontual Logo"
            />

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
              </div>

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

            {/* CRIAR CONTA (APENAS GESTOR) */}
            {currentRole === 'gestor' && (
              <p className="login-text" id="signupPrompt">
                <span id="signupPromptText">Ainda não possui uma conta? </span>
                <a
                  href="#"
                  id="toggleSignMode"
                  onClick={(e) => {
                    e.preventDefault();
                    showFeedback('O cadastramento de novos gestores é realizado pelo RH/Administração.', 'warning');
                  }}
                >
                  Criar conta
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
          </div>
        </div>
      </section>
    </main>
  );
};
