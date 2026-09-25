import React, { useState } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Employee, Shift, AbsenceJustification } from '../types';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  shifts: Shift[];
  onSubmitJustification: (justification: Partial<AbsenceJustification>) => void;
  isLightTheme?: boolean;
}

export const JustificationModal: React.FC<JustificationModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  shifts,
  onSubmitJustification,
  isLightTheme = false,
}) => {
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || '');
  const [reason, setReason] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [isUploaded, setIsUploaded] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentName(file.name);
      setIsUploaded(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const chosenShift = shifts.find(s => s.id === selectedShiftId);

    onSubmitJustification({
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeAvatar: currentEmployee.avatar,
      shiftId: selectedShiftId,
      date: chosenShift?.date || new Date().toISOString().split('T')[0],
      reason,
      documentName: documentName || 'Atestado_Medico_Anexo.pdf',
      documentType: 'application/pdf',
      status: 'pending',
    });

    onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/70 backdrop-blur-md'} animate-in fade-in duration-200`}>
      <div 
        className={`relative rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col transition-colors ${
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
                background: 'linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)',
                border: '1px solid rgba(150,24,60,0.4)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)'
              }
        }
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#faf0ac]"></div>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${
          isLightTheme ? 'border-slate-100 bg-slate-50/60' : 'border-white/5 bg-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96183c] to-[#f89642] flex items-center justify-center shadow-lg shadow-[#96183c]/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                Enviar Atestado / Justificar Ausência
              </h3>
              <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                Envie comprovantes médicos ou declarações legais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLightTheme
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className={`p-5 space-y-4 ${isLightTheme ? 'text-slate-800' : 'text-white'}`}>
          {/* Shift Selection */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              Turno / Data da Ausência
            </label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors appearance-none focus:outline-none border ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
                  : 'bg-white/5 border-white/10 text-white focus:border-[#f89642] focus:ring-1 focus:ring-[#f89642]'
              }`}
              required
            >
              <option value="" className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}>
                Selecione o turno ausente...
              </option>
              {shifts.map(s => (
                <option
                  key={s.id}
                  value={s.id}
                  className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}
                >
                  {s.date} — {s.startTime} às {s.endTime} ({s.title || 'Turno Regular'})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              Motivo detalhado
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Consulta médica de emergência, exame laboratorial..."
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
              Anexar Documento Comprobatório (PDF, JPG, PNG)
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
                    PDF, PNG ou JPEG até 10MB
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Footer Actions */}
          <div className={`pt-4 flex items-center justify-end gap-3 border-t ${
            isLightTheme ? 'border-slate-100' : 'border-white/5'
          }`}>
            <button
              type="button"
              onClick={onClose}
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
              Enviar Atestado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
