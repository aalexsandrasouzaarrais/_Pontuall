# Pontual - Sistema de Login e Cadastro

Interface web moderna, acessível e responsiva desenvolvida para acesso e cadastro de colaboradores e gestores da plataforma **Pontual**.

---

## ✨ Funcionalidades

- **Alternância de Perfis:** Alternância ágil entre perfil de **Colaborador** e perfil de **Gestor**.
- **Modos Claro e Escuro (Dark/Light):**
  - Paleta com alto contraste e cores refinadas.
  - Suporte a persistência da preferência do usuário via `localStorage`.
- **Verificador de Força de Senha:**
  - Barra animada em tempo real na tela de criação de conta do gestor.
  - Indicadores visuais: *Fraca (vermelho)*, *Média (laranja)* e *Forte (verde)*.
- **Identidade Visual & Favicon:**
  - Ícone da aba do navegador personalizado em múltiplos tamanhos (`.ico` e `.png`).
  - Títulos da aba atualizados dinamicamente de acordo com a tela e o perfil selecionado.
- **Design Totalmente Responsivo:** Otimizado para telas de smartphones, tablets e desktops.

---

## 📁 Estrutura de Pastas

```text
├── assets/
│   ├── css/
│   │   ├── conta2.css          # Estilos da página de cadastro
│   │   └── login2.css          # Estilos da página de login
│   ├── images/
│   │   ├── favicon.ico         # Favicon em formato ICO
│   │   ├── favicon.png         # Favicon em formato PNG
│   │   ├── logo_pontual_claro.png
│   │   ├── logo_pontual_transparente.png
│   │   └── Pontual-Branco.png
│   └── js/
│       └── script.js           # Lógica de alternância de temas, perfis e formulários
├── .gitignore
├── conta2.html                 # Página de criação de conta (Gestor)
├── login2.html                 # Página de autenticação / login
└── README.md
```

---

## 🚀 Como Executar

1. Clone este repositório ou faça o download dos arquivos:
   ```bash
   git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   ```
2. Abra o arquivo `login2.html` ou `conta2.html` diretamente em qualquer navegador moderno.
   - Opcionalmente, utilize extensões como o **Live Server** no VS Code.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5** (Semântico e acessível)
- **CSS3** (Flexbox, CSS Grid, Variáveis CSS, Gradientes modernos)
- **JavaScript Vanilla** (Interatividade, validações e manipulação do DOM)
- **Lucide Icons** (Ícones vetoriais leves)
