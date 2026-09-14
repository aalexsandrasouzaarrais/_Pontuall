import React from 'react';
import { X, Bell, CheckCircle2, Clock, Calendar, ArrowLeftRight, FileText } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#1E1B4B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#BBF7D0]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">Minhas Notificações</h3>
              <p className="text-[10px] text-emerald-200">Avisos da escala e comunicados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Header */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">{notifications.length} avisos</span>
          <button
            onClick={onMarkAllAsRead}
            className="text-[11px] font-bold text-[#166534] hover:text-emerald-900"
          >
            Marcar todas como lidas
          </button>
        </div>

        {/* List */}
        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nenhuma notificação no momento.
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border text-xs transition-all ${
                  n.read ? 'bg-white border-slate-200' : 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-slate-900 text-xs">{n.title}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#166534] text-[#BBF7D0] hover:bg-emerald-800 text-xs font-bold rounded-lg shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
