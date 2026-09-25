# 📋 Documentação do Projeto: Pontuall (Employer WorkShift)

 **Sistema Integrado de Gestão de Escalas, Ponto Digital e Portal do Colaborador**

---

## 📌 1. Visão Geral

O **Pontuall**  é uma solução moderna e responsiva voltada para a gestão operacional de equipes, escalas de trabalho e registro de jornada. O sistema integra, em uma única plataforma, as necessidades da **Gestão/Liderança** (criação e monitoramento de escalas, gestão de contratos e aprovação de solicitações) e as necessidades do **Colaborador** (registro de ponto com geolocalização, consulta de turnos, envio de atestados e pedidos de troca).

---

## 🎯 2. Principais Objetivos

**Simplificar a Gestão de Escalas**: Visualização intuitiva de escalas semanais e mensais em formato de matriz e calendário interativo.
**Segurança no Ponto Digital**: Marcação de ponto com validação de GPS e horário em tempo real.
**Autonomia para o Colaborador**: Solicitação simplificada de folgas, trocas de turno e envio de atestados médicos.
**Controle CLT e PJ**: Gestão diferenciada entre colaboradores CLT (metas de horas semanais) e prestadores PJ (banco de horas, valor hora e orçamento mensal).
**Comunicação Centralizada**: Canal de chat interno e central de notificações operacionais.

---

## 👥 3. Perfis e Funcionalidades

O sistema conta com um seletor dinâmico de perfil no topo da aplicação, permitindo alternar entre as visões:

### 👔 A. Visão do Gestor (Manager View)
**Matriz de Escalas (Matrix Grid)**: Grade visual completa por colaborador e dias da semana, identificando turnos, folgas e plantões.
**Orbit Calendar**: Calendário interativo de escala com codificação visual por cores e status dos postos de trabalho.
**Gestão de Contratos PJ**: Painel com acompanhamento de horas orçadas vs. executadas, valor hora e total financeiro acumulado.
**Central de Aprovações**: Modais dedicados para aprovar ou recusar solicitações de troca de turnos e pedidos de folga compensatória.
**Gestão de Justificativas e Atestados**: Análise e validação de documentos médicos e declarações anexadas pelos colaboradores.
**Lembretes e Alertas**: Avisos sobre escalas pendentes, faltas e inconformidades de jornada.

### 👷 B. Visão do Colaborador (Employee Portal)
**Registro de Ponto Digital (GPS)**: Registro de entrada, intervalo e saída com verificação de coordenadas geográficas e botão rápido de confirmação.
**Meu Calendário de Turnos**: Visualização mensal/semanal dos turnos programados, horários de pausa e locais de trabalho.
**Acompanhamento de Horas**: Gráfico da meta semanal de horas trabalhadas, saldo acumulado e indicadores de assiduidade.
**Trocas de Turno**: Pedidos diretos de troca de escala com colegas de equipe, sujeitos à aprovação do gestor.
**Envio de Atestados & Justificativas**: Formulário rápido para anexar comprovantes médicos e justificar ausências.
**Chat da Equipe**: Canal de mensagens em tempo real para contato com a liderança e colegas de time.
**Central de Notificações**: Alertas sobre publicação de novas escalas, aprovação de solicitações e comunicados gerais.

---

## 💻 4. Stack Tecnológica

| Tecnologia | Finalidade |
| :--- | :--- |
| **React 19** | Biblioteca principal para interface declarativa e componentes reativos |
| **TypeScript** | Tipagem estática, reduzindo falhas em tempo de execução e documentando entidades |
| **Tailwind CSS v4** | Estilização utilitária moderna e responsiva |
| **Vite 6** | Build tool e servidor de desenvolvimento ultra-rápido |
| **Lucide React** | Biblioteca de ícones moderna e consistente |
| **Motion** | Animações e transições fluídas de interface |
| **Canvas-Confetti** | Feedback visual comemorativo para registros de ponto e aprovações |

---

## 📂 5. Estrutura do Projeto
text
_Pontuall-main/
├── CLIQUE_AQUI_PARA_ABRIR.html   # Versão standalone para abrir direto no navegador
├── 1-INICIAR_SERVIDOR_LOCAL.bat  # Script para iniciar o servidor local com 1 clique
├── package.json                  # Dependências e scripts do projeto
├── tsconfig.json                 # Configurações do TypeScript
├── vite.config.ts                # Configurações do Vite
├── index.html                    # Entrada HTML do modo de desenvolvimento
│
└── src/
    ├── main.tsx                  # Ponto de entrada do React
    ├── App.tsx                   # Componente raiz e gerenciamento de estado global
    ├── index.css                 # Importação dos estilos globais e Tailwind
    │
    ├── components/               # Componentes de interface do sistema
    │   ├── EmployeeNavbar.tsx        # Barra de navegação e alternância de perfil
    │   ├── EmployeeMainView.tsx      # Dashboard do colaborador e ponto GPS
    │   ├── EmployeeCalendarView.tsx  # Calendário de escalas do colaborador
    │   ├── ManagerView.tsx           # Ponto de entrada da visão do gestor
    │   ├── ManagerMainView.tsx       # Dashboard analítico da gestão
    │   ├── ManagerMatrixGrid.tsx     # Grade semanal matricial de escalas
    │   ├── OrbitCalendarView.tsx     # Visualização gráfica das escalas
    │   ├── ManagerRequestsModal.tsx  # Modal de aprovação de solicitações
    │   ├── PjContractsModal.tsx      # Painel de gestão de contratos PJ
    │   ├── JustificationModal.tsx    # Modal para envio/análise de atestados
    │   ├── ShiftSwapModal.tsx        # Modal de solicitação de troca de turno
    │   ├── NotificationsModal.tsx    # Central de notificações
    │   └── ChatModal.tsx             # Canal de comunicação interna
    │
    ├── data/
    │   └── mockData.ts           # Dados mockados realistas (usuários, turnos, solicitações)
    │
    ├── types/                    # Interfaces TypeScript (Employee, Shift, etc.)
    └── utils/                    # Funções utilitárias (cálculo de datas e horas)

---

## 🚀 6. Como Executar

O projeto oferece duas maneiras simples de execução:

### 🌟 Opção 1: Execução Direta (Sem instalar nada)
Ideal para demonstrações rápidas ou uso em máquinas sem ambiente Node.js:
1. Navegue até a pasta do projeto.
2. Dê um duplo clique no arquivo **CLIQUE_AQUI_PARA_ABRIR.html**.
3. O sistema abrirá imediatamente em seu navegador com todas as telas e interações disponíveis.

### 🛠️ Opção 2: Modo Desenvolvedor (Node.js & Vite)
Para desenvolver ou customizar os componentes:

1. **Instale as dependências:**
   bash
   npm install
   
2. **Inicie o servidor de desenvolvimento:**
   bash
   npm run dev
   
   (Ou dê um duplo clique no arquivo 1-INICIAR_SERVIDOR_LOCAL.bat)
3. **Acesse no navegador:**
   [http://localhost:3000](http://localhost:3000)

4. **Gerar versão de produção (Build):**
   bash
   npm run build
   
---

## 💡 7. Diferenciais do Sistema

1. **Pronto para Uso (Zero Configuração)**: Inclui uma versão autocontida (CLIQUE_AQUI_PARA_ABRIR.html) que dispensa instalações para testes de interface.
2. **Design System Moderno**: Interface limpa, intuitiva e com suporte a microinterações fluidas.
3. **Flexibilidade Operacional**: Alternância fluida entre o ponto de vista do colaborador e do gestor em tempo real.
4. **Resolução de Conflitos**: Ferramentas visuais que facilitam a cobertura de postos de trabalho e previnem sobrecarga ou buracos nas escalas.