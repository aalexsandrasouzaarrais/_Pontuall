import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Check, 
  User, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Building2, 
  Clock, 
  Briefcase, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Employee } from '@/types';
import { updateColaboradorAvatarSupabase } from '@/modules/auth/services/colaboradorService';
import { safeStorage } from '@/shared/utils/safeStorage';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee;
  employees?: Employee[];
  onUpdateAvatar: (newAvatarUrl: string) => void;
  theme?: 'light' | 'dark';
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  employees = [],
  onUpdateAvatar,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string>(currentUser.avatar);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Procura o gestor responsável do colaborador
  const manager = useMemo(() => {
    if (!employees || employees.length === 0) return null;

    // 1. Pelos IDs de gestores vinculados (managerIds)
    if (currentUser.managerIds && currentUser.managerIds.length > 0) {
      const found = employees.find(e => currentUser.managerIds?.includes(e.id));
      if (found) return found;
    }

    // 2. Por managerId legado
    if ((currentUser as any).managerId) {
      const found = employees.find(e => e.id === (currentUser as any).managerId);
      if (found) return found;
    }

    // 3. Se houver gestor do mesmo departamento
    const deptManager = employees.find(e => 
      e.id !== currentUser.id &&
      e.department?.toLowerCase() === currentUser.department?.toLowerCase() &&
      (e.roleType === 'gestor' || e.role.toLowerCase().includes('gestor') || e.role.toLowerCase().includes('gerente'))
    );
    if (deptManager) return deptManager;

    // 4. Se for colaborador comum e houver algum gestor ativo no sistema
    if (currentUser.roleType === 'colaborador') {
      const genericManager = employees.find(e => 
        e.id !== currentUser.id && 
        (e.roleType === 'gestor' || e.isMasterManager || e.isRh || e.role.toLowerCase().includes('gestor') || e.role.toLowerCase().includes('gerente'))
      );
      if (genericManager) return genericManager;
    }

    return null;
  }, [currentUser, employees]);

  const isUserLideranca = currentUser.roleType === 'gestor' || currentUser.isRh || currentUser.roleType === 'rh' || currentUser.isMasterManager;

  // Sincroniza quando abrir
  React.useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentUser.avatar);
      setCustomUrl('');
      setSuccessMessage(null);
      setErrorMessage(null);
      setIsSaving(false);
      setShowPhotoOptions(false);
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
        setShowPhotoOptions(false);
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage('Erro ao salvar a foto de perfil. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar foto da conta Google (caso use e-mail Google Workspace)
  const handleRestoreGooglePhoto = () => {
    try {
      const googleSessionUser = localStorage.getItem('pontual_google_avatar');
      if (googleSessionUser) {
        setPreviewUrl(googleSessionUser);
        setErrorMessage(null);
        return;
      }
    } catch {}

    const googlePhoto = `https://unavatar.io/google/${currentUser.email}`;
    setPreviewUrl(googlePhoto);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 font-sans border transition-colors ${
          isDark
            ? 'bg-[#12131A] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl'
        }`}
      >
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89847] to-[#faf0ac] shrink-0" />

        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${
            isDark ? 'border-white/10' : 'border-slate-150 bg-slate-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Perfil do Colaborador
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Informações cadastrais, liderança direta e foto
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Fechar modal"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              isDark
                ? 'border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                : 'border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-500 animate-in fade-in duration-150 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold animate-in fade-in duration-150 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">

          {/* 1. Card Superior: Identificação e Foto do Colaborador */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 transition-all ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Avatar com ação de foto */}
            <div className="relative group shrink-0">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ring-4 shadow-lg flex items-center justify-center ${
                  isDark ? 'ring-[#f89847]/40 bg-black/40' : 'ring-[#96183c]/30 bg-white'
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

              <button
                type="button"
                onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-gradient-to-r from-[#96183c] to-[#f89847] text-white shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Alterar imagem de perfil"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Informações Centrais do Colaborador */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className={`text-base sm:text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.name}
                </h3>

                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  isUserLideranca
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                    : 'bg-[#96183c]/15 border-[#96183c]/30 text-[#96183c] dark:text-rose-400'
                }`}>
                  {currentUser.roleType === 'rh' ? 'RH Admin' : currentUser.roleType === 'gestor' ? 'Gestor' : 'Colaborador'}
                </span>
              </div>

              <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {currentUser.role} • {currentUser.department}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs">
                <span className={`inline-flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Mail className="w-3.5 h-3.5 text-[#f89847]" />
                  <span className="font-mono text-[11px]">{currentUser.email || 'Não informado'}</span>
                </span>

                {currentUser.phone && (
                  <span className={`inline-flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-mono text-[11px]">{currentUser.phone}</span>
                  </span>
                )}
              </div>

              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                  className={`text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:underline ${
                    isDark ? 'text-[#f89847]' : 'text-[#96183c]'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{showPhotoOptions ? 'Ocultar opções de foto' : 'Trocar foto de perfil'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Opções Expansíveis de Foto */}
          {showPhotoOptions && (
            <div className={`p-4 rounded-2xl border space-y-3.5 animate-in slide-in-from-top-2 duration-150 ${
              isDark ? 'bg-black/30 border-white/10' : 'bg-slate-100/60 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  Escolher Nova Imagem:
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Formatos JPG, PNG ou WebP (máx 5MB)
                </span>
              </div>

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
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isDark
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4 text-[#f89847]" />
                  <span>Enviar do Computador</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreGooglePhoto}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isDark
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                  title="Sincronizar a foto da sua conta Google / Workspace"
                >
                  <RefreshCw className="w-4 h-4 text-[#96183c]" />
                  <span>Foto do Google Workspace</span>
                </button>
              </div>

              {/* Inserir link direto */}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Ou cole o link direto de uma imagem..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847]'
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#96183c]'
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Aplicar
                </button>
              </div>

              {/* Botão de Salvar Foto se houver alteração */}
              {previewUrl !== currentUser.avatar && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 cursor-pointer transition-all hover:opacity-95 active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)' }}
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Salvando Foto...' : 'Confirmar e Salvar Foto'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. DESTAQUE PRINCIPAL: QUEM É O GESTOR DESTE COLABORADOR */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#f89847]" />
                <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Liderança & Gestão Responsável
                </h4>
              </div>
              <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Hierarquia Direta
              </span>
            </div>

            {isUserLideranca ? (
              /* Caso o próprio usuário ativo seja um Gestor ou RH */
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  isDark
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs sm:text-sm">
                      Você possui perfil de Gestão / Liderança
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40">
                      {currentUser.roleType === 'rh' ? 'RH Administrador' : 'Gestor de Setor'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-800'}`}>
                    Você é responsável pela aprovação de escalas, pontos e solicitações da sua equipe. Colaboradores do seu setor reportam diretamente a você.
                  </p>
                </div>
              </div>
            ) : manager ? (
              /* Colaborador com Gestor Vinculado */
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-gradient-to-br from-[#1a1c26] to-[#12131b] border-[#2f3346] shadow-lg shadow-black/40'
                    : 'bg-gradient-to-br from-white to-amber-50/30 border-amber-200 shadow-md shadow-amber-950/5'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Avatar e Identificação do Gestor */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-13 h-13 rounded-2xl overflow-hidden ring-2 ring-[#f89847] shadow-md flex items-center justify-center bg-slate-800">
                        <img
                          src={manager.avatar}
                          alt={manager.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80';
                          }}
                        />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#12131A] flex items-center justify-center text-[8px] text-white font-bold" title="Gestor Ativo">
                        ✓
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm sm:text-base font-extrabold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {manager.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#96183c] to-[#f89847] text-white shadow-xs">
                          Gestor
                        </span>
                      </div>

                      <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                        {manager.role || 'Gestor Responsável'}
                      </p>

                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Departamento: {manager.department || currentUser.department}
                      </p>
                    </div>
                  </div>

                  {/* Informações de Contato do Gestor */}
                  <div className={`w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l ${
                    isDark ? 'border-white/10 sm:pl-4' : 'border-slate-200 sm:pl-4'
                  } space-y-1.5 text-xs`}>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#f89847] shrink-0" />
                      <span className="font-mono text-[11px] truncate">{manager.email || 'gestor@pontual.com'}</span>
                    </div>

                    {manager.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono text-[11px]">{manager.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`mt-3 pt-3 border-t flex items-center gap-1.5 text-[11px] ${
                  isDark ? 'border-white/5 text-slate-400' : 'border-amber-100 text-slate-600'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    Todas as suas solicitações de folga, trocas de turno e justificativas são analisadas por este gestor.
                  </span>
                </div>
              </div>
            ) : (
              /* Colaborador sem Gestor Direto Cadastrado */
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center text-slate-300 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      Reporte Direto: Recursos Humanos / Gestão Geral
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400">
                      Centralizado
                    </span>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Não há um gestor de setor exclusivo vinculado à sua conta. Suas solicitações operacionais e atestados são direcionados automaticamente para a coordenação geral de RH.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Dados Cadastrais & Informações do Contrato */}
          <div className="space-y-2.5">
            <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Dados do Contrato & Trabalho
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {/* Matrícula */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Matrícula / Código
                </span>
                <span className={`text-xs font-mono font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.registrationId || `COL-${currentUser.id.slice(0, 6)}`}
                </span>
              </div>

              {/* Carga Horária */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Jornada Semanal
                </span>
                <span className={`text-xs font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.standardHoursPerWeek || 40} horas / semana
                </span>
              </div>

              {/* Tipo de Contrato */}
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Regime de Trabalho
                </span>
                <span className={`text-xs font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.contractType || 'CLT'}
                </span>
              </div>

              {/* Local de Trabalho */}
              <div className={`p-3 rounded-xl border sm:col-span-2 md:col-span-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Posto de Atuação / Sede
                </span>
                <span className={`text-xs font-bold mt-0.5 block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.workplace || 'Sede Employer - Matriz (GPS Validado)'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-t shrink-0 ${
            isDark ? 'border-white/10 bg-[#0e1017]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pontual Gestão de Escalas & Ponto GPS
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
