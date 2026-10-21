import React, { useState } from 'react';
import { X, Check, ArrowLeftRight, FileText, CheckCircle2, Clock, Briefcase, Link as LinkIcon, ExternalLink, Eye, AlertCircle } from 'lucide-react';
import { TimeOffRequest, AbsenceJustification, PjDeliverableReport } from '@/types';

interface ManagerRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: TimeOffRequest[];
  justifications: AbsenceJustification[];
  pjReports?: PjDeliverableReport[];
  onApproveRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  onApproveJustification: (id: string) => void;
  onRejectJustification: (id: string) => void;
  onApprovePjReport?: (id: string) => void;
  onRejectPjReport?: (id: string, reason?: string) => void;
}

export const ManagerRequestsModal: React.FC<ManagerRequestsModalProps> = ({
  isOpen,
  onClose,
  requests,
  justifications,
  pjReports = [],
  onApproveRequest,
  onRejectRequest,
  onApproveJustification,
  onRejectJustification,
  onApprovePjReport,
  onRejectPjReport,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!isOpen) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pendingJustifications = justifications.filter(j => j.status === 'pending');
  const pendingPjReports = pjReports.filter(p => p.status === 'pending');
  const totalPending = pendingRequests.length + pendingJustifications.length + pendingPjReports.length;

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
              {totalPending} Pendentes
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <span>{req.employeeName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                            {req.type === 'swap' ? '🔄 Troca de Turno' : '🏖️ Folga'}
                          </span>
                          {req.type === 'swap' && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              {req.peerStatus === 'rejected' ? '❌ Recusado pelo colega' : req.peerStatus === 'accepted' ? '✅ Acordo aceito pelo colega' : '⏳ Aguardando aceite do colega'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>Data: <strong className="font-mono text-white">{req.date}</strong></span>
                          {req.shiftStartTime && req.shiftEndTime && (
                            <span className="text-amber-300 font-mono font-semibold">({req.shiftStartTime} às {req.shiftEndTime})</span>
                          )}
                          {req.targetEmployeeName && (
                            <span>➔ Substituto: <strong className="text-white">{req.targetEmployeeName}</strong></span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400 italic mt-0.5">
                          "{req.reason}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => onRejectRequest(req.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => onApproveRequest(req.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E2F952] hover:bg-[#D4F639] text-black font-black transition-colors cursor-pointer"
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
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => onApproveJustification(just.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E2F952] hover:bg-[#D4F639] text-black font-black transition-colors cursor-pointer"
                      >
                        Homologar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Relatórios & Horas PJ */}
          <div className="pt-2 border-t border-white/5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
              <Briefcase className="w-3.5 h-3.5 text-purple-400" />
              Entregas & Horas de Prestadores PJ ({pendingPjReports.length})
            </h3>

            {pendingPjReports.length === 0 ? (
              <div className="text-xs text-slate-500 bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                Nenhum relatório de entregas PJ pendente de aprovação.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPjReports.map(rep => (
                  <div key={rep.id} className="bg-[#21212B] p-3.5 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{rep.employeeName || 'Prestador PJ'}</span>
                          <span className="px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px]">
                            {rep.hoursWorked}h trabalhadas
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Período: <strong className="text-slate-200">{rep.period}</strong> • Enviado em: {new Date(rep.submittedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => {
                            if (onRejectPjReport) {
                              const reason = window.prompt('Motivo da recusa ou solicitação de ajustes:');
                              if (reason !== null) {
                                onRejectPjReport(rep.id, reason);
                              }
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          Recusar / Ajustes
                        </button>
                        <button
                          onClick={() => onApprovePjReport && onApprovePjReport(rep.id)}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          Aprovar Entregas
                        </button>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="text-xs text-slate-300 bg-black/20 p-2.5 rounded-lg border border-white/5 leading-relaxed whitespace-pre-line">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5 font-bold">Atividades:</span>
                      {rep.activitiesDescription}
                    </div>

                    {/* Links */}
                    {rep.links && rep.links.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Evidências:</span>
                        {rep.links.map((link, lIdx) => (
                          <a
                            key={lIdx}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all cursor-pointer"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>{link.title || link.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Imagens */}
                    {rep.images && rep.images.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Imagens anexadas ({rep.images.length}):</span>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {rep.images.map((img, iIdx) => (
                            <div
                              key={iIdx}
                              onClick={() => setSelectedImage(img)}
                              className="group relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/40 cursor-pointer hover:border-purple-500 transition-all shadow-xs"
                            >
                              <img src={img} alt={`Evidência ${iIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Lightbox para Imagens Ampliadas */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedImage} alt="Evidência ampliada" className="max-w-full max-h-[85vh] rounded-2xl object-contain border border-white/20" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-900 border border-white/20 rounded-full text-white cursor-pointer hover:bg-rose-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
