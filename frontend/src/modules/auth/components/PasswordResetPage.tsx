import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sun, Moon, ArrowLeft } from 'lucide-react';
import { updateColaboradorPasswordSupabase } from '../services/colaboradorService';
import { supabase } from '@/shared/services/supabase';
import { useTheme } from '@/shared/context/ThemeContext';
import logoWideDark from '@/assets/logo-pontual-wide-dark.png';
import logoWideLight from '@/assets/logo-pontual-wide.png';

interface PasswordResetPageProps {
  matriculaInicial?: string;
  onSuccess: (colaboradorData?: any) => void;
  onBackToLogin?: () => void;
}

export const PasswordResetPage: React.FC<PasswordResetPageProps> = ({
  matriculaInicial = '',
  onSuccess,
  onBackToLogin,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const [matricula, setMatricula] = useState(matriculaInicial);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlMatricula = params.get('matricula') || params.get('id');
      if (urlMatricula) {
        setMatricula(urlMatricula.toUpperCase());
      } else if (matriculaInicial) {
        setMatricula(matriculaInicial.toUpperCase());
      }
    }
  }, [matriculaInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanMatricula = matricula.trim();
    if (!cleanMatricula) {
      setFeedback({ message: 'Por favor, informe sua matrícula ou ID de colaborador.', type: 'error' });
      return;
    }

    if (novaSenha.length < 6) {
      setFeedback({ message: 'A nova senha deve ter no mínimo 6 caracteres.', type: 'error' });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setFeedback({ message: 'A confirmação de senha não coincide com a nova senha digitada.', type: 'error' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Atualiza a senha no Supabase
      const ok = await updateColaboradorPasswordSupabase(cleanMatricula, novaSenha);

      if (ok) {
        // 2. Busca os dados do colaborador atualizado
        let colaboradorObj = null;
        try {
          const { data } = await supabase
            .from('TAB_Colaborador')
            .select('*')
            .eq('Cod_Matricula', cleanMatricula)
            .maybeSingle();

          if (data) {
            colaboradorObj = data;
            try {
              localStorage.setItem('pontual_role', 'employee');
              localStorage.setItem('pontual_active_user', JSON.stringify(data));
            } catch {}
          }
        } catch {}

        setFeedback({
          message: 'Senha definida com sucesso! Redirecionando para o seu portal...',
          type: 'success'
        });

        setTimeout(() => {
          onSuccess(colaboradorObj);
        }, 1200);
      } else {
        setFeedback({
          message: 'Não foi possível atualizar a senha. Verifique a matrícula informada e tente novamente.',
          type: 'error'
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      setFeedback({
        message: err.message || 'Ocorreu um erro ao processar a nova senha. Tente novamente.',
        type: 'error'
      });
      setIsLoading(false);
    }
  };

  const isMatching = confirmarSenha && novaSenha === confirmarSenha;
  const isTooShort = novaSenha && novaSenha.length < 6;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 relative overflow-hidden ${
      isDark ? 'bg-[#0B0B0E] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
    }`}>
      {/* Background Decorative Glow Elements */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ background: 'radial-gradient(circle, #96183c, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #f89847, transparent 70%)' }}
      />

      {/* Header Bar */}
      <header className={`backdrop-blur-xl border-b px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 transition-colors ${
        isDark ? 'bg-[#0D0F15]/90 border-[#222634]/80' : 'bg-white/90 border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <img
            src={!isDark ? logoWideDark : logoWideLight}
            alt="Pontual"
            className="h-7 w-auto object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="${!isDark ? 'text-slate-900' : 'text-white'} font-extrabold text-base tracking-tight">Pontual</span>`;
              }
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              !isDark
                ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'border-[#252A3A] bg-[#151822] text-slate-300 hover:text-white'
            }`}
            title="Alternar Tema"
          >
            {!isDark ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className={`relative rounded-3xl overflow-hidden shadow-2xl border transition-all duration-200 ${
            isDark
              ? 'bg-[#12131A] border-white/10 shadow-black/70'
              : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'
          }`}>
            {/* Top Accent Gradient Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89847] to-[#faf0ac]" />

            <div className="p-7 sm:p-8 space-y-6">
              {/* Header inside Card */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  <KeyRound className="w-6 h-6 text-white stroke-[2.2]" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight">Definir Nova Senha</h1>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Primeiro acesso e ativação da sua conta
                  </p>
                </div>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div className={`p-3.5 rounded-2xl flex items-center gap-3 text-xs leading-relaxed animate-in fade-in duration-150 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4.5">
                <div>
                  <label className={`text-xs font-semibold mb-1.5 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Matrícula / ID do Colaborador
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                    placeholder="Ex: PNT-1647"
                    required
                    className={`w-full px-4 py-3 rounded-xl text-sm font-mono tracking-wide outline-none transition-all border ${
                      isDark
                        ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-semibold mb-1.5 flex items-center justify-between ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    <span>Nova Senha Definitiva</span>
                    {isTooShort && (
                      <span className="text-[11px] text-amber-400 font-normal">Mínimo 6 caracteres</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Digite sua nova senha"
                      required
                      className={`w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`text-xs font-semibold mb-1.5 flex items-center justify-between ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    <span>Confirmar Nova Senha</span>
                    {confirmarSenha && (
                      <span className={`text-[11px] font-medium ${isMatching ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isMatching ? '✓ Senhas coincidem' : '✕ Não coincide'}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                      className={`w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all border ${
                        confirmarSenha && !isMatching
                          ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : isDark
                          ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      title={showConfirm ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-xl shadow-[#96183c]/20 hover:shadow-[#96183c]/35 transition-all flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  {isLoading ? (
                    <span>Salvando Nova Senha...</span>
                  ) : (
                    <>
                      <span>Salvar Nova Senha e Entrar</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer link: Voltar ao Login */}
              {onBackToLogin && (
                <div className="pt-2 text-center border-t border-white/5">
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className={`inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para o Login</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-4 text-center text-[11px] border-t transition-colors ${
        isDark ? 'border-white/5 text-slate-500' : 'border-slate-200 text-slate-400'
      }`}>
        Pontual Gestão de Escalas & Pontos • Todos os direitos reservados
      </footer>
    </div>
  );
};
