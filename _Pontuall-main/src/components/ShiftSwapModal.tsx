import React, { useState } from 'react';
import { X, ArrowLeftRight, Calendar, User, MessageSquare } from 'lucide-react';
import { Employee, Shift, TimeOffRequest } from '../types';

interface ShiftSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  employees: Employee[];
  myShifts: Shift[];
  onSubmitRequest: (request: Partial<TimeOffRequest>) => void;
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  employees,
  myShifts,
  onSubmitRequest,
}) => {
  const [requestType, setRequestType] = useState<'swap' | 'time_off'>('swap');
  const [selectedShiftId, setSelectedShiftId] = useState(myShifts[0]?.id || '');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const targetEmp = employees.find(e => e.id === targetEmployeeId);

    onSubmitRequest({
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeAvatar: currentEmployee.avatar,
      type: requestType,
      shiftId: requestType === 'swap' ? selectedShiftId : undefined,
      targetEmployeeId: requestType === 'swap' ? targetEmployeeId : undefined,
      targetEmployeeName: requestType === 'swap' ? targetEmp?.name : undefined,
      date: requestType === 'time_off' ? targetDate : (myShifts.find(s => s.id === selectedShiftId)?.date || targetDate),
      reason,
      status: 'pending',
    });

    onClose();
  };

  const otherEmployees = employees.filter(e => e.id !== currentEmployee.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#1E1B4B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center border border-emerald-400/30">
              <ArrowLeftRight className="w-4 h-4 text-[#BBF7D0]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">
                Solicitação de Folga ou Troca de Turno
              </h3>
              <p className="text-[10px] text-emerald-200">
                Envie seu pedido para aprovação do gestor
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
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-slate-800">
          {/* Request Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 font-mono">
              Tipo de Solicitação:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequestType('swap')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  requestType === 'swap'
                    ? 'bg-[#166534] text-[#BBF7D0] border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Troca com Colega
              </button>

              <button
                type="button"
                onClick={() => setRequestType('time_off')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  requestType === 'time_off'
                    ? 'bg-[#166534] text-[#BBF7D0] border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Folga Compensatória
              </button>
            </div>
          </div>

          {requestType === 'swap' ? (
            <>
              {/* Select My Shift to Swap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
                  Meu Turno a Ser Trocado:
                </label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                >
                  <option value="">Selecione um turno da sua escala...</option>
                  {myShifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.date} — {s.startTime} às {s.endTime} ({s.title || 'Turno Regular'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Employee */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
                  Colega que assumirá o turno:
                </label>
                <select
                  value={targetEmployeeId}
                  onChange={(e) => setTargetEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                >
                  <option value="">Selecione o colega...</option>
                  {otherEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.role} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
                Data Desejada para Folga:
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                required
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 font-mono">
              Motivo da Solicitação:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva brevemente o motivo para análise do gestor..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              required
            />
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
              Enviar Solicitação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
