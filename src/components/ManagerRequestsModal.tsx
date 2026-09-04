import React from 'react';
import { X, Check, ArrowLeftRight, FileText, CheckCircle2, Clock } from 'lucide-react';
import { TimeOffRequest, AbsenceJustification } from '../types';

interface ManagerRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: TimeOffRequest[];
  justifications: AbsenceJustification[];
  onApproveRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  onApproveJustification: (id: string) => void;
  onRejectJustification: (id: string) => void;
}

export const ManagerRequestsModal: React.FC<ManagerRequestsModalProps> = ({
  isOpen,
  onClose,
  requests,
  justifications,
  onApproveRequest,
  onRejectRequest,
  onApproveJustification,
  onRejectJustification,
}) => {
  if (!isOpen) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingJustifications = justifications.filter(j => j.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181F] text-slate-100 rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#111116]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E2F952]" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Central de Aprovações do Gestor
            </h2>
            <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
              {pendingRequests.length + pendingJustifications.length} Pendentes
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs / Lists */}
        <div className="p-4 overflow-y-auto space-y-4">
          
          {/* 1. Trocas e Folgas */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
              Solicitações de Troca de Turno & Folgas ({pendingRequests.length})
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="text-xs text-slate-500 bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                Nenhuma solicitação de troca ou folga pendente.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-[#21212B] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <img src={req.employeeAvatar} alt={req.employeeName} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{req.employeeName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                            {req.type === 'swap' ? '🔄 Troca' : '🏖️ Folga'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Data: <strong className="font-mono text-white">{req.date}</strong>
                          {req.targetEmployeeName && <> • Com: <strong>{req.targetEmployeeName}</strong></>}
                        </p>
                        <p className="text-[11px] text-slate-400 italic mt-0.5">
                          "{req.reason}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => onRejectRequest(req.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => onApproveRequest(req.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E2F952] hover:bg-[#D4F639] text-black font-black transition-colors"
                      >
                        Aprovar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Atestados & Justificativas */}
          <div className="pt-2 border-t border-white/5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Atestados Médicos & Justificativas ({pendingJustifications.length})
            </h3>

            {pendingJustifications.length === 0 ? (
              <div className="text-xs text-slate-500 bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                Nenhum atestado pendente de homologação.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingJustifications.map(just => (
                  <div key={just.id} className="bg-[#21212B] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <img src={just.employeeAvatar} alt={just.employeeName} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{just.employeeName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            📄 Atestado
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Falta em: <strong className="font-mono text-white">{just.date}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 italic mt-0.5">
                          "{just.reason}"
                        </p>
                        {just.documentName && (
                          <span className="inline-block mt-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800">
                            📎 {just.documentName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => onRejectJustification(just.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => onApproveJustification(just.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E2F952] hover:bg-[#D4F639] text-black font-black transition-colors"
                      >
                        Homologar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-[#111116] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
