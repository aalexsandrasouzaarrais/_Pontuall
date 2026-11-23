import { getTodayDateString, formatDateBR } from '@/shared/utils/dateUtils';
import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { Employee, Shift, AbsenceJustification } from '@/types';
import { uploadDocumentSupabase } from '@/shared/services/storageService';
import { validateUploadFile } from '@/shared/utils/security';

export type JustificationCategoryType = 'absence' | 'delay' | 'early_entry' | 'early_leave' | 'overtime' | 'forgetfulness';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  shifts: Shift[];
  onSubmitJustification: (justification: Partial<AbsenceJustification> & { justificationType?: JustificationCategoryType }) => void;
  onUpdateJustification?: (id: string, updates: Partial<AbsenceJustification>) => void;
  editingJustification?: AbsenceJustification | null;
  isLightTheme?: boolean;
  initialShiftId?: string;
  initialDate?: string;
  initialReason?: string;
  justificationType?: JustificationCategoryType;
  delayMinutes?: number;
}

export const JustificationModal: React.FC<JustificationModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  shifts,
  onSubmitJustification,
  onUpdateJustification,
  editingJustification,
  isLightTheme = false,
  initialShiftId,
  initialDate,
  initialReason,
  justificationType = 'absence',
  delayMinutes,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<JustificationCategoryType>(justificationType || 'absence');
  const isDelay = selectedCategory === 'delay';
  const isEarlyEntry = selectedCategory === 'early_entry';
  const isEarlyLeave = selectedCategory === 'early_leave';
  const isOvertime = selectedCategory === 'overtime';
  const isForgetfulness = selectedCategory === 'forgetfulness';
  const isTimeDeviation = isDelay || isEarlyEntry || isEarlyLeave || isOvertime || isForgetfulness;

  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [absenceDate, setAbsenceDate] = useState('');
  const [reason, setReason] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isUploaded, setIsUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Limpa rigorosamente os campos ao abrir para novo atestado ou preenche ao editar
  useEffect(() => {
    if (isOpen) {
      if (editingJustification) {
        setSelectedShiftId(editingJustification.shiftId || shifts[0]?.id || '');
        setAbsenceDate(editingJustification.date || getTodayDateString());
        setReason(editingJustification.reason || '');
        setDocumentName(editingJustification.documentName || '');
        setDocumentUrl(editingJustification.documentUrl || '');
        setIsUploaded(Boolean(editingJustification.documentName || editingJustification.documentUrl));
        setIsUploading(false);

        const rLower = (editingJustification.reason || '').toLowerCase();
        if (rLower.includes('hora extra')) setSelectedCategory('overtime');
        else if (rLower.includes('esqueci') || rLower.includes('esquecimento')) setSelectedCategory('forgetfulness');
        else if (rLower.includes('saída antecipada') || rLower.includes('saida antecipada')) setSelectedCategory('early_leave');
        else if (rLower.includes('entrada antecipada')) setSelectedCategory('early_entry');
        else if (rLower.includes('atraso')) setSelectedCategory('delay');
        else setSelectedCategory('absence');
      } else {
        // Novo atestado: 100% limpo, sem resquícios do envio anterior
        setSelectedCategory(justificationType || 'absence');
        setSelectedShiftId(initialShiftId || shifts[0]?.id || '');
        setAbsenceDate(initialDate || getTodayDateString());
        setReason(initialReason || '');
        setDocumentName('');
        setDocumentUrl('');
        setIsUploaded(false);
        setIsUploading(false);
      }
    }
  }, [isOpen, editingJustification, initialShiftId, initialDate, initialReason, shifts, justificationType]);

  const handleClose = () => {
    setSelectedShiftId('');
    setAbsenceDate('');
    setReason('');
    setDocumentName('');
    setDocumentUrl('');
    setIsUploaded(false);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateUploadFile(file, { mode: 'document', maxSizeBytes: 10 * 1024 * 1024 });
      if (!validation.valid) {
        alert(validation.error || 'Arquivo inválido. Selecione PDF, PNG, JPG ou WEBP.');
        e.target.value = '';
        return;
      }
      setDocumentName(file.name);
      setIsUploaded(true);
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setDocumentUrl(prev => prev || (reader.result as string));
        }
      };
      reader.readAsDataURL(file);

      try {
        const uploadRes = await uploadDocumentSupabase(file);
        if (uploadRes?.url) {
          setDocumentUrl(uploadRes.url);
        }
      } catch (err) {
        console.warn('Fallback para DataURL no anexo:', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleShiftChange = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    const chosen = shifts.find(s => s.id === shiftId);
    if (chosen?.date) {
      setAbsenceDate(chosen.date);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const chosenShift = shifts.find(s => s.id === selectedShiftId);
    const finalDate = absenceDate || chosenShift?.date || getTodayDateString();

    let formattedReason = reason;
    if (selectedCategory === 'forgetfulness') {
      const isExit = justificationType === 'overtime';
      const refTime = isExit ? (chosenShift?.endTime || '17:00') : (chosenShift?.startTime || '08:00');
      const tag = isExit
        ? `[Esquecimento de Saída: Saída real no horário previsto (${refTime})]`
        : `[Esquecimento de Entrada: Chegada real no horário previsto (${refTime})]`;
      if (!formattedReason.includes('[Esquecimento')) {
        formattedReason = `${tag} ${formattedReason}`;
      }
    }

    if (editingJustification && onUpdateJustification) {
      onUpdateJustification(editingJustification.id, {
        shiftId: selectedShiftId || undefined,
        date: finalDate,
        reason: formattedReason,
        documentName: documentName || editingJustification.documentName,
        documentUrl: documentUrl || editingJustification.documentUrl,
      });
    } else {
      onSubmitJustification({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        employeeAvatar: currentEmployee.avatar,
        shiftId: selectedShiftId || undefined,
        date: finalDate,
        reason: formattedReason,
        documentName: documentName || undefined,
        documentType: documentName ? 'application/pdf' : undefined,
        documentUrl: documentUrl || undefined,
        status: 'pending',
        justificationType: selectedCategory,
        delayMinutes: delayMinutes || undefined,
      } as any);
    }

    handleClose();
  };

  const isPreselectedOccurrence = Boolean(initialShiftId || initialDate || editingJustification);
  const chosenShift = shifts.find(s => s.id === selectedShiftId);
  const occurrenceLabel = isOvertime
    ? `Hora Extra / Extensão ${delayMinutes ? `(+${delayMinutes} min)` : ''}`
    : isForgetfulness
      ? (justificationType === 'overtime' ? 'Esquecimento de Saída' : 'Esquecimento de Entrada')
      : isDelay
        ? `Atraso de Entrada ${delayMinutes ? `(+${delayMinutes} min)` : ''}`
        : isEarlyEntry
          ? `Entrada Antecipada ${delayMinutes ? `(-${delayMinutes} min)` : ''}`
          : isEarlyLeave
            ? `Saída Antecipada ${delayMinutes ? `(-${delayMinutes} min)` : ''}`
            : 'Falta / Ausência no Turno';

  const modalTitle = editingJustification
    ? 'Editar Atestado / Justificativa'
    : isOvertime
      ? 'Justificar / Solicitar Hora Extra'
      : isForgetfulness
        ? (justificationType === 'overtime' ? 'Justificar Esquecimento de Saída' : 'Justificar Esquecimento de Entrada')
        : isDelay
          ? 'Justificar Atraso de Entrada'
          : isEarlyEntry
            ? 'Justificar Entrada Antecipada'
            : isEarlyLeave
              ? 'Justificar Saída Antecipada'
              : 'Enviar Atestado / Justificar Ausência';

  const modalSubtitle = isOvertime
    ? 'Informe a demanda, urgência ou chamado que motivou o tempo adicional trabalhado.'
    : isForgetfulness
      ? (justificationType === 'overtime'
          ? `Declare que você encerrou o expediente no horário contratual (${chosenShift?.endTime || '17:00'}) e relate o motivo da batida posterior.`
          : `Declare que você iniciou o expediente no horário contratual (${chosenShift?.startTime || '08:00'}) e relate o motivo da batida posterior.`)
      : isDelay
        ? (delayMinutes ? `Atraso registrado de +${delayMinutes} min. Informe o motivo para o gestor.` : 'Informe o motivo do atraso e anexe declaração/comprovante se aplicável.')
        : isEarlyEntry
          ? (delayMinutes ? `Entrada registrada ${delayMinutes} min antes do horário previsto. Informe o motivo para o gestor.` : 'Informe o motivo da entrada antecipada para análise do gestor.')
          : isEarlyLeave
            ? (delayMinutes ? `Saída registrada ${delayMinutes} min antes do término previsto. Informe o motivo para o gestor.` : 'Informe o motivo da saída antecipada e anexe declaração se aplicável.')
            : 'Envie comprovantes médicos ou declarações legais';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/70 backdrop-blur-md'} animate-in fade-in duration-200`}>
      <div 
        className={`relative rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors ${
          isLightTheme ? 'bg-white border border-slate-200 text-slate-800' : 'text-white'
        }`}
        style={
          isLightTheme
            ? {
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
              }
            : {
                background: 'linear-gradient(160deg, #181920 0%, #111217 60%, #0d0e12 100%)',
                border: '1px solid rgba(150, 24, 60, 0.35)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
              }
        }
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB] shrink-0"></div>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${
          isLightTheme ? 'border-slate-100 bg-slate-50/60' : 'border-white/5 bg-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-bold text-base leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                  {modalTitle}
                </h3>
                {isPreselectedOccurrence && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    isLightTheme
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-[#f89847]/15 border-[#f89847]/40 text-[#f89847]'
                  }`}>
                    {occurrenceLabel}
                  </span>
                )}
              </div>
              <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                {modalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLightTheme
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body com scroll interno independente */}
        <form onSubmit={handleSubmit} className={`p-5 space-y-4 overflow-y-auto flex-1 ${isLightTheme ? 'text-slate-800' : 'text-white'}`}>
          {/* Seletor Contextual de Categoria (Quando veio pré-selecionado de Entrada ou Saída tardia) */}
          {isPreselectedOccurrence && (justificationType === 'delay' || justificationType === 'overtime') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-[10px] font-semibold uppercase tracking-wider ${
                  isLightTheme ? 'text-slate-600' : 'text-white/60'
                }`}>
                  {justificationType === 'overtime'
                    ? 'O que motivou o registro após o horário previsto?'
                    : 'O que motivou a entrada após o horário previsto?'}
                </label>
                <span className="text-[10px] font-bold text-amber-500">
                  Defina a realidade do fato
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {justificationType === 'overtime' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('overtime')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        selectedCategory === 'overtime'
                          ? isLightTheme
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                            : 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-md'
                          : isLightTheme
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedCategory === 'overtime' ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400/50'}`} />
                      <div className="truncate">
                        <div className="truncate font-bold">Fiz Hora Extra</div>
                        <div className="text-[10px] font-normal opacity-80 truncate">Trabalhei após o expediente</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCategory('forgetfulness')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        selectedCategory === 'forgetfulness'
                          ? isLightTheme
                            ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-xs'
                            : 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-md'
                          : isLightTheme
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedCategory === 'forgetfulness' ? 'bg-purple-500 shadow-xs' : 'bg-slate-400/50'}`} />
                      <div className="truncate">
                        <div className="truncate font-bold">Esqueci de Bater</div>
                        <div className="text-[10px] font-normal opacity-80 truncate">Saí no horário contratual</div>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('delay')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        selectedCategory === 'delay'
                          ? isLightTheme
                            ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                            : 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-md'
                          : isLightTheme
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedCategory === 'delay' ? 'bg-amber-500 shadow-xs' : 'bg-slate-400/50'}`} />
                      <div className="truncate">
                        <div className="truncate font-bold">Cheguei com Atraso</div>
                        <div className="text-[10px] font-normal opacity-80 truncate">Tive imprevisto / consulta</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedCategory('forgetfulness')}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        selectedCategory === 'forgetfulness'
                          ? isLightTheme
                            ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-xs'
                            : 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-md'
                          : isLightTheme
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedCategory === 'forgetfulness' ? 'bg-purple-500 shadow-xs' : 'bg-slate-400/50'}`} />
                      <div className="truncate">
                        <div className="truncate font-bold">Esqueci de Bater</div>
                        <div className="text-[10px] font-normal opacity-80 truncate">Cheguei no horário regular</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Categoria / Tipo de Ocorrência Selector (Apenas quando não veio pré-selecionado de um card) */}
          {!isPreselectedOccurrence && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-[10px] font-semibold uppercase tracking-wider ${
                  isLightTheme ? 'text-slate-600' : 'text-white/60'
                }`}>
                  Tipo de Ocorrência / Justificativa
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'absence', label: 'Falta / Ausência', activeClass: 'border-rose-500 bg-rose-500/15 text-rose-400' },
                  { key: 'delay', label: 'Atraso de Entrada', activeClass: 'border-amber-500 bg-amber-500/15 text-amber-400' },
                  { key: 'early_leave', label: 'Saída Antecipada', activeClass: 'border-orange-500 bg-orange-500/15 text-orange-400' },
                  { key: 'overtime', label: 'Hora Extra', activeClass: 'border-emerald-500 bg-emerald-500/15 text-emerald-400' },
                  { key: 'forgetfulness', label: 'Esquecimento', activeClass: 'border-purple-500 bg-purple-500/15 text-purple-400' },
                ].map(cat => {
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCategory(cat.key as JustificationCategoryType)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? isLightTheme
                            ? 'border-[#96183c] bg-[#96183c]/10 text-[#96183c] shadow-xs'
                            : `${cat.activeClass} shadow-md`
                          : isLightTheme
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? 'bg-current shadow-xs' : 'bg-slate-400/50'
                      }`} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Absence Date Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-[10px] font-semibold uppercase tracking-wider ${
                isLightTheme ? 'text-slate-600' : 'text-white/60'
              }`}>
                {isTimeDeviation ? 'Data do Turno da Ocorrência' : 'Data da Ausência / Falta'}
              </label>
              {isPreselectedOccurrence && (
                <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1 font-bold">
                  <Lock className="w-3 h-3" /> Bloqueado
                </span>
              )}
            </div>
            <input
              type="date"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
              disabled={isPreselectedOccurrence}
              className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none border ${
                isPreselectedOccurrence
                  ? isLightTheme
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-80'
                    : 'bg-white/5 border-white/5 text-slate-400 cursor-not-allowed opacity-75'
                  : isLightTheme
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
                    : 'bg-white/5 border-white/10 text-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
              }`}
              style={{ colorScheme: isLightTheme ? 'light' : 'dark' }}
              required
            />
          </div>

          {/* Shift Selection (Optional / Fixed) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-[10px] font-semibold uppercase tracking-wider ${
                isLightTheme ? 'text-slate-600' : 'text-white/60'
              }`}>
                Vincular a um Turno da Escala
              </label>
              {isPreselectedOccurrence && (
                <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1 font-bold">
                  <Lock className="w-3 h-3" /> Bloqueado
                </span>
              )}
            </div>
            <select
              value={selectedShiftId}
              onChange={(e) => handleShiftChange(e.target.value)}
              disabled={isPreselectedOccurrence}
              className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors appearance-none focus:outline-none border ${
                isPreselectedOccurrence
                  ? isLightTheme
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-80'
                    : 'bg-white/5 border-white/5 text-slate-400 cursor-not-allowed opacity-75'
                  : isLightTheme
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
                    : 'bg-white/5 border-white/10 text-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
              }`}
            >
              <option value="" className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}>
                Nenhum turno específico (ou selecionar...)
              </option>
              {shifts.map(s => (
                <option
                  key={s.id}
                  value={s.id}
                  className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}
                >
                  {formatDateBR(s.date)} — {s.startTime} às {s.endTime} ({s.title || 'Turno Regular'})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              {isOvertime
                ? 'Motivo da Hora Extra / Demanda Urgente'
                : isForgetfulness
                  ? 'Motivo do Esquecimento e Horário Efetivo de Trabalho'
                  : isDelay
                    ? 'Motivo do Atraso'
                    : isEarlyEntry
                      ? 'Motivo da Entrada Antecipada'
                      : isEarlyLeave
                        ? 'Motivo da Saída Antecipada'
                        : 'Motivo detalhado'}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isOvertime
                  ? "Ex: Atendimento urgente a cliente, suporte a incidente crítico, fechamento emergencial..."
                  : isForgetfulness
                    ? "Ex: Saída realizada às 17:00, esqueci de registrar o ponto no aplicativo..."
                    : isEarlyLeave
                      ? "Ex: Consulta médica, liberação autorizada pelo gestor, imprevisto pessoal..."
                      : isEarlyEntry
                        ? "Ex: Demanda antecipada solicitada pela liderança, chegada antecipada ao posto..."
                        : isDelay
                          ? "Ex: Consulta médica, exame laboratorial, trânsito atípico..."
                          : "Ex: Consulta médica de emergência, exame laboratorial..."
              }
              className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none border ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
                  : 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
              }`}
              required
            />
          </div>

          {/* File Upload Box */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              {isTimeDeviation
                ? 'Anexar Declaração / Comprovante (Opcional)'
                : 'Anexar Documento Comprobatório (PDF, JPG, PNG)'}
            </label>
            <label className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isUploaded
                ? (isLightTheme ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-[#f89642] bg-[#f89642]/10')
                : (isLightTheme ? 'border-slate-300 bg-slate-50 hover:bg-slate-100/80 text-slate-600' : 'border-white/20 bg-white/5 hover:bg-white/10')
            }`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isUploaded ? (
                <div className={`flex items-center gap-2 text-xs font-bold ${isLightTheme ? 'text-amber-800' : 'text-[#f89642]'}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{documentName} (Pronto para envio)</span>
                </div>
              ) : (
                <div className={`flex flex-col items-center gap-1.5 text-xs ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                  <Upload className={`w-5 h-5 mb-1 ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`} />
                  <span className={`font-bold ${isLightTheme ? 'text-slate-700' : 'text-white/80'}`}>
                    Clique para selecionar o arquivo
                  </span>
                  <span className={`text-[10px] ${isLightTheme ? 'text-slate-400' : 'text-white/40'}`}>
                    {isTimeDeviation ? 'Declaração médica ou comprovante (opcional)' : 'PDF, PNG ou JPEG até 10MB'}
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Footer Actions */}
          <div className={`pt-4 flex items-center justify-end gap-3 border-t shrink-0 ${
            isLightTheme ? 'border-slate-100' : 'border-white/5'
          }`}>
            <button
              type="button"
              onClick={handleClose}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                isLightTheme
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border-transparent'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac] hover:brightness-110 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-[#96183c]/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              {editingJustification 
                ? 'Salvar Alterações' 
                : isTimeDeviation
                  ? 'Enviar Justificativa'
                  : 'Enviar Atestado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
