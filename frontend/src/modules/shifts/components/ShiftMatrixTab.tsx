import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  Plus,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  MessageSquare,
  BarChart3,
  CheckSquare,
  Trash2,
  Layers,
} from 'lucide-react';
import { Employee, Shift } from '@/types';
import { addDaysLocal, startOfWeekMonday, toLocalDateString } from '@/shared/utils/dateUtils';
import { createNotificationSupabase } from '@/modules/notifications/services/notificationService';

interface ShiftMatrixTabProps {
  employees: Employee[];
  shifts: Shift[];
  departments: string[];
  isDark: boolean;
  isRh?: boolean;
  activeEmployee?: Employee;
  pendingRequestsCount: number;
  unreadChatCount?: number;
  onOpenCreateShift: (dateStr?: string, employeeId?: string) => void;
  onOpenEditShift: (shift: Shift) => void;
  onNavigateToOrbit?: () => void;
  onOpenDeleteModal: () => void;
  onSelectTab?: (tab: 'escala' | 'aprovacoes' | 'relatorios' | 'tarefas' | 'chat') => void;
}

/**
 * Aba Grade de Escalas semanais por colaborador (contexto de escalas / shifts).
 */
export const ShiftMatrixTab: React.FC<ShiftMatrixTabProps> = ({
  employees,
  shifts,
  departments,
  isDark,
  isRh = false,
  activeEmployee,
  pendingRequestsCount,
  unreadChatCount,
  onOpenCreateShift,
  onOpenEditShift,
  onNavigateToOrbit,
  onOpenDeleteModal,
  onSelectTab,
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [draftCount, setDraftCount] = useState<number>(27);
  const [isDraftPublished, setIsDraftPublished] = useState<boolean>(false);

  const baseDate = useMemo(
    () => addDaysLocal(startOfWeekMonday(new Date()), currentWeekOffset * 7),
    [currentWeekOffset]
  );

  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

    for (let i = 0; i < 7; i++) {
      const d = addDaysLocal(baseDate, i);
      days.push({
        date: d,
        dateStr: toLocalDateString(d),
        dayName: dayNames[i],
        dayNumber: d.getDate(),
      });
    }
    return days;
  }, [baseDate]);

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(start)} – ${fmt(end)} de ${end.getFullYear()}`;
  }, [weekDays]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (selectedDepartment !== 'all' && emp.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (emp.name || '').toLowerCase().includes(q) || (emp.role || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [employees, selectedDepartment, searchQuery]);

  const shiftsMap = useMemo(() => {
    const map: Record<string, Record<string, Shift[]>> = {};
    shifts.forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = {};
      if (!map[s.employeeId][s.date]) map[s.employeeId][s.date] = [];
      map[s.employeeId][s.date].push(s);
    });
    return map;
  }, [shifts]);

  const handlePublishDrafts = async () => {
    setIsDraftPublished(true);
    setDraftCount(0);
    try {
      const employeeIds = Array.from(new Set(shifts.map(s => s.employeeId).filter(Boolean))) as string[];
      for (const empId of employeeIds) {
        await createNotificationSupabase({
          targetEmployeeId: empId,
          title: 'Escala Oficial Publicada',
          message: 'A escala de trabalho foi publicada pelo gestor. Acesse sua grade para conferir seus turnos.',
          type: 'shift_change',
          actionRequired: false,
        });
      }
    } catch (err) {
      console.warn('Erro ao notificar publicação de escala:', err);
    }
  };

  return (
    <>
      {/* 1. STICKY TOP HEADER CARD (Painel de Gestão de Escalas GESTOR) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Título & Badge GESTOR */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Painel de Gestão de Escalas
                </h1>
                <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
                  GESTOR
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Organize turnos, aprove folgas e publique escalas corporativas
              </p>
            </div>
          </div>

          {/* ABAS SUPERIORES DO GESTOR */}
          <div className="hidden" aria-hidden="true">
            <button
              onClick={() => (onNavigateToOrbit ? onNavigateToOrbit() : onSelectTab?.('escala'))}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 bg-white text-purple-900 shadow-xs border border-slate-200"
            >
              <span>📅 Grade de Escalas</span>
            </button>

            <button
              onClick={() => onSelectTab?.('aprovacoes')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 relative text-slate-600 hover:text-slate-900"
            >
              <span>Aprovações & Faltas</span>
              <span className="w-4 h-4 bg-purple-600 text-white rounded-full text-[9px] font-mono flex items-center justify-center font-bold">
                {pendingRequestsCount || 4}
              </span>
            </button>

            <button
              onClick={() => onSelectTab?.('relatorios')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Relatório de Presenças</span>
            </button>

            <button
              onClick={() => onSelectTab?.('tarefas')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Lembretes & Tarefas</span>
            </button>

            <button
              onClick={() => onSelectTab?.('chat')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden md:inline">Chat Equipe</span>
              {unreadChatCount !== undefined && unreadChatCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-[#96183C] text-white rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {/* User Profile & Publicar Button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePublishDrafts}
              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1 font-mono"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
              <span>Publicar ({draftCount} rascunhos)</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <img
                src={activeEmployee?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee?.name || 'Gestor')}&background=96183c&color=fff&size=150`}
                alt={activeEmployee?.name || 'Gestor'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-600"
              />
              <div className="hidden lg:block text-left text-[11px] leading-tight">
                <span className="block font-black text-slate-900">{activeEmployee?.name || 'Gestão'}</span>
                <span className="text-slate-500 text-[9px] font-mono">{activeEmployee?.role || (isRh ? 'Gestora Master' : 'Gestor')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRADE DE ESCALAS */}
      <div className="space-y-4">
        {/* BARRA DE CONTROLE & FILTROS */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-extrabold">
              <button
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-slate-900 font-mono">
                {currentWeekOffset === 0 ? 'Esta Semana' : currentWeekOffset > 0 ? `+${currentWeekOffset} sem.` : `${currentWeekOffset} sem.`}
              </span>
              <button
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                className="p-1 rounded-lg hover:bg-white hover:text-purple-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              {weekRangeLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar colaborador ou cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-purple-500 font-medium"
              />
            </div>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={`py-1.5 px-3 border text-xs font-bold rounded-xl outline-none cursor-pointer ${
                isDark ? 'bg-[#181A24] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
              style={{ colorScheme: isDark ? 'dark' : 'light' }}
            >
              <option value="all" className={isDark ? 'bg-[#181A24] text-white' : 'bg-white text-slate-800'}>Todos os Setores</option>
              {departments.map(d => (
                <option key={d} value={d} className={isDark ? 'bg-[#181A24] text-white' : 'bg-white text-slate-800'}>{d}</option>
              ))}
            </select>

            {!isRh && (
              <>
                <button
                  onClick={onOpenDeleteModal}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Excluir escalas em lote por período ou filtro"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Excluir Escalas</span>
                </button>

                <button
                  onClick={() => (onNavigateToOrbit ? onNavigateToOrbit() : null)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Abrir Templates de Escala no Calendário Orbit"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span className="hidden sm:inline">Templates</span>
                </button>

                <button
                  onClick={handlePublishDrafts}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-current" />
                  <span>Publicar Escala ({draftCount})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* MODO RASCUNHO ALERT BANNER */}
        {!isRh && !isDraftPublished && draftCount > 0 && (
          <div className="bg-amber-500 text-slate-950 p-3 sm:px-5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm border border-amber-600/30">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="w-5 h-5 rounded-full bg-slate-950/20 text-slate-950 flex items-center justify-center text-xs font-black">!</span>
              <span>
                <strong>Modo RASCUNHO Ativo:</strong> Há {draftCount} turno(s) modificados ou criados que ainda não estão visíveis para os colaboradores.
              </span>
            </div>
            <button
              onClick={handlePublishDrafts}
              className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
            >
              Publicar Agora
            </button>
          </div>
        )}

        {/* LEGENDA DA ESCALA & DICA */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white px-4 py-2 rounded-xl border border-slate-200 text-slate-600">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-extrabold text-slate-900 uppercase font-mono text-[10px] tracking-wider">LEGENDA:</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Presença</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><XCircle className="w-3.5 h-3.5" /> Falta</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700"><AlertCircle className="w-3.5 h-3.5" /> Justificado</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Video className="w-3.5 h-3.5" /> Reunião c/ Link</span>
          </div>
          <div className="text-slate-400 text-[11px] font-medium hidden lg:block">
            💡 Dica: Arraste e solte os turnos entre dias ou pessoas para mover
          </div>
        </div>

        {/* TABELA MATRIZ DE COLABORADORES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[900px]">
            <thead>
              <tr className="bg-white border-b-2 border-slate-100 text-slate-500 font-sans text-[11px] font-bold uppercase tracking-wide">
                <th className="px-4 py-3 w-[200px] border-r border-slate-100">
                  <div className="flex items-center justify-between">
                    <span>COLABORADORES ({filteredEmployees.length})</span>
                    <span className="text-[10px] text-slate-400 font-normal normal-case">Carga / Sem.</span>
                  </div>
                </th>
                {weekDays.map((day) => (
                  <th key={day.dateStr} className="px-2 py-3 text-center border-r border-slate-100 min-w-[135px]">
                    <div className="text-slate-400 font-bold text-[10px] uppercase">{day.dayName}</div>
                    <div className="text-xl font-black text-slate-800 leading-tight mt-0.5">{day.dayNumber}</div>
                    <div className="text-[9px] text-slate-300 font-normal mt-0.5">8 Turnos</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const empShifts = shiftsMap[emp.id] || {};
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Coluna: Info do Colaborador */}
                    <td className="px-4 py-4 border-r border-slate-100 align-top bg-white group-hover:bg-slate-50/60">
                      <div className="flex items-start gap-3">
                        <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block font-extrabold text-slate-900 text-[13px] leading-tight">{emp.name}</span>
                          <span className="block text-[11px] text-slate-400 font-medium mt-0.5">{emp.role}</span>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[9px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                              {emp.department ? emp.department.substring(0, 12) : 'GERAL'}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              {emp.standardHoursPerWeek || 40}h / 44h
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 7 Colunas: Um dia da semana por coluna */}
                    {weekDays.map((day) => {
                      const dayShifts = empShifts[day.dateStr] || [];
                      return (
                        <td key={day.dateStr} className="px-2 py-3 border-r border-slate-100 align-top">
                          <div className="flex flex-col gap-2">
                            {dayShifts.map((shift) => {
                              const isDraft = shift.status === 'draft';
                              const isPresent = shift.attendanceStatus === 'present';
                              const isAbsent = shift.attendanceStatus === 'absent';
                              const isJustified = shift.attendanceStatus === 'justified';
                              const isMeeting = shift.type === 'meeting';

                              const borderColor = isDraft
                                ? 'border-l-amber-400'
                                : isPresent
                                ? 'border-l-emerald-400'
                                : isAbsent
                                ? 'border-l-rose-400'
                                : isMeeting
                                ? 'border-l-sky-400'
                                : 'border-l-violet-400';

                              return (
                                <div
                                  key={shift.id}
                                  onClick={() => onOpenEditShift(shift)}
                                  className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group/card`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-mono font-extrabold text-slate-600">
                                      {shift.startTime} – {shift.endTime}
                                    </span>
                                    {isMeeting && (
                                      <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.3 rounded-md border border-emerald-200">
                                        <Video className="w-2.5 h-2.5" /> Link
                                      </span>
                                    )}
                                  </div>

                                  <div className="font-extrabold text-[12px] text-slate-900 leading-tight line-clamp-2 mb-1.5">
                                    {shift.title || 'Turno Padrão'}
                                  </div>

                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                                      {(shift as any).hoursWorked || '8'}h
                                    </span>

                                    {isPresent && (
                                      <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> Presente
                                      </span>
                                    )}

                                    {isAbsent && (
                                      <span className="text-[9px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                        <XCircle className="w-2.5 h-2.5" /> Falta
                                      </span>
                                    )}

                                    {isJustified && (
                                      <span className="text-[9px] font-mono font-bold bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                        <AlertCircle className="w-2.5 h-2.5" /> Justificado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              onClick={() => onOpenCreateShift(day.dateStr, emp.id)}
                              className="w-full py-1.5 text-[10px] font-bold text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors border border-dashed border-slate-200 hover:border-violet-300 flex items-center justify-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Adicionar</span>
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
