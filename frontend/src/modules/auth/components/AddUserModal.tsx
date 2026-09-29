import React, { useState, useEffect } from 'react';
import { User, X, Check, Sparkles, RefreshCw, Mail, Key } from 'lucide-react';
import { Employee } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (employee: Employee) => void;
  theme?: 'light' | 'dark';
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
  theme: propTheme,
}) => {
  const { theme: ctxTheme } = useTheme();
  const currentTheme = propTheme || ctxTheme || 'dark';
  const isDark = currentTheme !== 'light';

  const [activeTab, setActiveTab] = useState<'PERFIL' | 'ATRIBUIÇÕES'>('PERFIL');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Função para gerar uma matrícula aleatória única
  const generateRandomId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `PNT-${randomNum}`;
  };

  // Pré-preenche um ID automático ao abrir o modal
  useEffect(() => {
    if (isOpen && !employeeId) {
      setEmployeeId(generateRandomId());
    }
  }, [isOpen]);
  const [role, setRole] = useState('Analista Operacional');
  const [department, setDepartment] = useState('Atendimento');
  const [userRole, setUserRole] = useState('Colaborador');
  const [employmentType, setEmploymentType] = useState('CLT');
  const [hasError, setHasError] = useState(false);

  // Fechamento via tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setHasError(true);
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanId = employeeId.trim() || generateRandomId();
    const newEmp: Employee = {
      id: `emp-${cleanId}`,
      registrationId: cleanId,
      name: fullName,
      role: role.trim() || (userRole === 'Gestor' ? 'Gerente Operacional' : 'Colaborador'),
      department: department.trim() || 'Operações',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      email: email.trim() || `${firstName.toLowerCase().replace(/\s+/g, '')}@pontual.com.br`,
      phone: phone.trim() || '(11) 98765-4321',
      standardHoursPerWeek: employmentType === 'PJ' ? 40 : 44,
      contractType: employmentType as 'CLT' | 'PJ' | 'TEMPORARIO',
      workplace: 'Sede Pontual - Matriz',
    };

    onAddEmployee(newEmp);
    onClose();
    // Reset form
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setEmployeeId('');
    setHasError(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 font-sans border transition-colors ${
          isDark
            ? 'bg-[#12131A] border-white/10 text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800 shadow-2xl'
        }`}
        style={{ maxHeight: '92vh' }}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183c] via-[#f89847] to-[#faf0ac]" />

        {/* Modal Header */}
        <div className={`px-6 py-4.5 flex items-start justify-between border-b ${
          isDark ? 'border-white/10' : 'border-slate-150 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Adicionar Novo Colaborador
              </h2>
              <p className={`text-xs mt-0.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Cadastre as informações de perfil e atribuições no sistema Pontual
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
            title="Fechar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`px-6 py-2.5 flex items-center gap-2 border-b ${
          isDark ? 'bg-[#0B0C10]/80 border-white/8' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('PERFIL')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PERFIL'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            style={activeTab === 'PERFIL' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
            } : undefined}
          >
            1. PERFIL
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ATRIBUIÇÕES')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ATRIBUIÇÕES'
                ? 'text-white shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            style={activeTab === 'ATRIBUIÇÕES' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
            } : undefined}
          >
            2. ATRIBUIÇÕES
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 210px)' }}>
          <div className="p-6 space-y-5">

            {activeTab === 'PERFIL' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Top Row: First Name, Last Name, Avatar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold mb-1.5 block ${
                          hasError && !firstName ? 'text-rose-500 font-bold' : isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          Nome*
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            if (e.target.value) setHasError(false);
                          }}
                          placeholder="Ex: Carlos"
                          required
                          className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                            hasError && !firstName
                              ? 'border-rose-500 ring-2 ring-rose-500/20'
                              : isDark
                                ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`text-xs font-semibold mb-1.5 block ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          Sobrenome*
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Ex: Silva"
                          required
                          className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                            isDark
                              ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                              : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`text-xs font-semibold mb-1.5 block ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        E-mail Corporativo
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="carlos.silva@pontual.com.br"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                          isDark
                            ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Avatar Preview Box */}
                  <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${
                    isDark
                      ? 'border-white/10 bg-white/5'
                      : 'border-slate-200 bg-slate-50 shadow-2xs'
                  }`}>
                    <div className={`w-16 h-16 rounded-full overflow-hidden mb-2 ring-2 shadow-md flex items-center justify-center ${
                      isDark ? 'ring-[#f89847] bg-black/40' : 'ring-[#96183c] bg-white'
                    }`}>
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${
                      isDark ? 'text-[#faf0ac]' : 'text-[#96183c]'
                    }`}>
                      Foto de Perfil
                    </span>
                    <span className={`text-[10px] mt-0.5 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Automático
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Celular / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-xs font-semibold ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        ID do Colaborador (Matrícula / RE)
                      </label>
                      <button
                        type="button"
                        onClick={() => setEmployeeId(generateRandomId())}
                        className="text-[11px] flex items-center gap-1 font-semibold text-[#f89847] hover:underline cursor-pointer"
                        title="Gerar nova matrícula aleatória"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Gerar Novo</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                        placeholder="PNT-7842"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-wide outline-none transition-all border ${
                          isDark
                            ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Caixa de Notificação de Convite e Primeiro Acesso */}
                <div className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                  isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                }`}>
                  <input
                    type="checkbox"
                    id="sendWelcomeEmail"
                    checked={sendWelcomeEmail}
                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                    className="mt-0.5 rounded cursor-pointer accent-[#f89847] w-4 h-4"
                  />
                  <label htmlFor="sendWelcomeEmail" className="text-xs leading-relaxed cursor-pointer select-none">
                    <span className={`font-semibold block ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                      📧 Enviar e-mail de ativação com link e credencial de primeiro acesso
                    </span>
                    <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-[11px]`}>
                      O código <strong className="font-mono text-[#f89847]">{employeeId || 'PNT-XXXX'}</strong> será enviado ao colaborador como senha temporária de primeiro login para definição de sua senha pessoal.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'ATRIBUIÇÕES' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Cargo / Função
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Analista Operacional"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white placeholder:text-slate-500 focus:border-[#f89847] focus:ring-2 focus:ring-[#f89847]/10'
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#96183c] focus:ring-2 focus:ring-[#96183c]/10'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Departamento / Setor
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="Atendimento" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Atendimento</option>
                      <option value="Suporte Técnico" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Suporte Técnico</option>
                      <option value="Operações" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Operações</option>
                      <option value="Comercial" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Comercial</option>
                      <option value="Tecnologia" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Tecnologia</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                      style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    />
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Perfil de Acesso
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="Colaborador" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Colaborador</option>
                      <option value="Gestor" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Gestor</option>
                      <option value="Administrador" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-xs font-semibold mb-1.5 block ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Regime Contratual
                    </label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer border ${
                        isDark
                          ? 'bg-[#181A24] border-white/10 text-white focus:border-[#f89847]'
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-[#96183c]'
                      }`}
                    >
                      <option value="CLT" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>CLT Integral (44h)</option>
                      <option value="PJ" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>PJ / Prestador (160h)</option>
                      <option value="TEMPORARIO" className={isDark ? "bg-[#181A24] text-white" : "bg-white text-slate-800"}>Temporário</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Info Banner */}
            <div className={`p-4 rounded-2xl flex items-center gap-3.5 text-xs border ${
              isDark
                ? 'bg-[#f89847]/10 border-[#f89847]/25 text-slate-300'
                : 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-2xs'
            }`}>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-[#f89847]/20 text-[#f89847]' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="leading-relaxed">
                <strong className={`block mb-0.5 ${isDark ? 'text-[#faf0ac]' : 'text-amber-950 font-bold'}`}>
                  Integração com Ponto Digital
                </strong>
                <span className={isDark ? 'text-slate-300' : 'text-amber-800/90'}>
                  Após o cadastro, o colaborador terá acesso automático ao Portal do Colaborador para registro de turnos.
                </span>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className={`px-6 py-4 flex items-center justify-between border-t ${
            isDark ? 'border-white/10 bg-[#0e1017]' : 'border-slate-200 bg-slate-50'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-95 active:scale-95 shadow-md flex items-center gap-2 cursor-pointer text-white"
              style={{
                background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
              }}
            >
              <Check className="w-4 h-4" />
              <span>Salvar Colaborador</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
