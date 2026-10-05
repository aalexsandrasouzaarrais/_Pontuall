import React, { useState, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Filter, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Clock
} from 'lucide-react';
import { Employee, Shift } from '@/types';

interface DeleteShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
  employees: Employee[];
  onDeleteShifts: (shiftIds: string[]) => void;
  theme?: 'light' | 'dark';
}

export const DeleteShiftsModal: React.FC<DeleteShiftsModalProps> = ({
  isOpen,
  onClose,
  shifts,
  employees,
  onDeleteShifts,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Períodos pré-definidos
  const [periodPreset, setPeriodPreset] = useState<'week' | 'month' | 'next30' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Filtros
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  if (!isOpen) return null;

  // Calcula início/fim do período baseado no preset
  const { filterStart, filterEnd } = (() => {
    const now = new Date();
    if (periodPreset === 'all') {
      return { filterStart: '', filterEnd: '' };
    }
    if (periodPreset === 'week') {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        filterStart: start.toISOString().split('T')[0],
        filterEnd: end.toISOString().split('T')[0],
      };
    }
    if (periodPreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        filterStart: start.toISOString().split('T')[0],
        filterEnd: end.toISOString().split('T')[0],
      };
    }
    if (periodPreset === 'next30') {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(now.getDate() + 30);
      return {
        filterStart: start.toISOString().split('T')[0],
        filterEnd: end.toISOString().split('T')[0],
      };
    }
    // custom
    return { filterStart: startDate, filterEnd: endDate };
  })();

  // Filtra as escalas que serão afetadas
  const targetShifts = shifts.filter(s => {
    // Período
    if (filterStart && s.date < filterStart) return false;
    if (filterEnd && s.date > filterEnd) return false;

    // Colaborador
    if (selectedEmployeeId !== 'all' && s.employeeId !== selectedEmployeeId) return false;

    return true;
  });

  const handleConfirmDelete = () => {
    const ids = targetShifts.map(s => s.id);
    if (ids.length > 0) {
      onDeleteShifts(ids);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 font-sans border transition-colors ${
          isDark
            ? 'bg-[#12131A] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl'
        }`}
      >
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-500" />

        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDark ? 'border-white/10' : 'border-slate-150 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Excluir Escalas em Lote
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Filtre por período ou colaborador para remover escalas do sistema
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* 1. Seleção de Período */}
          <div className="space-y-2">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              1. Selecione o Período
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'month', label: 'Mês Atual' },
                { id: 'week', label: 'Semana' },
                { id: 'next30', label: 'Próx. 30 Dias' },
                { id: 'all', label: 'Todas' },
                { id: 'custom', label: 'Custom' },
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPeriodPreset(preset.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                    periodPreset === preset.id
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 font-bold shadow-sm'
                      : isDark
                      ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range Inputs */}
            {periodPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className={`block text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data Inicial</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs outline-none border transition-all ${
                      isDark
                        ? 'bg-[#181A24] border-white/10 text-white focus:border-rose-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500'
                    }`}
                  />
                </div>
                <div>
                  <span className={`block text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data Final</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs outline-none border transition-all ${
                      isDark
                        ? 'bg-[#181A24] border-white/10 text-white focus:border-rose-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Filtro de Colaborador */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              2. Colaborador
            </label>
            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl text-xs outline-none border transition-all ${
                isDark
                  ? 'bg-[#181A24] border-white/10 text-white focus:border-rose-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500'
              }`}
            >
              <option value="all">👥 Todos os Colaboradores ({employees.length})</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  👤 {e.name} ({e.role || 'Colaborador'})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Card de Resumo de Impacto & Prévia */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              targetShifts.length > 0
                ? isDark
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
                : isDark
                ? 'bg-white/5 border-white/10 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 shrink-0" />
                <div>
                  <span className="text-xs font-bold block">
                    {targetShifts.length === 0
                      ? 'Nenhuma escala encontrada com estes filtros'
                      : `${targetShifts.length} ${targetShifts.length === 1 ? 'escala encontrada' : 'escalas encontradas'} para exclusão`}
                  </span>
                  {filterStart && filterEnd && (
                    <span className="text-[11px] opacity-80 block font-mono">
                      Período: {filterStart} até {filterEnd}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-2xl font-black font-mono">
                {targetShifts.length}
              </span>
            </div>

            {/* Lista Prévia dos Turnos */}
            {targetShifts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-current/10 max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono">
                {targetShifts.slice(0, 10).map(s => {
                  const emp = employees.find(e => e.id === s.employeeId);
                  return (
                    <div key={s.id} className="flex items-center justify-between opacity-90 py-0.5">
                      <span>{emp?.name || 'Colaborador'} — {s.date}</span>
                      <span>{s.startTime} às {s.endTime}</span>
                    </div>
                  );
                })}
                {targetShifts.length > 10 && (
                  <div className="text-[11px] opacity-70 italic pt-1">
                    ...e mais {targetShifts.length - 10} escalas
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Banner de Alerta / Confirmação Visível Diretamente na Tela */}
          {targetShifts.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Tem certeza que deseja apagar {targetShifts.length} escala(s)?</span>
              </div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Esta ação removerá as escalas selecionadas da grade do colaborador e do Supabase. Esta operação não pode ser desfeita.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? 'border-white/10 bg-[#0e1017]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={targetShifts.length === 0}
            onClick={handleConfirmDelete}
            className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              targetShifts.length === 0
                ? 'bg-slate-700/50 text-slate-500 border border-white/5 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40 hover:scale-105 active:scale-95'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir {targetShifts.length} Escala(s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
