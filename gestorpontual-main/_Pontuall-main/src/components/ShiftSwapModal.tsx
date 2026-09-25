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
  isLightTheme?: boolean;
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  employees,
  myShifts,
  onSubmitRequest,
  isLightTheme = false,
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
        {/* Top Highlight Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]"></div>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${
          isLightTheme ? 'border-slate-100 bg-slate-50/60' : 'border-white/5 bg-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96183C] to-[#F89847] flex items-center justify-center shadow-lg shadow-[#96183C]/20">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                Solicitação de Folga ou Troca
              </h3>
              <p className={`text-[11px] mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-white/50'}`}>
                Envie seu pedido para aprovação do gestor
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
          {/* Request Type Selector */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              Tipo de Solicitação
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRequestType('swap')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  requestType === 'swap'
                    ? (isLightTheme
                        ? 'bg-[#96183C]/10 text-[#96183C] border-[#96183C]/40 shadow-xs ring-1 ring-[#96183C]/20 font-bold'
                        : 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] border-[#F89847]/40 shadow-inner')
                    : (isLightTheme
                        ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white')
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" /> Troca com Colega
              </button>

              <button
                type="button"
                onClick={() => setRequestType('time_off')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  requestType === 'time_off'
                    ? (isLightTheme
                        ? 'bg-[#96183C]/10 text-[#96183C] border-[#96183C]/40 shadow-xs ring-1 ring-[#96183C]/20 font-bold'
                        : 'bg-gradient-to-br from-[#96183C]/20 to-[#F89847]/10 text-[#F89847] border-[#F89847]/40 shadow-inner')
                    : (isLightTheme
                        ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white')
                }`}
              >
                <Calendar className="w-4 h-4" /> Folga Compensatória
              </button>
            </div>
          </div>

          {requestType === 'swap' ? (
            <>
              {/* Select My Shift to Swap */}
              <div>
                <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                  isLightTheme ? 'text-slate-600' : 'text-white/60'
                }`}>
                  Meu Turno a Ser Trocado
                </label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors appearance-none focus:outline-none border ${
                    isLightTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183C] focus:ring-1 focus:ring-[#96183C]'
                      : 'bg-white/5 border-white/10 text-white focus:border-[#F89847] focus:ring-1 focus:ring-[#F89847]'
                  }`}
                  required
                >
                  <option value="" className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}>
                    Selecione um turno da sua escala...
                  </option>
                  {myShifts.map(s => (
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

              {/* Target Employee */}
              <div>
                <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                  isLightTheme ? 'text-slate-600' : 'text-white/60'
                }`}>
                  Colega que assumirá o turno
                </label>
                <select
                  value={targetEmployeeId}
                  onChange={(e) => setTargetEmployeeId(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors appearance-none focus:outline-none border ${
                    isLightTheme
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183C] focus:ring-1 focus:ring-[#96183C]'
                      : 'bg-white/5 border-white/10 text-white focus:border-[#F89847] focus:ring-1 focus:ring-[#F89847]'
                  }`}
                  required
                >
                  <option value="" className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}>
                    Selecione o colega...
                  </option>
                  {otherEmployees.map(emp => (
                    <option
                      key={emp.id}
                      value={emp.id}
                      className={isLightTheme ? 'bg-white text-slate-900' : 'bg-[#1a0010] text-white'}
                    >
                      {emp.name} — {emp.role} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                isLightTheme ? 'text-slate-600' : 'text-white/60'
              }`}>
                Data Desejada para Folga
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none border ${
                  isLightTheme
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#96183C] focus:ring-1 focus:ring-[#96183C]'
                    : 'bg-white/5 border-white/10 text-white focus:border-[#F89847] focus:ring-1 focus:ring-[#F89847]'
                }`}
                style={{ colorScheme: isLightTheme ? 'light' : 'dark' }}
                required
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-2 ${
              isLightTheme ? 'text-slate-600' : 'text-white/60'
            }`}>
              Motivo da Solicitação
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva brevemente o motivo para análise..."
              className={`w-full rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none border ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#96183C] focus:ring-1 focus:ring-[#96183C]'
                  : 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[#F89847] focus:ring-1 focus:ring-[#F89847]'
              }`}
              required
            />
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB] hover:brightness-110 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-[#96183C]/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              Confirmar Solicitação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
