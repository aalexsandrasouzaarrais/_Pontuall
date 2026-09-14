import React from 'react';
import { X, Briefcase, TrendingUp, AlertTriangle, CheckCircle2, DollarSign, Clock, FileSpreadsheet } from 'lucide-react';
import { Employee, Shift } from '../types';
import { calculateShiftDurationHours } from '../utils/dateUtils';

interface PjContractsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  shifts: Shift[];
}

export const PjContractsModal: React.FC<PjContractsModalProps> = ({
  isOpen,
  onClose,
  employees,
  shifts,
}) => {
  if (!isOpen) return null;

  const pjEmployees = employees.filter(e => e.contractType === 'PJ');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181F] text-slate-100 rounded-2xl w-full max-w-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#111116]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                Painel de Contratos PJ & Acompanhamento de Horas
                <span className="text-[10px] font-mono bg-[#E2F952] text-black font-extrabold px-2 py-0.5 rounded-full">
                  RF11 / BNE Employer
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle de franquia mensal, saldo restante e projeção de faturamento NFS-e
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#21212B] p-3.5 rounded-xl border border-white/5 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono uppercase">Contratos PJ Ativos</span>
              <div className="text-xl font-black text-white">{pjEmployees.length} Prestadores</div>
              <p className="text-[10px] text-emerald-400">● 100% com franquia configurada</p>
            </div>

            <div className="bg-[#21212B] p-3.5 rounded-xl border border-white/5 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono uppercase">Meta Contratual Total</span>
              <div className="text-xl font-black text-[#faf0ac]">
                {pjEmployees.reduce((acc, curr) => acc + (curr.monthlyHoursQuota || 160), 0)}h / mês
              </div>
              <p className="text-[10px] text-slate-400">Franquia global alocada</p>
            </div>

            <div className="bg-[#21212B] p-3.5 rounded-xl border border-white/5 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono uppercase">Previsão Faturamento Total</span>
              <div className="text-xl font-black text-[#E2F952]">
                R$ {pjEmployees.reduce((acc, curr) => acc + ((curr.monthlyHoursQuota || 160) * (curr.hourlyRate || 45)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-emerald-400">Projeção para fechamento NFS-e</p>
            </div>
          </div>

          {/* Cards for each PJ Employee */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              Detalhamento Individual de Horas
            </h3>

            {pjEmployees.map(emp => {
              const empShifts = shifts.filter(s => s.employeeId === emp.id);
              
              // Completed hours (present or confirmed)
              const completedHours = empShifts
                .filter(s => s.attendanceStatus === 'present')
                .reduce((acc, s) => acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes), 0);

              // Scheduled future hours
              const scheduledHours = empShifts
                .filter(s => s.attendanceStatus !== 'present')
                .reduce((acc, s) => acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes), 0);

              const totalHours = completedHours + scheduledHours;
              const quota = emp.monthlyHoursQuota || 160;
              const remaining = Math.max(0, quota - completedHours);
              const progressPct = Math.min(100, Math.round((totalHours / quota) * 100));
              const rate = emp.hourlyRate || 45.0;
              const projectedAmount = totalHours * rate;
              const isOverQuota = totalHours > quota;

              return (
                <div key={emp.id} className="bg-[#21212B] p-4 rounded-xl border border-white/5 space-y-3 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/40" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{emp.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                            CONTRATO PJ
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {emp.role} • {emp.workplace || emp.department} • Taxa: <strong className="text-emerald-400 font-mono">R$ {rate.toFixed(2)}/h</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-mono">Projeção de Faturamento</div>
                      <div className="text-sm font-black text-[#E2F952] font-mono">
                        R$ {projectedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300">
                        <strong>{completedHours}h</strong> realizadas + <strong>{scheduledHours}h</strong> agendadas
                      </span>
                      <span className={`${isOverQuota ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                        Meta: {quota}h ({progressPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-[#111116] h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${Math.min(100, (completedHours / quota) * 100)}%` }}
                        title={`Realizadas: ${completedHours}h`}
                      />
                      <div
                        className="bg-purple-500 h-full transition-all"
                        style={{ width: `${Math.min(100 - (completedHours / quota) * 100, (scheduledHours / quota) * 100)}%` }}
                        title={`Agendadas: ${scheduledHours}h`}
                      />
                    </div>
                  </div>

                  {/* Badges / Warnings */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono">Saldo Restante:</span>
                      <span className="font-bold text-white font-mono bg-white/5 px-2 py-0.5 rounded">
                        {remaining}h
                      </span>
                    </div>

                    {isOverQuota ? (
                      <div className="flex items-center gap-1.5 text-rose-400 bg-rose-950/40 px-2 py-1 rounded border border-rose-800 text-[11px] font-bold font-mono">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Alerta: Escala ultrapassará a franquia contratada (+{totalHours - quota}h)
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Alocação dentro da franquia
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-white/10 bg-[#111116] flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Fórmulas: Saldo = Meta - Realizadas | Faturamento = Total Horas × Taxa
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E2F952] hover:bg-[#D4F639] text-black font-black transition-all"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
};
