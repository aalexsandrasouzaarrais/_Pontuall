import React, { useState } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { useTheme } from '@/shared/context/ThemeContext';
import { usePwaInstall } from '@/shared/hooks/usePwaInstall';

export const PwaInstallBanner: React.FC = () => {
  const { isDark } = useTheme();
  const {
    shouldShowBanner,
    canPromptInstall,
    isIos,
    isIosNonSafari,
    isInstalling,
    install,
    dismiss,
  } = usePwaInstall();

  const [showIosGuide, setShowIosGuide] = useState(false);

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <aside
      aria-label="Instalar aplicativo Pontual"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[370px] z-[90]"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className={`rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-colors ${
          isDark
            ? 'bg-[#15161b]/95 border-[#282a33] text-white shadow-black/60'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/15'
        }`}
      >
        <div className="flex items-start gap-3">
          <img
            src="/icons/pwa-192x192.png"
            alt="Pontual"
            className={`w-11 h-11 rounded-xl shrink-0 border object-cover ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">
                  Instalar app Pontual
                </p>
                <p
                  className={`text-xs mt-0.5 leading-snug ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Acesso rápido direto da tela inicial
                </p>
              </div>

              <button
                type="button"
                onClick={dismiss}
                aria-label="Fechar aviso de instalação"
                className={`p-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              {canPromptInstall ? (
                <button
                  type="button"
                  onClick={install}
                  disabled={isInstalling}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isInstalling ? 'Instalando...' : 'Baixar App'}</span>
                </button>
              ) : isIos ? (
                <button
                  type="button"
                  onClick={() => setShowIosGuide((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#640C1E] via-[#9F243C] to-[#F59242] hover:brightness-110 active:scale-[0.98] transition-all shadow-md cursor-pointer"
                >
                  <Share className="w-3.5 h-3.5" />
                  <span>{showIosGuide ? 'Ocultar passo a passo' : 'Como instalar'}</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={dismiss}
                className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>

        {isIos && !canPromptInstall && showIosGuide && (
          <div
            className={`mt-3 pt-3 border-t text-xs space-y-2 ${
              isDark
                ? 'border-white/10 text-slate-300'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            {isIosNonSafari && (
              <p
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg ${
                  isDark
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                No iPhone/iPad, abra este link no <strong>Safari</strong> para instalar na tela inicial.
              </p>
            )}

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#9F243C]/20 text-[#F59242] shrink-0">
                <Share className="w-3.5 h-3.5" />
              </span>
              <span>
                1. Toque no botão <strong>Compartilhar</strong> na barra do navegador.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#9F243C]/20 text-[#F59242] shrink-0">
                <PlusSquare className="w-3.5 h-3.5" />
              </span>
              <span>
                2. Escolha <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong> e toque em{' '}
                <strong>Adicionar</strong>.
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
