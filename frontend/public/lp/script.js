// ============================
// TEMA CLARO / ESCURO
// ============================

const themeToggle = document.getElementById('themeToggle');
const appThemeBtn = document.querySelector('.app-theme-icon-btn');
const htmlElement = document.documentElement;

function toggleSiteTheme() {
    const isLight = htmlElement.getAttribute('data-theme') === 'light' || htmlElement.classList.contains('modo-claro');

    if (isLight) {
        htmlElement.setAttribute('data-theme', 'dark');
        htmlElement.classList.remove('modo-claro');
        htmlElement.classList.add('modo-escuro');
        localStorage.setItem('pontual-theme', 'dark');
        localStorage.setItem('pontual_theme_preference', 'dark');
        if (window.parent && window.parent !== window) { window.parent.postMessage({ type: 'PONTUAL_THEME_CHANGE', theme: 'dark' }, '*'); }
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        htmlElement.classList.remove('modo-escuro');
        htmlElement.classList.add('modo-claro');
        localStorage.setItem('pontual-theme', 'light');
        localStorage.setItem('pontual_theme_preference', 'light');
        if (window.parent && window.parent !== window) { window.parent.postMessage({ type: 'PONTUAL_THEME_CHANGE', theme: 'light' }, '*'); }
    }
}

if (themeToggle) {
    themeToggle.addEventListener('click', toggleSiteTheme);
}

if (appThemeBtn) {
    appThemeBtn.addEventListener('click', toggleSiteTheme);
}

// ============================
// BOTÃO VOLTAR AO TOPO
// ============================

const backToTopBtn = document.getElementById('backToTop');

if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}


// ============================
// BOTÕES -> DIRECIONAR PARA PÁGINA DE LOGIN
// ============================

function navigateToLoginPage(e) {
    if (e) e.preventDefault();
    const currentTheme =
        htmlElement.getAttribute('data-theme') ||
        (htmlElement.classList.contains('modo-claro') ? 'light' : 'dark');
    try {
        localStorage.setItem('pontual-theme', currentTheme);
        localStorage.setItem('pontual_theme_preference', currentTheme);
    } catch (_) {}

    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'PONTUAL_OPEN_LOGIN', theme: currentTheme }, '*');
    } else {
        window.location.href = '/?login=true';
    }
}

const botoesLogin = document.querySelectorAll(
    '.login-alt, .btn-primary-alt, .primary-button, .header-button, .footer-link-highlight, [data-action="go-login"]'
);

botoesLogin.forEach(botao => {
    botao.addEventListener('click', navigateToLoginPage);
});

// Sincroniza título da página com a janela principal quando dentro de container
if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'PONTUAL_TITLE_CHANGE', title: document.title }, '*');
}


// ============================
// ANIMAÇÃO DE ROLAGEM
// ============================

const animElements = document.querySelectorAll(
    '.floating-card, .process-item, .solution-left, .solution-right, .big-statement h2, .section-top'
);

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                // observer.unobserve(entry.target); // Opcional: animar apenas 1 vez
            }
        });
    },
    { threshold: 0.15 }
);

animElements.forEach(el => {
    el.classList.add('anim-hidden');
    observer.observe(el);
});


// ============================
// MOVIMENTO SUTIL (PARALLAX)
// ============================
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 15; 
    const y = (e.clientY / window.innerHeight - 0.5) * 15;
    
    const heroPanel = document.querySelector('.hero-panel');
    if (heroPanel) {
        heroPanel.style.transform = `rotate(3deg) translate(${x}px, ${y}px)`;
    }

    const cardOne = document.querySelector('.card-one');
    if (cardOne) {
        cardOne.style.transform = `rotate(-4deg) translate(${x * -1.5}px, ${y * -1.5}px)`;
    }

    const cardTwo = document.querySelector('.card-two');
    if (cardTwo) {
        cardTwo.style.transform = `rotate(5deg) translate(${x * 2}px, ${y * 2}px)`;
    }
});


// ============================
// ACORDEON DE RECURSOS (ESCALAS, PONTO, PRESENÇA, GESTÃO)
// ============================
const resourceItems = document.querySelectorAll('.resource-item');

if (resourceItems.length > 0) {
    resourceItems.forEach(item => {
        const header = item.querySelector('.resource-header');
        if (!header) return;

        header.addEventListener('click', () => {
            const isCurrentlyActive = item.classList.contains('active');

            // Fecha os outros itens para experiência de sanfona fluida
            resourceItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherHeader = otherItem.querySelector('.resource-header');
                if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
            });

            // Alterna o item clicado
            if (!isCurrentlyActive) {
                item.classList.add('active');
                header.setAttribute('aria-expanded', 'true');
            }
        });
    });
}


// ============================================
// SIMULAÇÃO DO SMARTPHONE (RELÓGIO & PONTO)
// ============================================

function updatePhoneScreenClock() {
    const clockEl = document.getElementById('screen-clock');
    const topTimeEl = document.getElementById('screen-top-time');
    const dateEl = document.getElementById('screen-date');

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    if (topTimeEl) {
        topTimeEl.textContent = `${hours}:${minutes}`;
    }

    if (dateEl) {
        const days = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayName = days[now.getDay()];
        const dayNum = now.getDate();
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();
        dateEl.textContent = `${dayName}, ${dayNum} De ${monthName} De ${year}`;
    }
}

// Inicia o relógio em tempo real
updatePhoneScreenClock();
setInterval(updatePhoneScreenClock, 1000);

// Simulação de registro de ponto interativo
window.triggerPunchSimulation = function () {
    const btn = document.getElementById('interactive-punch-btn');
    const btnText = document.getElementById('punch-btn-text');
    const exitTimeEl = document.getElementById('step-time-exit');
    const exitItemEl = document.getElementById('step-exit-item');
    const connector2 = document.getElementById('step-connector-2');
    const statusBadge = document.getElementById('app-status-badge');
    const statusText = document.getElementById('app-status-text');

    if (!btn || !btnText) return;

    if (btn.classList.contains('confirmed')) return;

    btn.classList.add('confirmed');
    const originalText = btnText.textContent;
    btnText.textContent = 'SAÍDA CONFIRMADA ✓';

    const originalStatusText = statusText ? statusText.textContent : 'Expediente em andamento';

    if (connector2) {
        connector2.classList.add('active', 'completed-end');
    }

    if (exitItemEl) {
        exitItemEl.classList.add('step-completed', 'shift-end-completed');
    }

    if (exitTimeEl) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        exitTimeEl.textContent = `${hh}:${mm}`;
    }

    if (statusBadge && statusText) {
        statusBadge.classList.add('shift-ended');
        statusText.textContent = 'Turno Finalizado (Fim da Jornada)';
    }

    setTimeout(() => {
        btn.classList.remove('confirmed');
        btnText.textContent = originalText;

        if (connector2) {
            connector2.classList.remove('active', 'completed-end');
        }

        if (exitItemEl) {
            exitItemEl.classList.remove('step-completed', 'shift-end-completed');
        }

        if (exitTimeEl) {
            exitTimeEl.textContent = '--:--';
        }

        if (statusBadge && statusText) {
            statusBadge.classList.remove('shift-ended');
            statusText.textContent = originalStatusText;
        }
    }, 4500);
};

// Navegação suave entre perfis na pagina perfil.html
const profileNavButtons = [
    { btnId: 'btn-empresa', targetId: 'perfil-empresa-rh' },
    { btnId: 'btn-gestor', targetId: 'perfil-gestor' },
    { btnId: 'btn-colaborador', targetId: 'perfil-colaborador-clt' },
    { btnId: 'btn-colaboradorPJ', targetId: 'perfil-colaborador-pj' }
];

profileNavButtons.forEach(item => {
    const btn = document.getElementById(item.btnId);
    if (btn) {
        btn.addEventListener('click', () => {
            const target = document.getElementById(item.targetId);
            if (target) {
                const headerHeight = 90;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    }
});

// ============================================
// LIGHTBOX MODAL PARA IMAGENS (MOBILE & DESKTOP)
// ============================================
const lightboxModal = document.getElementById('imageLightboxModal');
const lightboxImg = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');

if (lightboxModal && lightboxImg) {
    const clickableImages = document.querySelectorAll('.resource-image, .project-photo-wrapper img');
    clickableImages.forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt || 'Visualização do Módulo Pontual';
            if (lightboxCaption) {
                lightboxCaption.textContent = img.alt || 'Toque fora ou no X para fechar';
            }
            lightboxModal.classList.add('active');
            lightboxModal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        });
    });

    const closeLightbox = () => {
        lightboxModal.classList.remove('active');
        lightboxModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        setTimeout(() => {
            if (lightboxImg) lightboxImg.src = '';
        }, 200);
    };

    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxModal.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// ============================================
// MENU SANDUÍCHE (MOBILE)
// ============================================
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mainNav = document.getElementById('mainNav');
const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');

if (mobileMenuToggle && mainNav) {
    const toggleMenu = (open) => {
        const isOpen = open !== undefined ? open : !mainNav.classList.contains('active');
        if (isOpen) {
            mainNav.classList.add('active');
            mobileMenuToggle.classList.add('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'true');
            if (mobileNavBackdrop) mobileNavBackdrop.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            mainNav.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
            if (mobileNavBackdrop) mobileNavBackdrop.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    mobileMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    if (mobileNavBackdrop) {
        mobileNavBackdrop.addEventListener('click', () => toggleMenu(false));
    }

    // Fechar ao clicar em qualquer link da navegação
    const navLinks = mainNav.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            toggleMenu(false);
        });
    });

    // Fechar com a tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mainNav.classList.contains('active')) {
            toggleMenu(false);
        }
    });

    // Fechar ao redimensionar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && mainNav.classList.contains('active')) {
            toggleMenu(false);
        }
    });
}



