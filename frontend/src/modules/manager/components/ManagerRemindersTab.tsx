import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Clock,
  Search,
  Users,
  Sparkles,
  CheckCircle2,
  Edit2,
  Trash2,
  Calendar,
  Video,
  X,
  Check,
} from 'lucide-react';
import { Employee } from '@/types';
import {
  addDaysLocal,
  toLocalDateString,
  formatDateBR,
  normalizeDateToISO,
} from '@/shared/utils/dateUtils';
import { sanitizeSafeUrl } from '@/shared/utils/security';
import { showPolishedToast } from '@/components/ui/halo-toast';
import {
  ReminderItem,
  getRemindersSupabase,
  createReminderSupabase,
  updateReminderSupabase,
  toggleCompletedSupabase,
  deleteReminderSupabase,
} from '@/modules/shifts/services/reminderService';

interface ManagerRemindersTabProps {
  employees: Employee[];
  activeEmployee?: Employee;
  isDark: boolean;
}

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'reuniao':
      return {
        label: 'Reunião',
        dotColor: '#7c5cbf',
        accentColor: '#7c5cbf',
        bg: 'rgba(124, 92, 191, 0.10)',
        border: 'rgba(124, 92, 191, 0.22)',
        text: '#b49de0',
      };
    case 'plantao':
      return {
        label: 'Plantão',
        dotColor: '#b58e1a',
        accentColor: '#b58e1a',
        bg: 'rgba(181, 142, 26, 0.10)',
        border: 'rgba(181, 142, 26, 0.22)',
        text: '#d4a832',
      };
    case 'treinamento':
      return {
        label: 'Treinamento',
        dotColor: '#2d7fa8',
        accentColor: '#2d7fa8',
        bg: 'rgba(45, 127, 168, 0.10)',
        border: 'rgba(45, 127, 168, 0.22)',
        text: '#6db8d8',
      };
    default:
      return {
        label: 'Atividade',
        dotColor: '#c0541a',
        accentColor: '#c0541a',
        bg: 'rgba(192, 84, 26, 0.10)',
        border: 'rgba(192, 84, 26, 0.22)',
        text: '#d97c44',
      };
  }
};

/**
 * Aba de Lembretes e Tarefas operacionais do gestor (contexto de gestão / manager).
 */
export const ManagerRemindersTab: React.FC<ManagerRemindersTabProps> = ({
  employees,
  activeEmployee,
  isDark,
}) => {
  const allAssignablePeople = useMemo(() => {
    return [...employees];
  }, [employees]);

  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  useEffect(() => {
    async function loadReminders() {
      const data = await getRemindersSupabase({
        companyId: activeEmployee?.companyId,
        creatorId: activeEmployee?.id,
        visibleEmployeeIds: employees.map(e => e.id),
      });
      if (data && data.length > 0) {
        setReminders(data);
      } else {
        setReminders([]);
      }
    }

    loadReminders();
  }, [employees, activeEmployee?.id, activeEmployee?.companyId]);

  const [reminderSearch, setReminderSearch] = useState('');
  const [reminderFilterType, setReminderFilterType] = useState<string>('all');
  const [reminderCollaboratorFilter, setReminderCollaboratorFilter] = useState<string>('all');
  const [isNewReminderModalOpen, setIsNewReminderModalOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [collaboratorSearchInModal, setCollaboratorSearchInModal] = useState('');
  const [newReminderData, setNewReminderData] = useState<{
    title: string;
    description: string;
    type: 'reuniao' | 'atividade' | 'plantao' | 'treinamento';
    tag: string;
    date: string;
    time: string;
    link: string;
    assignedEmployeeIds: string[];
  }>({
    title: '',
    description: '',
    type: 'atividade',
    tag: 'Geral',
    date: toLocalDateString(new Date()),
    time: '09:00',
    link: '',
    assignedEmployeeIds: [],
  });

  const handleOpenNewReminderModal = () => {
    setEditingReminderId(null);
    setNewReminderData({
      title: '',
      description: '',
      type: 'atividade',
      tag: 'Geral',
      date: toLocalDateString(new Date()),
      time: '09:00',
      link: '',
      assignedEmployeeIds: [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  const handleOpenEditReminderModal = (rem: ReminderItem) => {
    setEditingReminderId(rem.id);
    setNewReminderData({
      title: rem.title,
      description: rem.description,
      type: rem.type,
      tag: rem.tag,
      date: rem.date,
      time: rem.time,
      link: rem.link || '',
      assignedEmployeeIds: rem.assignedEmployeeIds ? [...rem.assignedEmployeeIds] : [],
    });
    setCollaboratorSearchInModal('');
    setIsNewReminderModalOpen(true);
  };

  const filteredReminders = useMemo(() => {
    const cutoff60 = toLocalDateString(addDaysLocal(new Date(), -60));
    return reminders.filter((rem) => {
      // Ocultar automaticamente lembretes com mais de 60 dias
      const remDateISO = normalizeDateToISO(rem.date);
      if (remDateISO && remDateISO < cutoff60) return false;

      if (reminderFilterType !== 'all' && rem.type !== reminderFilterType) return false;
      if (reminderCollaboratorFilter !== 'all') {
        if (!rem.assignedEmployeeIds || !rem.assignedEmployeeIds.includes(reminderCollaboratorFilter)) {
          return false;
        }
      }
      if (reminderSearch.trim()) {
        const q = reminderSearch.toLowerCase();
        const matchesAssigned = rem.assignedEmployeeIds?.some(empId => {
          const emp = allAssignablePeople.find(e => e.id === empId);
          return emp && (
            (emp.name || '').toLowerCase().includes(q) ||
            (emp.role || '').toLowerCase().includes(q) ||
            (emp.department || '').toLowerCase().includes(q)
          );
        });
        return (
          rem.title.toLowerCase().includes(q) ||
          rem.description.toLowerCase().includes(q) ||
          rem.tag.toLowerCase().includes(q) ||
          (rem.assigneeName && rem.assigneeName.toLowerCase().includes(q)) ||
          Boolean(matchesAssigned)
        );
      }
      return true;
    });
  }, [reminders, reminderFilterType, reminderCollaboratorFilter, reminderSearch, allAssignablePeople]);

  return (
    <div className="approvals-page reminders-page w-full space-y-6 animate-in fade-in duration-200 relative">
      {/* Efeito Glow de Fundo suave */}
      <div
        className="reminders-background-glow absolute -top-12 right-0 w-[500px] h-[350px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245, 146, 66, 0.10) 0%, rgba(159, 36, 60, 0.07) 45%, transparent 75%)',
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      {/* Hero Banner (Suporta Dark e Light) */}
      <div
        className={`approvals-hero reminders-hero rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
        style={{
          backgroundColor: isDark ? '#111216' : '#ffffff',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        {/* Feixe quente suavizado */}
        <div
          className="reminders-hero-flare absolute -top-1/2 -right-10 w-[55%] h-[200%] pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.16) 0%, rgba(100, 12, 30, 0.18) 45%, transparent 75%)'
              : 'radial-gradient(circle at 60% 50%, rgba(245, 146, 66, 0.12) 0%, rgba(100, 12, 30, 0.08) 45%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              isDark ? 'text-slate-300 border-white/10 bg-white/5' : 'text-slate-600 border-slate-200 bg-slate-100'
            }`}>
              <span className="w-3.5 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #640c1e, #9F243C, #F59242)' }} />
              <span>GESTÃO OPERACIONAL & ROTINA</span>
            </div>
            <h1 className={`reminders-title text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Lembretes e{' '}
              <span
                className={`reminders-title-highlight inline-block bg-clip-text text-transparent ${
                  isDark
                    ? 'bg-gradient-to-r from-[#F9DE97] via-[#F59242] to-[#9F243C]'
                    : 'bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242]'
                }`}
                style={{
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }}
              >
                Tarefas
              </span>
            </h1>
            <p className={`reminders-description text-xs sm:text-sm leading-relaxed ${
              isDark ? 'text-slate-400' : 'text-slate-600 font-medium'
            }`}>
              Organize reuniões operacionais, controle prazos de publicação de escalas e monitore tarefas de alinhamento com a equipe em tempo real.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleOpenNewReminderModal}
              className="reminders-primary-button px-5 py-2.5 font-bold text-xs rounded-full text-white flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 56%, #F59242 100%)',
                boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)',
              }}
            >
              <Plus className="w-4 h-4" /> Novo Lembrete / Tarefa
            </button>
          </div>
        </div>
      </div>

      {/* Aviso de Retenção de 60 Dias em Lembretes */}
      <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs relative z-10 ${
        isDark ? 'bg-amber-950/20 border-amber-500/20 text-slate-300' : 'bg-amber-50/80 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-[#F59242] shrink-0" />
          <span>
            <strong>Política de Retenção de 60 Dias:</strong> Lembretes anteriores a 60 dias são automaticamente ocultados/expurgados. Você também pode excluir lembretes individualmente a qualquer momento.
          </span>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#F59242]/10 text-[#F59242] font-bold border border-[#F59242]/20 shrink-0 hidden sm:inline-block">
          Expiração 60d
        </span>
      </div>

      {/* Filter Bar (Suporta Dark e Light) */}
      <div
        className={`approval-filter-bar reminders-filter-bar p-3.5 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 relative z-10 ${
          isDark ? 'border-[#282a33]' : 'border-slate-200 shadow-xs'
        }`}
        style={{ background: isDark ? '#15161b' : '#ffffff' }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className={`reminders-search-icon w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={reminderSearch}
            onChange={(e) => setReminderSearch(e.target.value)}
            placeholder="Buscar tarefas por título, pauta, tag ou colaborador..."
            className={`reminders-search-input w-full pl-9 pr-3 py-2 text-xs rounded-full outline-none transition-colors border ${
              isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
            }`}
            style={{
              background: isDark ? '#0e0f12' : '#f8fafc',
              border: isDark ? '1px solid #282a33' : '1px solid #e2e8f0',
            }}
          />
        </div>

        {/* Type Filter Pills */}
        <div className={`reminders-type-filter flex items-center gap-1 p-1 rounded-full border overflow-x-auto custom-scrollbar ${
          isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-100 border-slate-200'
        }`}>
          {[
            { id: 'all', label: 'Todos os Tipos' },
            { id: 'reuniao', label: 'Reuniões' },
            { id: 'atividade', label: 'Atividades' },
            { id: 'plantao', label: 'Plantões' },
            { id: 'treinamento', label: 'Treinamentos' },
          ].map((tab) => {
            const isActive = reminderFilterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setReminderFilterType(tab.id)}
                data-active={isActive ? 'true' : 'false'}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'shadow-md'
                    : isDark
                    ? 'text-slate-300 hover:text-[#F9DE97]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                style={
                  isActive
                    ? { background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 100%)', color: '#F9DE97', boxShadow: '0 2px 10px rgba(100, 12, 30, 0.4)' }
                    : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter by allocated collaborator */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${
          isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-100 border-slate-200'
        }`}>
          <Users className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#F59242]' : 'text-[#96183c]'}`} />
          <select
            value={reminderCollaboratorFilter}
            onChange={(e) => setReminderCollaboratorFilter(e.target.value)}
            className={`bg-transparent text-xs font-semibold outline-none cursor-pointer pr-1 ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
            style={{ colorScheme: isDark ? 'dark' : 'light' }}
          >
            <option value="all" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>
              Todos os Responsáveis
            </option>
            {allAssignablePeople.map((emp) => (
              <option key={emp.id} value={emp.id} className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>
                {emp.name} ({emp.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de Cards de Tarefas (Identidade Visual Dark e Light) */}
      {filteredReminders.length === 0 ? (
        <div className={`reminders-empty-state flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-3xl relative z-10 ${
          isDark ? 'border-[#282a33] bg-[#15161b]' : 'border-slate-300 bg-white shadow-xs'
        }`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
            isDark ? 'bg-white/5' : 'bg-slate-100'
          }`}>
            <Sparkles className={`w-6 h-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Nenhum lembrete ou tarefa encontrado
          </h3>
          <p className={`text-xs mt-1 max-w-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {reminderSearch || reminderCollaboratorFilter !== 'all'
              ? 'Tente ajustar sua busca ou limpar os filtros de colaboradores.'
              : 'Clique em "Novo Lembrete / Tarefa" para criar seu primeiro compromisso.'}
          </p>
        </div>
      ) : (
        <div className="reminders-grid grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
          {filteredReminders.map((rem) => {
            const badge = getTypeBadge(rem.type);
            const allocatedPeople = (rem.assignedEmployeeIds || [])
              .map(id => allAssignablePeople.find(p => p.id === id))
              .filter(Boolean) as Employee[];

            return (
              <div
                key={rem.id}
                className={`reminders-task-card group relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                  rem.completed
                    ? isDark ? 'bg-[#15161b]/60 border-[#282a33]/60 opacity-75 hover:opacity-100' : 'bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-100'
                    : isDark ? 'bg-[#15161b] border-[#282a33] hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
                }`}
                data-reminder-type={rem.type}
                style={{
                  boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)',
                  borderLeft: rem.completed ? undefined : `3px solid ${badge.accentColor}`,
                }}
              >
                {/* Top Header: Badge, Tag & Actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="reminder-type-badge inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                      data-reminder-type={rem.type}
                      style={{
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: badge.dotColor }}
                      />
                      {badge.label}
                    </span>
                    <span className={`reminder-tag text-[11px] font-mono px-2.5 py-0.5 rounded-lg border ${
                      isDark ? 'text-slate-400 bg-[#0e0f12] border-[#282a33]' : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}>
                      #{rem.tag}
                    </span>
                  </div>

                  {/* Actions: Toggle Complete, Edit & Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        const newStatus = !rem.completed;
                        setReminders(prev => prev.map(r => r.id === rem.id ? { ...r, completed: newStatus } : r));
                        await toggleCompletedSupabase(rem.id, rem.completed);
                      }}
                      title={rem.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
                      data-completed={rem.completed ? 'true' : 'false'}
                      className={`reminders-complete-button p-1.5 rounded-lg transition-colors cursor-pointer ${
                        rem.completed
                          ? isDark
                            ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30'
                            : 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                          : isDark
                          ? 'text-slate-400 hover:text-emerald-400 hover:bg-white/5 border border-white/5'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEditReminderModal(rem)}
                      title="Editar lembrete / alocar pessoas"
                      className={`reminders-edit-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                        isDark
                          ? 'text-slate-400 hover:text-[#F59242] hover:bg-white/5 border-transparent hover:border-[#F59242]/20'
                          : 'text-slate-400 hover:text-[#9F243C] hover:bg-slate-100 border-transparent hover:border-slate-300'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Deseja realmente excluir o lembrete individual "${rem.title}"? Esta ação é definitiva.`)) {
                          setReminders(prev => prev.filter(r => r.id !== rem.id));
                          await deleteReminderSupabase(rem.id);
                          showPolishedToast({
                            id: `del-rem-${rem.id}`,
                            title: 'Lembrete Excluído',
                            description: `O lembrete "${rem.title}" foi excluído com sucesso.`,
                            rimVariant: 'destructive',
                          });
                        }
                      }}
                      title="Excluir este lembrete individualmente"
                      className={`reminders-delete-button p-1.5 rounded-lg transition-colors cursor-pointer border ${
                        isDark
                          ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-transparent hover:border-rose-500/25'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-300'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content: Title & Description */}
                <div className="space-y-1.5 mb-2">
                  <h3 className={`reminders-task-title font-bold text-sm tracking-tight leading-snug transition-colors ${
                    rem.completed ? 'text-slate-400 line-through' : isDark ? 'text-white group-hover:text-slate-200' : 'text-slate-900 group-hover:text-slate-700'
                  }`}>
                    {rem.title}
                  </h3>
                  <p className={`reminders-task-description text-xs leading-relaxed line-clamp-2 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {rem.description}
                  </p>
                </div>

                {/* Allocated Collaborators Banner */}
                <div className={`my-2.5 p-2 rounded-xl border flex items-center justify-between gap-2.5 ${
                  isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {allocatedPeople.length > 0 ? (
                      <div className="flex items-center shrink-0">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {allocatedPeople.slice(0, 3).map((person, idx) => (
                            <img
                              key={person.id || idx}
                              src={person.avatar}
                              alt={person.name}
                              title={`${person.name} • ${person.role} (${person.department})`}
                              className={`inline-block w-6 h-6 rounded-full ring-2 object-cover ${
                                isDark ? 'ring-[#15161b]' : 'ring-white'
                              }`}
                            />
                          ))}
                        </div>
                        {allocatedPeople.length > 3 && (
                          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>
                            +{allocatedPeople.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                        isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'
                      }`}>
                        <Users className="w-3 h-3" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <span className={`text-[9px] uppercase font-bold tracking-wider block font-mono ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {allocatedPeople.length === 1
                          ? 'Pessoa Alocada'
                          : allocatedPeople.length > 1
                          ? `${allocatedPeople.length} Pessoas Alocadas`
                          : 'Equipe / Responsáveis'}
                      </span>
                      <span
                        className={`font-medium truncate block text-xs ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                        title={allocatedPeople.length > 0 ? allocatedPeople.map(p => p.name).join(', ') : rem.assigneeName || 'Equipe Geral'}
                      >
                        {allocatedPeople.length > 0
                          ? allocatedPeople.map(p => p.name).join(', ')
                          : (rem.assigneeName || 'Equipe Geral')}
                      </span>
                    </div>
                  </div>

                  {allocatedPeople.length > 0 ? (
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono border ${
                      isDark ? 'text-[#F9DE97] bg-[#F59242]/10 border-[#F59242]/20' : 'text-amber-800 bg-amber-50 border-amber-200'
                    }`}>
                      {allocatedPeople.length === 1 ? '1 alocado' : `${allocatedPeople.length} alocados`}
                    </span>
                  ) : (
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono border ${
                      isDark ? 'text-slate-400 bg-white/5 border-white/10' : 'text-slate-600 bg-slate-200 border-slate-300'
                    }`}>
                      Geral
                    </span>
                  )}
                </div>

                {/* Footer Row: Date, Time & Meeting Link */}
                <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                  isDark ? 'border-white/5' : 'border-slate-100'
                }`}>
                  <div className={`flex items-center gap-2 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <Calendar className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span>{formatDateBR(rem.date)}</span>
                    </div>
                    <div className={`reminder-meta-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <Clock className={`reminder-meta-icon w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span>{rem.time}</span>
                    </div>
                  </div>

                  {rem.link && sanitizeSafeUrl(rem.link, { fallback: '' }) ? (
                    <a
                      href={sanitizeSafeUrl(rem.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reminder-call-button px-3.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition-all hover:opacity-80 shadow-sm text-white"
                      style={{
                        background: '#1d5c42',
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Acessar Chamada</span>
                    </a>
                  ) : (
                    <span className={`text-[11px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {rem.tag}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Novo Lembrete / Tarefa ou Edição com Alocação de Pessoas */}
      {isNewReminderModalOpen && (
        <div
          className="reminders-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => {
            setIsNewReminderModalOpen(false);
            setEditingReminderId(null);
          }}
        >
          <div
            className={`reminders-modal relative w-full max-w-xl max-h-[90vh] rounded-3xl border shadow-2xl p-6 overflow-hidden flex flex-col space-y-4 my-auto ${
              isDark ? 'border-white/10 bg-[#15161b] text-white' : 'border-slate-200 bg-white text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59242]" />
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {editingReminderId ? 'Editar Lembrete / Tarefa' : 'Criar Novo Lembrete / Tarefa'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsNewReminderModalOpen(false);
                  setEditingReminderId(null);
                }}
                className={`reminders-modal-close w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Scrollable */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newReminderData.title.trim()) return;

                const assignedNames = newReminderData.assignedEmployeeIds
                  .map(id => allAssignablePeople.find(p => p.id === id)?.name)
                  .filter(Boolean) as string[];

                const computedAssigneeName = assignedNames.length > 0
                  ? assignedNames.join(', ')
                  : 'Equipe Geral';

                const reminderPayload: Partial<ReminderItem> = {
                  type: newReminderData.type,
                  tag: newReminderData.tag.trim() || 'Geral',
                  title: newReminderData.title.trim(),
                  description: newReminderData.description.trim() || 'Sem descrição adicional.',
                  date: newReminderData.date,
                  time: newReminderData.time,
                  link: newReminderData.link.trim() || undefined,
                  assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                  assigneeName: computedAssigneeName,
                };

                if (editingReminderId) {
                  const updated = await updateReminderSupabase(editingReminderId, reminderPayload);
                  setReminders(prev => prev.map(r => r.id === editingReminderId ? {
                    ...r,
                    ...(updated || reminderPayload),
                  } : r));
                } else {
                  const created = await createReminderSupabase(
                    {
                      ...reminderPayload,
                      completed: false,
                    },
                    {
                      creatorId: activeEmployee?.id,
                      companyId: activeEmployee?.companyId,
                    }
                  );
                  if (created) {
                    setReminders(prev => [created, ...prev]);
                  } else {
                    setReminders(prev => [
                      {
                        id: `rem-${Date.now()}`,
                        type: newReminderData.type,
                        tag: newReminderData.tag.trim() || 'Geral',
                        title: newReminderData.title.trim(),
                        description: newReminderData.description.trim() || 'Sem descrição adicional.',
                        date: newReminderData.date,
                        time: newReminderData.time,
                        link: newReminderData.link.trim() || undefined,
                        assignedEmployeeIds: newReminderData.assignedEmployeeIds,
                        assigneeName: computedAssigneeName,
                        completed: false,
                      },
                      ...prev,
                    ]);
                  }
                }

                setIsNewReminderModalOpen(false);
                setEditingReminderId(null);
              }}
              className="space-y-4 text-xs overflow-y-auto pr-1 flex-1"
            >
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  TÍTULO DO COMPROMISSO
                </label>
                <input
                  type="text"
                  required
                  value={newReminderData.title}
                  onChange={(e) => setNewReminderData({ ...newReminderData, title: e.target.value })}
                  placeholder="Ex: Alinhamento de Metas Mensais"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                    isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TIPO
                  </label>
                  <select
                    value={newReminderData.type}
                    onChange={(e) => setNewReminderData({ ...newReminderData, type: e.target.value as 'reuniao' | 'atividade' | 'plantao' | 'treinamento' })}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  >
                    <option value="atividade" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Atividade Operacional</option>
                    <option value="reuniao" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Reunião de Equipe</option>
                    <option value="plantao" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Plantão / Sobreaviso</option>
                    <option value="treinamento" className={isDark ? 'bg-[#15161b] text-white' : 'bg-white text-slate-900'}>Treinamento / Onboarding</option>
                  </select>
                </div>

                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    TAG / PROJETO
                  </label>
                  <input
                    type="text"
                    value={newReminderData.tag}
                    onChange={(e) => setNewReminderData({ ...newReminderData, tag: e.target.value })}
                    placeholder="Ex: Gestão, Suporte, Metas"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    DATA
                  </label>
                  <input
                    type="date"
                    value={newReminderData.date}
                    onChange={(e) => setNewReminderData({ ...newReminderData, date: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </div>

                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    HORÁRIO
                  </label>
                  <input
                    type="time"
                    value={newReminderData.time}
                    onChange={(e) => setNewReminderData({ ...newReminderData, time: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] cursor-pointer border ${
                      isDark ? 'bg-[#0e0f12] border-[#282a33] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </div>
              </div>

              {/* ALOCAR PESSOAS / COLABORADORES RESPONSÁVEIS */}
              <div className={`rounded-2xl border p-3.5 space-y-3 ${
                isDark ? 'bg-[#0e0f12] border-[#282a33]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${isDark ? 'text-[#F59242]' : 'text-[#9F243C]'}`} />
                    <div>
                      <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ALOCAR PESSOAS PARA A TAREFA
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Selecione uma ou mais pessoas da equipe
                      </span>
                    </div>
                  </div>

                  {/* Quick Selection Actions */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setNewReminderData(prev => ({
                          ...prev,
                          assignedEmployeeIds: allAssignablePeople.map(p => p.id),
                        }));
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                    >
                      Selecionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewReminderData(prev => ({
                          ...prev,
                          assignedEmployeeIds: [],
                        }));
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-rose-600'
                      }`}
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* Mini Search inside modal */}
                <div className="relative">
                  <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="text"
                    value={collaboratorSearchInModal}
                    onChange={(e) => setCollaboratorSearchInModal(e.target.value)}
                    placeholder="Buscar colaborador por nome, cargo ou setor..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#F59242] transition-colors border ${
                      isDark ? 'bg-[#15161b] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {/* Selected Chips */}
                {newReminderData.assignedEmployeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newReminderData.assignedEmployeeIds.map(id => {
                      const person = allAssignablePeople.find(p => p.id === id);
                      if (!person) return null;
                      return (
                        <span
                          key={id}
                          className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            isDark ? 'bg-[#F59242]/15 border-[#F59242]/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
                          }`}
                        >
                          <img
                            src={person.avatar}
                            alt={person.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                          <span>{person.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewReminderData(prev => ({
                                ...prev,
                                assignedEmployeeIds: prev.assignedEmployeeIds.filter(item => item !== id),
                              }));
                            }}
                            className="hover:opacity-75 transition-opacity cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Collaborator Grid / List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {allAssignablePeople
                    .filter(p => {
                      if (!collaboratorSearchInModal.trim()) return true;
                      const query = collaboratorSearchInModal.toLowerCase();
                      return (
                        (p.name || '').toLowerCase().includes(query) ||
                        (p.role || '').toLowerCase().includes(query) ||
                        (p.department || '').toLowerCase().includes(query)
                      );
                    })
                    .map((person) => {
                      const isSelected = newReminderData.assignedEmployeeIds.includes(person.id);
                      return (
                        <div
                          key={person.id}
                          onClick={() => {
                            setNewReminderData(prev => {
                              const exists = prev.assignedEmployeeIds.includes(person.id);
                              return {
                                ...prev,
                                assignedEmployeeIds: exists
                                  ? prev.assignedEmployeeIds.filter(id => id !== person.id)
                                  : [...prev.assignedEmployeeIds, person.id],
                              };
                            });
                          }}
                          className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                            isSelected
                              ? isDark ? 'bg-[#F59242]/15 border-[#F59242] shadow-sm' : 'bg-amber-50 border-amber-400 shadow-xs'
                              : isDark ? 'bg-[#15161b] border-[#282a33] hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#F59242] border-[#F59242] text-black font-bold'
                              : isDark ? 'border-slate-600 bg-black/40' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <img
                            src={person.avatar}
                            alt={person.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10 shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <span className={`block font-semibold text-xs truncate ${
                              isSelected ? (isDark ? 'text-white' : 'text-slate-900 font-bold') : (isDark ? 'text-slate-200' : 'text-slate-800')
                            }`}>
                              {person.name}
                            </span>
                            <span className={`block text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {person.role} • {person.department}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className={`flex items-center justify-between text-[11px] pt-1 font-mono ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>
                    {newReminderData.assignedEmployeeIds.length === 0
                      ? 'Nenhuma pessoa alocada (será atribuído à Equipe Geral)'
                      : `${newReminderData.assignedEmployeeIds.length} pessoa(s) alocada(s)`}
                  </span>
                </div>
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  LINK DE VÍDEO (OPCIONAL)
                </label>
                <input
                  type="url"
                  value={newReminderData.link}
                  onChange={(e) => setNewReminderData({ ...newReminderData, link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors border ${
                    isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  DESCRIÇÃO / PAUTA
                </label>
                <textarea
                  rows={2}
                  value={newReminderData.description}
                  onChange={(e) => setNewReminderData({ ...newReminderData, description: e.target.value })}
                  placeholder="Descreva detalhes ou orientações para a equipe..."
                  className={`w-full px-3.5 py-2 rounded-xl text-xs outline-none focus:border-[#F59242] transition-colors resize-none border ${
                    isDark ? 'bg-[#0e0f12] border-[#282a33] text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className={`flex items-center justify-end gap-3 pt-3 border-t shrink-0 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewReminderModalOpen(false);
                    setEditingReminderId(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:scale-105 cursor-pointer"
                  style={{
                    background: 'linear-gradient(90deg, #640c1e 0%, #9F243C 58%, #F59242 100%)',
                    boxShadow: '0 4px 18px rgba(100, 12, 30, 0.35)',
                  }}
                >
                  {editingReminderId ? 'Salvar Alterações' : 'Salvar Compromisso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
