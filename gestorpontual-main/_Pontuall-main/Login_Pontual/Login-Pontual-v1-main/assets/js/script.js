/* =========================================================
   PONTUAL - SISTEMA DE AUTENTICAÇÃO E INTERATIVIDADE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       0. TOGGLE DE TEMA (CLARO / ESCURO)
    ========================================================= */

    const themeToggle = document.getElementById("themeToggle");
    const savedTheme = localStorage.getItem("pontual-theme");

    if (savedTheme === "light") {
        document.body.classList.add("theme-light");
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            document.body.classList.toggle("theme-light");

            const isLight = document.body.classList.contains("theme-light");

            localStorage.setItem(
                "pontual-theme",
                isLight ? "light" : "dark"
            );
        });
    }


    /* =========================================================
       1. ESTADO DA APLICAÇÃO
    ========================================================= */

    let currentRole = "colaborador";


    /* =========================================================
       2. ELEMENTOS DO DOM
    ========================================================= */

    // Formulário e Campos
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const eyeIcon = document.getElementById("eyeIcon");
    const continueBtn = document.getElementById("continueButton");
    const continueBtnText = document.getElementById("continueButtonText");

    // Seletores de Perfil
    const btnRoleColaborador = document.getElementById("btnRoleColaborador");
    const btnRoleGestor = document.getElementById("btnRoleGestor");
    const formTitle = document.getElementById("formTitle");
    const formSubtitle = document.getElementById("formSubtitle");

    // Opção de Criar Conta
    const signupPrompt = document.getElementById("signupPrompt");
    const signupPromptText = document.getElementById("signupPromptText");
    const toggleSignMode = document.getElementById("toggleSignMode");
    const googleButtonText = document.getElementById("googleButtonText");

    // Painel Esquerdo
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");

    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");

    const stepNum1 = document.getElementById("stepNum1");
    const stepNum2 = document.getElementById("stepNum2");
    const stepNum3 = document.getElementById("stepNum3");

    const stepText1 = document.getElementById("stepText1");
    const stepText2 = document.getElementById("stepText2");
    const stepText3 = document.getElementById("stepText3");


    /* =========================================================
       3. MOSTRAR / OCULTAR SENHA
    ========================================================= */

    if (togglePasswordBtn && passwordInput) {

        togglePasswordBtn.addEventListener("click", () => {

            const isPassword = passwordInput.type === "password";

            passwordInput.type = isPassword ? "text" : "password";

            if (eyeIcon) {

                eyeIcon.innerHTML = isPassword

                    ? `
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
                        a18.45 18.45 0 0 1 5.06-5.94
                        M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
                        a18.5 18.5 0 0 1-2.16 3.19
                        m-6.72-1.07a3 3 0 1 1-4.24-4.24">
                        </path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    `

                    : `
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z">
                        </path>
                        <circle cx="12" cy="12" r="3"></circle>
                    `;
            }
        });
    }


    /* =========================================================
       4. ATUALIZAÇÃO DO PERFIL
       COLABORADOR / GESTOR
    ========================================================= */

    function updateRoleUI() {

        if (currentRole === "colaborador") {

            /* -------------------------
               COLABORADOR
            ------------------------- */

            if (btnRoleColaborador) {
                btnRoleColaborador.classList.add("active");
                btnRoleColaborador.setAttribute("aria-selected", "true");
            }

            if (btnRoleGestor) {
                btnRoleGestor.classList.remove("active");
                btnRoleGestor.setAttribute("aria-selected", "false");
            }

            document.title = "Pontual - Portal do Colaborador";

            if (formTitle) {
                formTitle.textContent = "Entrar como Colaborador";
            }

            if (formSubtitle) {
                formSubtitle.textContent =
                    "Acesse com seu email corporativo e senha.";
            }

            if (continueBtnText) {
                continueBtnText.textContent = "Entrar";
            }

            if (googleButtonText) {
                googleButtonText.textContent = "Entrar com Google";
            }

            // Esconde o Criar Conta para colaborador
            if (signupPrompt) {
                signupPrompt.style.display = "none";
            }

            // Textos do painel esquerdo
            if (heroTitle) {
                heroTitle.innerHTML =
                    'Acesse sua<br><span>jornada</span>';
            }

            if (heroDesc) {
                heroDesc.textContent =
                    "Informe seus dados para acessar sua conta de colaborador.";
            }

            if (stepText1) {
                stepText1.innerHTML = "Informe seu<br>email";
            }

            if (stepText2) {
                stepText2.innerHTML = "Digite sua<br>senha";
            }

            if (stepText3) {
                stepText3.innerHTML =
                    "Acesse a plataforma<br>Pontual";
            }

        } else {

            /* -------------------------
               GESTOR
            ------------------------- */

            if (btnRoleGestor) {
                btnRoleGestor.classList.add("active");
                btnRoleGestor.setAttribute("aria-selected", "true");
            }

            if (btnRoleColaborador) {
                btnRoleColaborador.classList.remove("active");
                btnRoleColaborador.setAttribute("aria-selected", "false");
            }

            document.title = "Pontual - Portal do Gestor";

            if (formTitle) {
                formTitle.textContent = "Entrar como Gestor";
            }

            if (formSubtitle) {
                formSubtitle.textContent =
                    "Acesse o painel de controle e acompanhamento de ponto.";
            }

            if (continueBtnText) {
                continueBtnText.textContent = "Entrar";
            }

            if (googleButtonText) {
                googleButtonText.textContent = "Entrar com Google";
            }

            /* -------------------------
               MOSTRA CRIAR CONTA
            ------------------------- */

            if (signupPrompt) {
                signupPrompt.style.display = "block";
            }

            if (signupPromptText) {
                signupPromptText.textContent =
                    "Ainda não possui uma conta?";
            }

            if (toggleSignMode) {
                toggleSignMode.textContent = "Criar conta";
            }

            // Textos do painel esquerdo
            if (heroTitle) {
                heroTitle.innerHTML =
                    'Painel do<br><span>gestor</span>';
            }

            if (heroDesc) {
                heroDesc.textContent =
                    "Informe seus dados para acessar o painel de gestão.";
            }

            if (stepText1) {
                stepText1.innerHTML = "Informe seu<br>email";
            }

            if (stepText2) {
                stepText2.innerHTML = "Digite sua<br>senha";
            }

            if (stepText3) {
                stepText3.innerHTML =
                    "Acesse o painel<br>Pontual";
            }
        }

        updateStepCards();
    }


    /* =========================================================
       5. BOTÕES DE PERFIL
    ========================================================= */

    if (btnRoleColaborador) {

        btnRoleColaborador.addEventListener("click", () => {

            currentRole = "colaborador";

            updateRoleUI();
        });
    }


    if (btnRoleGestor) {

        btnRoleGestor.addEventListener("click", () => {

            currentRole = "gestor";

            updateRoleUI();
        });
    }


    /* =========================================================
       6. BOTÃO CRIAR CONTA
       
       AGORA ELE ABRE UMA NOVA PÁGINA:
       cadastro.html
    ========================================================= */

    if (toggleSignMode) {

        toggleSignMode.addEventListener("click", (e) => {

            e.preventDefault();

            if (currentRole === "gestor") {

                window.location.href = "conta2.html";

            }
        });
    }


    /* =========================================================
       7. VALIDAÇÃO DE EMAIL
    ========================================================= */

    function isValidEmail(value) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            value.trim()
        );
    }


    /* =========================================================
       8. COLORAÇÃO DOS CARDS
    ========================================================= */

    function updateStepCards() {

        const emailVal = emailInput
            ? emailInput.value.trim()
            : "";

        const passVal = passwordInput
            ? passwordInput.value
            : "";

        const hasEmailText = emailVal.length > 0;

        const isEmailValid = isValidEmail(emailVal);

        const hasPasswordText = passVal.length > 0;

        const isPassValid = passVal.length >= 4;


        /* -------------------------
           CARD 1 - EMAIL
        ------------------------- */

        if (hasEmailText) {

            step1.classList.add("active");

            if (isEmailValid) {

                step1.classList.add("completed");

                if (stepNum1) {
                    stepNum1.innerHTML = "✓";
                }

            } else {

                step1.classList.remove("completed");

                if (stepNum1) {
                    stepNum1.innerHTML = "1";
                }
            }

        } else {

            step1.classList.add("active");

            step1.classList.remove("completed");

            if (stepNum1) {
                stepNum1.innerHTML = "1";
            }
        }


        /* -------------------------
           CARD 2 - SENHA
        ------------------------- */

        if (hasPasswordText) {

            step2.classList.add("active");

            if (isPassValid) {

                step2.classList.add("completed");

                if (stepNum2) {
                    stepNum2.innerHTML = "✓";
                }

            } else {

                step2.classList.remove("completed");

                if (stepNum2) {
                    stepNum2.innerHTML = "2";
                }
            }

        } else {

            if (document.activeElement !== passwordInput) {

                step2.classList.remove("active");

                step2.classList.remove("completed");

                if (stepNum2) {
                    stepNum2.innerHTML = "2";
                }
            }
        }


        /* -------------------------
           CARD 3 - CONCLUSÃO
        ------------------------- */

        if (hasEmailText && hasPasswordText) {

            step3.classList.add("active");

            if (isEmailValid && isPassValid) {

                step3.classList.add("completed");

                if (stepNum3) {
                    stepNum3.innerHTML = "★";
                }

            } else {

                step3.classList.remove("completed");

                if (stepNum3) {
                    stepNum3.innerHTML = "3";
                }
            }

        } else {

            step3.classList.remove("active");

            step3.classList.remove("completed");

            if (stepNum3) {
                stepNum3.innerHTML = "3";
            }
        }
    }


    /* =========================================================
       9. EVENTOS DOS CAMPOS
    ========================================================= */

    if (emailInput) {

        emailInput.addEventListener(
            "input",
            updateStepCards
        );

        emailInput.addEventListener("focus", () => {

            if (step1) {
                step1.classList.add("active");
            }
        });

        emailInput.addEventListener(
            "blur",
            updateStepCards
        );
    }


    if (passwordInput) {

        passwordInput.addEventListener(
            "input",
            updateStepCards
        );

        passwordInput.addEventListener("focus", () => {

            if (step2) {
                step2.classList.add("active");
            }
        });

        passwordInput.addEventListener(
            "blur",
            updateStepCards
        );
    }


    /* =========================================================
       10. CLIQUE NOS CARDS
    ========================================================= */

    if (step1) {

        step1.addEventListener("click", () => {

            if (emailInput) {
                emailInput.focus();
            }
        });
    }


    if (step2) {

        step2.addEventListener("click", () => {

            if (passwordInput) {
                passwordInput.focus();
            }
        });
    }


    if (step3) {

        step3.addEventListener("click", () => {

            if (continueBtn) {
                continueBtn.focus();
            }
        });
    }


    /* =========================================================
       BASE DE USUÁRIOS (Sincronizada com usuarios.json)
    ========================================================= */

    const DEFAULT_USERS = [
        {
            id: "mgr-1",
            nome: "Camila Duarte",
            email: "gestor@pontual.com",
            emailSecundario: "camila.duarte@employer.com.br",
            senha: "123456",
            perfil: "gestor",
            role: "manager",
            cargo: "Gerente Geral de Escalas",
            departamento: "Gestão de Pessoas & Operações",
            avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-1",
            nome: "Lucas Silva",
            email: "colaborador@pontual.com",
            emailSecundario: "lucas.silva@employer.com.br",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Analista de Atendimento",
            departamento: "Atendimento",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-2",
            nome: "Beatriz Santos",
            email: "beatriz.santos@employer.com.br",
            emailSecundario: "beatriz@pontual.com",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Especialista de Suporte",
            departamento: "Suporte Técnico",
            avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-3",
            nome: "Rafael Mendes",
            email: "rafael.mendes@employer.com.br",
            emailSecundario: "rafael@pontual.com",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Operador de Escala",
            departamento: "Operações",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-4",
            nome: "Mariana Costa",
            email: "mariana.costa@employer.com.br",
            emailSecundario: "mariana@pontual.com",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Consultora de Vendas",
            departamento: "Comercial",
            avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-5",
            nome: "Thiago Oliveira",
            email: "thiago.oliveira@employer.com.br",
            emailSecundario: "thiago@pontual.com",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Desenvolvedor Frontend",
            departamento: "Tecnologia",
            avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
        },
        {
            id: "emp-6",
            nome: "Juliana Lima",
            email: "juliana.lima@employer.com.br",
            emailSecundario: "juliana@pontual.com",
            senha: "123456",
            perfil: "colaborador",
            role: "employee",
            cargo: "Supervisora de Operações",
            departamento: "Operações",
            avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"
        }
    ];

    let usersList = [...DEFAULT_USERS];

    // Carrega dinamicamente de usuarios.json caso esteja em ambiente HTTP
    try {
        fetch('./usuarios.json')
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.usuarios)) {
                    usersList = data.usuarios;
                }
            })
            .catch(() => {});
    } catch (e) {}

    /* =========================================================
       FEEDBACK VISUAL (MENSAGENS DE ERRO / AVISO / SUCESSO)
    ========================================================= */

    const feedbackBox = document.getElementById("loginFeedback");
    let feedbackTimeout = null;

    function showFeedback(message, type = "error") {
        if (!feedbackBox) {
            alert(message);
            return;
        }

        feedbackBox.textContent = message;
        feedbackBox.style.display = "block";

        if (type === "error") {
            feedbackBox.style.background = "rgba(220, 38, 38, 0.95)";
            feedbackBox.style.border = "1px solid rgba(239, 68, 68, 0.8)";
            feedbackBox.style.color = "#ffffff";
        } else if (type === "warning") {
            feedbackBox.style.background = "rgba(217, 119, 6, 0.95)";
            feedbackBox.style.border = "1px solid rgba(245, 158, 11, 0.8)";
            feedbackBox.style.color = "#ffffff";
        } else {
            feedbackBox.style.background = "rgba(16, 185, 129, 0.95)";
            feedbackBox.style.border = "1px solid rgba(16, 185, 129, 0.8)";
            feedbackBox.style.color = "#ffffff";
        }

        clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(clearFeedback, 3500);
    }

    function clearFeedback() {
        if (feedbackBox) {
            feedbackBox.style.display = "none";
            feedbackBox.textContent = "";
        }
    }

    if (emailInput) {
        emailInput.addEventListener("input", clearFeedback);
    }
    if (passwordInput) {
        passwordInput.addEventListener("input", clearFeedback);
    }

    /* =========================================================
       11. BOTÃO ENTRAR (AUTENTICAÇÃO COM JSON)
    ========================================================= */

    if (continueBtn) {

        continueBtn.addEventListener("click", () => {

            clearFeedback();

            const email = emailInput
                ? emailInput.value.trim()
                : "";

            const pass = passwordInput
                ? passwordInput.value
                : "";


            /* -------------------------
               VALIDAÇÃO DE CAMPOS
            ------------------------- */

            if (!email) {
                showFeedback("Por favor, digite seu email.", "error");
                if (emailInput) emailInput.focus();
                return;
            }

            if (!isValidEmail(email)) {
                showFeedback("Por favor, informe um email válido.", "error");
                if (emailInput) emailInput.focus();
                return;
            }

            if (!pass) {
                showFeedback("Por favor, digite sua senha.", "error");
                if (passwordInput) passwordInput.focus();
                return;
            }

            /* -------------------------
               BUSCA DO USUÁRIO
            ------------------------- */

            const normEmail = email.toLowerCase();
            const foundUser = usersList.find(u => 
                u.email.toLowerCase() === normEmail || 
                (u.emailSecundario && u.emailSecundario.toLowerCase() === normEmail)
            );

            if (!foundUser) {
                showFeedback("Usuário não cadastrado. Verifique o email informado.", "error");
                if (emailInput) {
                    emailInput.focus();
                    emailInput.select();
                }
                return;
            }

            // Verifica se a role bate com a aba selecionada
            if (foundUser.perfil !== currentRole) {
                const perfilCorreto = foundUser.perfil === "gestor" ? "Gestor" : "Colaborador";
                showFeedback(`Esta conta pertence ao perfil de ${perfilCorreto}. Por favor, selecione a aba "${perfilCorreto}" acima para entrar.`, "warning");
                return;
            }

            // Validação da senha
            if (foundUser.senha !== pass) {
                showFeedback("Senha incorreta. Verifique os dados digitados.", "error");
                if (passwordInput) {
                    passwordInput.focus();
                    passwordInput.select();
                }
                return;
            }


            /* -------------------------
               AUTORIZADO COM SUCESSO!
            ------------------------- */

            showFeedback(`Bem-vindo(a), ${foundUser.nome}! Redirecionando...`, "success");

            continueBtn.disabled = true;

            if (continueBtnText) {
                continueBtnText.textContent = "✓ Acesso autorizado!";
            }

            continueBtn.style.background =
                "linear-gradient(90deg, #10b981, #059669)";


            /* -------------------------
               PINTA OS 3 CARDS
            ------------------------- */

            if (step1) step1.classList.add("active", "completed");
            if (step2) step2.classList.add("active", "completed");
            if (step3) step3.classList.add("active", "completed");

            if (stepNum1) stepNum1.innerHTML = "✓";
            if (stepNum2) stepNum2.innerHTML = "✓";
            if (stepNum3) stepNum3.innerHTML = "★";


            /* -------------------------
               PERSISTÊNCIA DA SESSÃO
            ------------------------- */

            const systemRole = (foundUser.perfil === "gestor" || foundUser.role === "manager") ? "manager" : "employee";
            localStorage.setItem("pontual_role", systemRole);
            localStorage.setItem("pontual_active_user", JSON.stringify(foundUser));


            /* -------------------------
               REDIRECIONAMENTO
            ------------------------- */

            setTimeout(() => {
                window.location.href = "../../CLIQUE_AQUI_PARA_ABRIR.html";
            }, 850);

        });
    }


    /* =========================================================
       12. INICIALIZAÇÃO
    ========================================================= */

    updateRoleUI();

    updateStepCards();

});