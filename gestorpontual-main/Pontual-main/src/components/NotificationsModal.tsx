
import React from 'react';
import {
  X,
  Bell,
  CheckCircle2,
  Clock,
  Calendar,
  ArrowLeftRight,
  FileText,
  CircleCheck,
  Radio,
} from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  isLightTheme?: boolean;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  isLightTheme = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/70 backdrop-blur-sm'} animate-in fade-in duration-200`}>

      {/* Modal Principal */}
      <div className={`rounded-[20px] shadow-2xl w-full max-w-[472px] border overflow-hidden flex flex-col max-h-[85vh] transition-colors ${
        isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0D0E12] border-[#292C35] text-white'
      }`}>

        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b ${
          isLightTheme ? 'bg-gradient-to-br from-slate-50 via-white to-white border-slate-200' : 'bg-gradient-to-br from-[#171820] via-[#111217] to-[#111217] border-[#292C35]'
        }`}>

          <div className="flex items-start justify-between gap-3">

            <div className="flex items-center gap-3">

              {/* Ícone com gradiente */}
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#A40E3A] to-[#F47C3B] flex items-center justify-center shadow-lg shadow-red-950/30">
                <Bell className="w-[19px] h-[19px] text-white" strokeWidth={1.8} />
              </div>

              <div className="min-w-0">

                {/* Identificação do painel */}
                <div className="flex items-center gap-2 mb-1">

                  <div className="w-4 h-[2px] bg-gradient-to-r from-[#E3483F] to-[#F59E0B] rounded-full" />

                  <span className={`text-[8px] font-bold tracking-wide uppercase ${
                    isLightTheme ? 'text-slate-500' : 'text-[#A7AAB5]'
                  }`}>
                    Central de Alertas
                  </span>

                </div>

                {/* Título */}
                <h3 className={`text-[16px] sm:text-[17px] font-extrabold leading-tight tracking-tight ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}>
                  Minhas{' '}
                  <span className={isLightTheme ? "bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent" : "bg-gradient-to-r from-[#F4F4F5] via-[#FBBF24] to-[#F97316] bg-clip-text text-transparent"}>
                    Notificações
                  </span>
                </h3>

                <p className={`text-[9px] mt-0.5 leading-relaxed ${
                  isLightTheme ? 'text-slate-500' : 'text-[#A3A6B2]'
                }`}>
                  Avisos, atualizações de escala e comunicados operacionais.
                </p>

              </div>

            </div>

            {/* Botão Fechar */}
            <button
              onClick={onClose}
              aria-label="Fechar notificações"
              className={`shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isLightTheme
                  ? 'border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  : 'border-[#292C35] bg-[#0A0B0E] text-[#7F8798] hover:text-white hover:border-[#555B6A]'
              }`}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

          </div>

        </div>

        {/* Barra de Ações */}
        <div className={`px-5 py-2.5 border-b flex items-center justify-between ${
          isLightTheme ? 'bg-slate-50/80 border-slate-200' : 'bg-[#0C0D10] border-[#292C35]'
        }`}>

          {/* Contagem de notificações */}
          <div className={`px-3 py-1 rounded-full border ${
            isLightTheme ? 'border-amber-200 bg-amber-50' : 'border-[#5B321D] bg-[#241910]'
          }`}>
            <span className={`text-[9px] font-bold tracking-wide ${
              isLightTheme ? 'text-amber-800' : 'text-[#F59E45]'
            }`}>
              {notifications.length} avisos
            </span>
          </div>

          {/* Marcar como lidas */}
          <button
            onClick={onMarkAllAsRead}
            className={`text-[10px] font-bold transition-colors cursor-pointer ${
              isLightTheme ? 'text-[#96183c] hover:text-[#f89642]' : 'text-[#F47B3B] hover:text-[#FDBA74]'
            }`}
          >
            Marcar todas como lidas
          </button>

        </div>

        {/* Lista de Notificações */}
        <div className={`p-4 overflow-y-auto space-y-2.5 flex-1 ${
          isLightTheme ? 'bg-slate-50/50' : 'bg-[#0D0E12]'
        }`}>

          {notifications.length === 0 ? (

            <div className={`text-center py-12 text-xs ${isLightTheme ? 'text-slate-400' : 'text-[#656B7A]'}`}>
              Nenhuma notificação no momento.
            </div>

          ) : (

            notifications.map((n) => (

              <div
                key={n.id}
                className={`relative p-3.5 rounded-[15px] border transition-all duration-200 ${
                  n.read
                    ? (isLightTheme ? 'bg-white border-slate-200 shadow-2xs' : 'bg-[#15161C] border-[#292C35]')
                    : (isLightTheme ? 'bg-gradient-to-br from-rose-50/80 via-white to-amber-50/50 border-rose-200/80 shadow-xs' : 'bg-gradient-to-br from-[#30171F] via-[#25171E] to-[#2B211D] border-[#73452F] shadow-lg shadow-black/10')
                }`}
              >

                {/* Barra lateral da notificação não lida */}
                {!n.read && (
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-[#F43F5E] to-[#9F1239]" />
                )}

                <div className="flex items-start gap-3">

                  {/* Ícone da Notificação */}
                  <div
                    className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                      n.read
                        ? (isLightTheme ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#0C0E13] border-[#292E3A] text-[#7B8DA8]')
                        : (isLightTheme ? 'bg-rose-100/70 border-rose-200 text-[#96183c]' : 'bg-[#54281E] border-[#914623] text-[#F47B3B]')
                    }`}
                  >

                    {n.read ? (
                      <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Bell className="w-4 h-4" strokeWidth={1.5} />
                    )}

                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">

                    <div className="flex items-start justify-between gap-2">

                      <h4 className={`font-extrabold text-[11px] leading-relaxed ${
                        isLightTheme ? (n.read ? 'text-slate-800' : 'text-slate-900') : '#F1F1F3'
                      }`}>
                        {n.title}
                      </h4>

                      <span className={`text-[8px] font-mono whitespace-nowrap pt-0.5 ${
                        isLightTheme ? 'text-slate-400' : 'text-[#68748A]'
                      }`}>
                        {n.timestamp}
                      </span>

                    </div>

                    {/* Indicador de não lida */}
                    {!n.read && (
                      <div className="flex items-center gap-1.5 mt-1">

                        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />

                        <span className={`text-[8px] font-bold uppercase ${
                          isLightTheme ? 'text-rose-700' : 'text-[#F59E0B]'
                        }`}>
                          Nova
                        </span>

                      </div>
                    )}

                    <p className={`text-[10px] leading-[1.7] mt-2 ${
                      isLightTheme ? (n.read ? 'text-slate-600' : 'text-slate-700 font-medium') : 'text-[#C4C5CC]'
                    }`}>
                      {n.message}
                    </p>

                  </div>

                </div>

              </div>

            ))

          )}

        </div>

        {/* Footer */}
        <div className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 ${
          isLightTheme ? 'bg-white border-slate-200' : 'bg-[#0C0D10] border-[#292C35]'
        }`}>

          {/* Status de sincronização */}
          <div className="flex items-center gap-2">

            <div className="w-3 h-3 rounded-full border border-[#10B981] flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-[#10B981]" />
            </div>

            <span className={`text-[8px] ${isLightTheme ? 'text-slate-500' : 'text-[#7B8495]'}`}>
              Sincronização em tempo real ativa
            </span>

          </div>

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[#990D36] to-[#F47B3B] text-white text-[10px] font-extrabold shadow-lg shadow-red-950/20 hover:brightness-110 transition-all cursor-pointer"
          >
            Fechar
          </button>

        </div>

      </div>

    </div>
  );
};
