import React, { useState } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Employee, Shift, AbsenceJustification } from '../types';

interface JustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  shifts: Shift[];
  onSubmitJustification: (justification: Partial<AbsenceJustification>) => void;
}

export const JustificationModal: React.FC<JustificationModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  shifts,
  onSubmitJustification,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#1E1B4B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center border border-emerald-400/30">
              <FileText className="w-4 h-4 text-[#BBF7D0]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">
                Enviar Atestado / Justificar Ausência
              </h3>
              <p className="text-[10px] text-emerald-200">
                Envie comprovantes médicos ou declarações legais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-slate-800">
          {/* Shift Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
              Turno / Data da Ausência:
            </label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              required
            >
              <option value="">Selecione o turno ausente...</option>
              {shifts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.date} — {s.startTime} às {s.endTime} ({s.title || 'Turno Regular'})
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
              Motivo detalhado:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Consulta médica de emergência, exame laboratorial, convocação oficial..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
              Anexar Documento Comprobatório (PDF, JPG, PNG):
            </label>
            <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isUploaded ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isUploaded ? (
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  <span>{documentName} (Pronto para envio)</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-500 text-xs">
                  <Upload className="w-5 h-5 text-[#166534]" />
                  <span className="font-bold text-slate-700">Clique para selecionar o arquivo</span>
                  <span className="text-[10px] text-slate-400 font-mono">PDF, PNG ou JPEG até 10MB</span>
                </div>
              )}
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#166534] text-[#BBF7D0] hover:bg-emerald-800 text-xs font-bold shadow-xs transition-all"
            >
              Enviar Atestado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
