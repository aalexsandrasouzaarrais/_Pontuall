import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Sparkles, User, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Employee } from '@/types';
import { updateColaboradorAvatarSupabase } from '@/modules/auth/services/colaboradorService';
import { safeStorage } from '@/shared/utils/safeStorage';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  onUpdateAvatar: (newAvatarUrl: string) => void;
  theme?: 'light' | 'dark';
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateAvatar,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string>(currentUser.avatar);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sincroniza quando abrir
  React.useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentUser.avatar);
      setCustomUrl('');
      setSuccessMessage(null);
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, currentUser.avatar]);

  if (!isOpen) return null;

  // Upload local de arquivo (leitura e otimização para Data URL / Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limita tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('O arquivo de imagem deve ter no máximo 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPreviewUrl(result);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Salvar a nova foto
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const finalUrl = previewUrl.trim() || currentUser.avatar;

    try {
      // 1. Atualiza no Supabase na tabela TAB_Colaborador
      await updateColaboradorAvatarSupabase(currentUser.id, currentUser.email, finalUrl);

      // 2. Atualiza no safeStorage
      try {
        const storedUser = safeStorage.getItem('pontual_active_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.Des_Avatar_Url = finalUrl;
          parsed.avatar = finalUrl;
          safeStorage.setItem('pontual_active_user', JSON.stringify(parsed));
        }
      } catch {}

      // 3. Atualiza estado da aplicação
      onUpdateAvatar(finalUrl);

      setSuccessMessage('Foto de perfil atualizada com sucesso!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage('Erro ao salvar a foto de perfil. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar foto da conta Google (caso use e-mail Google Workspace)
  const handleRestoreGooglePhoto = () => {
    // Busca do metadata salvo da sessão ou gera avatar gravatar/google
    try {
      const googleSessionUser = localStorage.getItem('pontual_google_avatar');
      if (googleSessionUser) {
        setPreviewUrl(googleSessionUser);
        setErrorMessage(null);
        return;
      }
    } catch {}

    // Fallback: URL de avatar do Google pelo email se disponível
    const googlePhoto = `https://unavatar.io/google/${currentUser.email}`;
    setPreviewUrl(googlePhoto);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 font-sans border transition-colors ${
          isDark
            ? 'bg-[#12131A] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl'
        }`}
      >
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89847] to-[#faf0ac]" />

        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDark ? 'border-white/10' : 'border-slate-150 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Foto de Perfil
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Personalize sua imagem no sistema Pontual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/10'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-500 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar Preview Central */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div
                className={`w-28 h-28 rounded-full overflow-hidden ring-4 shadow-xl flex items-center justify-center transition-all duration-300 ${
                  isDark ? 'ring-[#f89847] bg-black/40' : 'ring-[#96183c] bg-white'
                }`}
              >
                <img
                  src={previewUrl}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  onError={() => {
                    setPreviewUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
                  }}
                />
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold">
                <Camera className="w-6 h-6 mb-1" />
                <span>Trocar foto</span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.email}</p>
              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f89847]/15 text-[#f89847] font-semibold border border-[#f89847]/30">
                {currentUser.registrationId || currentUser.role}
              </span>
            </div>
          </div>

          {/* Opções de Upload */}
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isDark
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4 text-[#f89847]" />
                <span>Enviar do Computador</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreGooglePhoto}
                className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isDark
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
                title="Sincronizar a foto da sua conta Google / Workspace"
              >
                <RefreshCw className="w-4 h-4 text-[#96183c]" />
                <span>Foto do Google Workspace</span>
              </button>
            </div>

            {/* Inserir link direto */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Ou cole o link direto de uma imagem:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://exemplo.com/minha-foto.jpg"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847]'
                      : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#96183c]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customUrl.trim()) {
                      setPreviewUrl(customUrl.trim());
                      setErrorMessage(null);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? 'border-white/10 bg-[#0e1017]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 cursor-pointer transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
            }}
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Foto de Perfil'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
