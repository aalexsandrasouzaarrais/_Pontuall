# 📋 Plano de Ação e Divisão de Tarefas (Pontuall)

Para evitar que vocês duas modifiquem os mesmos arquivos e tenham problemas com o Git na hora de juntar (merge conflicts), dividi as tarefas agrupando-as por **módulos** e **arquivos**. 

Dessa forma, enquanto uma mexe na pasta de Autenticação/Gestor, a outra mexe na pasta de Solicitações/Notificações!

---

## 👩‍💻 Desenvolvedora A (Sugestão: Kamile)
**Foco:** Autenticação, Sessão e Escalas/Turnos.
**Pastas principais:** `modules/auth`, `modules/manager`, `modules/shifts`

### Tarefas:
- [x] **Juntar os commits:** (✅ **Já realizamos juntos!** O seu repositório já está atualizado no GitHub).
- [ ] **Quando dou F5 na página ela muda de conta, analise o motivo:**
  - *Onde procurar:* Verificar o contexto de autenticação (ex: `AuthContext.tsx` ou serviços em `modules/auth`). O problema costuma ser o token salvo no `localStorage` / `sessionStorage` que não está sendo recuperado corretamente ou está puxando o usuário padrão errado.
- [ ] **No colaborador está bugado na tabela do gestor (Foto/Nome do gestor ao invés do colaborador):**
  - *Onde procurar:* Provavelmente em `modules/manager/components/ManagerMatrixGrid.tsx` ou outro componente de tabela do gestor. O `ID` ou o objeto do usuário que está preenchendo a linha da tabela está pegando o usuário logado (gestor) em vez de iterar sobre a lista de colaboradores da equipe.
- [ ] **Não está aparecendo colega para trocar de turno:**
  - *Onde procurar:* No modal de troca de turnos em `modules/shifts`. Verificar se a função que busca a lista de colegas no banco está retornando dados vazios, ou se está exigindo um ID de empresa/equipe que não está sendo passado.

---

## 👩‍💻 Desenvolvedora B (Sugestão: Alexsandra)
**Foco:** Solicitações, Lembretes, Atestados e Notificações.
**Pastas principais:** `modules/requests`, `modules/justifications`, `modules/notifications`

### Tarefas:
- [ ] **Lembrete tem que dar pra abrir:**
  - *Onde procurar:* Na tela onde os lembretes são listados. Adicionar um evento de `onClick` que abra um Modal (ex: `ReminderDetailModal`) para exibir a descrição completa, links e participantes.
- [ ] **Folga compensatória não está aparecendo para o gestor:**
  - *Onde procurar:* Nos serviços de `modules/requests/services`. Verificar se a consulta (query) ao Supabase está filtrando o tipo "folga_compensatoria" corretamente, ou se o status padrão está escondendo ela da lista de aprovações.
- [ ] **Feedback do gestor em "aprovações e faltas" não aparece pro colaborador:**
  - *Onde procurar:* Na visão do colaborador de justificativas/solicitações. O campo onde o gestor digita o motivo (ex: `Des_Motivo_Recusa`) está sendo salvo no banco, mas o frontend do colaborador não está exibindo esse campo na interface.
- [ ] **Atestado não abre quando o gestor clica:**
  - *Onde procurar:* Na lógica de upload/download de arquivos (Storage do Supabase). Provavelmente o link salvo no banco é um caminho interno, e vocês precisam gerar uma *Public URL* (se o bucket for público) ou uma *Signed URL* na hora de clicar para visualizar.
- [ ] **Não chega notificação:**
  - *Onde procurar:* No `modules/notifications`. Verificar se a lógica de WebSocket (Realtime) do Supabase está ativada para as tabelas correspondentes, ou se a inserção na tabela de notificações está falhando.

---

## 🧹 Tarefa em Conjunto (ÚLTIMA TAREFA)
> ⚠️ **Atenção:** Só façam essa tarefa **DEPOIS** que todas as de cima estiverem terminadas e juntadas no `main`. Fazer isso agora vai causar muitos conflitos para quem estiver desenvolvendo as telas.

- [ ] **Apagar todos os mockups (usar apenas dados do banco):**
  - *O que fazer:* Deletar os arquivos de dados falsos (ex: `mockData.ts`, listas `const mockUsers = [...]`) e limpar os imports. Mudar as chamadas de API para apontarem 100% para os serviços do Supabase em todos os módulos.
