
import React from 'react';
import {
  X,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { NotificationItem } from '@/types';

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
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
      isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/75 backdrop-blur-sm'
    } animate-in fade-in duration-200`}>

      {/* Modal Principal (Aumentado e Mais Espaçoso) */}
      <div className={`rounded-3xl shadow-2xl w-full max-w-[620px] border overflow-hidden flex flex-col max-h-[88vh] transition-all duration-200 ${
        isLightTheme 
          ? 'bg-white border-slate-200 text-slate-800 shadow-2xl' 
          : 'bg-[#0D0E12] border-[#292C35] text-white shadow-2xl shadow-black/80'
      }`}>

        {/* Header */}
        <div className={`px-6 sm:px-7 pt-6 pb-5 border-b ${
          isLightTheme 
            ? 'bg-gradient-to-br from-slate-50 via-white to-white border-slate-200' 
            : 'bg-gradient-to-br from-[#171820] via-[#111217] to-[#111217] border-[#292C35]'
        }`}>

          <div className="flex items-start justify-between gap-4">

            <div className="flex items-center gap-4">

              {/* Ícone com gradiente */}
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#A40E3A] to-[#F47C3B] flex items-center justify-center shadow-lg shadow-red-950/25">
                <Bell className="w-6 h-6 text-white" strokeWidth={1.8} />
              </div>

              <div className="min-w-0">

                {/* Identificação do painel */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-[3px] bg-gradient-to-r from-[#E3483F] to-[#F59E0B] rounded-full" />
                  <span className={`text-[11px] font-black tracking-wider uppercase ${
                    isLightTheme ? 'text-slate-500' : 'text-[#A7AAB5]'
                  }`}>
                    Central de Alertas
                  </span>
                </div>

                {/* Título */}
                <h3 className={`text-xl sm:text-2xl font-black leading-tight tracking-tight ${
                  isLightTheme ? 'text-slate-900' : 'text-white'
                }`}>
                  Minhas{' '}
                  <span className={isLightTheme ? "bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#c98200] bg-clip-text text-transparent" : "bg-gradient-to-r from-[#F4F4F5] via-[#FBBF24] to-[#F97316] bg-clip-text text-transparent"}>
                    Notificações
                  </span>
                </h3>

                <p className={`text-xs sm:text-[13px] mt-1 leading-relaxed ${
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
              className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                isLightTheme
                  ? 'border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  : 'border-[#292C35] bg-[#0A0B0E] text-[#7F8798] hover:text-white hover:border-[#555B6A]'
              }`}
            >
              <X className="w-5 h-5" strokeWidth={1.8} />
            </button>

          </div>

        </div>

        {/* Barra de Ações */}
        <div className={`px-6 sm:px-7 py-3 border-b flex items-center justify-between ${
          isLightTheme ? 'bg-slate-50/80 border-slate-200' : 'bg-[#0C0D10] border-[#292C35]'
        }`}>

          {/* Contagem de notificações */}
          <div className={`px-3.5 py-1.5 rounded-full border ${
            isLightTheme ? 'border-amber-200 bg-amber-50' : 'border-[#5B321D] bg-[#241910]'
          }`}>
            <span className={`text-xs font-bold tracking-wide ${
              isLightTheme ? 'text-amber-800' : 'text-[#F59E45]'
            }`}>
              {notifications.length} {notifications.length === 1 ? 'aviso' : 'avisos'}
            </span>
          </div>

          {/* Marcar como lidas */}
          <button
            onClick={onMarkAllAsRead}
            className={`text-xs sm:text-[13px] font-bold transition-colors cursor-pointer hover:underline ${
              isLightTheme ? 'text-[#96183c] hover:text-[#f89642]' : 'text-[#F47B3B] hover:text-[#FDBA74]'
            }`}
          >
            Marcar todas como lidas
          </button>

        </div>

        {/* Lista de Notificações */}
        <div className={`p-5 sm:p-6 overflow-y-auto space-y-3.5 flex-1 ${
          isLightTheme ? 'bg-slate-50/50' : 'bg-[#0D0E12]'
        }`}>

          {notifications.length === 0 ? (

            <div className={`text-center py-16 text-sm sm:text-base ${isLightTheme ? 'text-slate-400' : 'text-[#656B7A]'}`}>
              Nenhuma notificação no momento.
            </div>

          ) : (

            notifications.map((n) => (

              <div
                key={n.id}
                className={`relative p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                  n.read
                    ? (isLightTheme ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300' : 'bg-[#15161C] border-[#292C35] hover:border-white/10')
                    : (isLightTheme ? 'bg-gradient-to-br from-rose-50/70 via-white to-amber-50/40 border-rose-200 shadow-xs hover:border-rose-300' : 'bg-gradient-to-br from-[#30171F] via-[#25171E] to-[#2B211D] border-[#73452F] shadow-lg shadow-black/20')
                }`}
              >

                {/* Barra lateral da notificação não lida */}
                {!n.read && (
                  <div className="absolute left-0 top-3.5 bottom-3.5 w-1 rounded-r-full bg-gradient-to-b from-[#F43F5E] to-[#9F1239]" />
                )}

                <div className="flex items-start gap-3.5">

                  {/* Ícone da Notificação */}
                  <div
                    className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border ${
                      n.read
                        ? (isLightTheme ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#0C0E13] border-[#292E3A] text-[#7B8DA8]')
                        : (isLightTheme ? 'bg-rose-100/70 border-rose-200 text-[#96183c]' : 'bg-[#54281E] border-[#914623] text-[#F47B3B]')
                    }`}
                  >

                    {n.read ? (
                      <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
                    ) : (
                      <Bell className="w-5 h-5" strokeWidth={1.8} />
                    )}

                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">

                    <div className="flex items-start justify-between gap-2.5">

                      <h4 className={`font-extrabold text-sm sm:text-base leading-snug ${
                        isLightTheme ? (n.read ? 'text-slate-800' : 'text-slate-900') : '#F1F1F3'
                      }`}>
                        {n.title}
                      </h4>

                      <span className={`text-[11px] sm:text-xs font-mono whitespace-nowrap pt-0.5 ${
                        isLightTheme ? 'text-slate-400' : 'text-[#8591A5]'
                      }`}>
                        {n.timestamp}
                      </span>

                    </div>

                    {/* Indicador de não lida */}
                    {!n.read && (
                      <div className="flex items-center gap-1.5 mt-1.5">

                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />

                        <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                          isLightTheme ? 'text-rose-700' : 'text-[#F59E0B]'
                        }`}>
                          Nova
                        </span>

                      </div>
                    )}

                    <p className={`text-xs sm:text-[13px] leading-relaxed mt-2 ${
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
        <div className={`px-6 sm:px-7 py-4 border-t flex items-center justify-between gap-3 ${
          isLightTheme ? 'bg-white border-slate-200' : 'bg-[#0C0D10] border-[#292C35]'
        }`}>

          {/* Status de sincronização */}
          <div className="flex items-center gap-2.5">

            <div className="w-3.5 h-3.5 rounded-full border border-[#10B981] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            </div>

            <span className={`text-xs sm:text-[13px] font-medium ${isLightTheme ? 'text-slate-500' : 'text-[#7B8495]'}`}>
              Sincronização em tempo real ativa
            </span>

          </div>

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#990D36] to-[#F47B3B] text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-950/20 hover:brightness-110 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Fechar
          </button>

        </div>

      </div>

    </div>
  );
};
