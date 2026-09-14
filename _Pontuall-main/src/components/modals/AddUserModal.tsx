import React, { useState, useEffect } from 'react';
import { User, X, Briefcase, Calendar, Mail, Phone, Hash, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { Employee } from '../../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (employee: Employee) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'PERFIL' | 'ATRIBUIÇÕES'>('PERFIL');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState('Analista Operacional');
  const [department, setDepartment] = useState('Atendimento');
  const [userRole, setUserRole] = useState('Colaborador');
  const [employmentType, setEmploymentType] = useState('CLT');
  const [searchQuery, setSearchQuery] = useState('');
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
    const newEmp: Employee = {
      id: employeeId.trim() ? `emp-${employeeId.trim()}` : `emp-${Date.now()}`,
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
    // Reset
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setEmployeeId('');
    setHasError(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 text-slate-100 font-sans"
        style={{
          background: 'linear-gradient(160deg, #1a0010 0%, #0d0008 60%, #0a0308 100%)',
          border: '1px solid rgba(150,24,60,0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(248,152,71,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          maxHeight: '92vh',
        }}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #96183c, #f89847, #faf0ac)' }} />

        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-start justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
            >
              <User className="w-5 h-5 text-[#faf0ac]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Adicionar Novo Colaborador
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Cadastre as informações de perfil e atribuições no sistema Pontual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-slate-400 hover:text-white"
            title="Fechar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div
          className="px-6 py-2.5 flex items-center gap-2 bg-[#0B0C10]/60"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('PERFIL')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PERFIL'
                ? 'shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            style={activeTab === 'PERFIL' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
              color: '#faf0ac',
            } : undefined}
          >
            1. PERFIL
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ATRIBUIÇÕES')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ATRIBUIÇÕES'
                ? 'shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            style={activeTab === 'ATRIBUIÇÕES' ? {
              background: 'linear-gradient(135deg, #96183c, #f89847)',
              color: '#faf0ac',
            } : undefined}
          >
            2. ATRIBUIÇÕES
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          <div className="p-6 space-y-5">
            
            {activeTab === 'PERFIL' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Top Row: First Name, Last Name, Avatar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`text-xs font-semibold mb-1.5 block ${hasError && !firstName ? 'text-rose-400' : 'text-slate-300'}`}>
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
                          className={`w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all ${
                            hasError && !firstName ? 'border-rose-500' : 'border-white/10 focus:border-[#f89847]'
                          }`}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                          Sobrenome*
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Ex: Silva"
                          required
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'rgba(248,152,71,0.5)'}
                          onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                        E-mail Corporativo
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="carlos.silva@pontual.com.br"
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'rgba(248,152,71,0.5)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    </div>
                  </div>

                  {/* Avatar Preview Box */}
                  <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-white/10 bg-white/5 text-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden mb-2 ring-2 ring-[#f89847] shadow-md flex items-center justify-center bg-black/40">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-mono text-[#faf0ac]">Foto de Perfil</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Automático</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Celular / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(248,152,71,0.5)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      ID do Colaborador (Registro)
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="PNT-7842"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(248,152,71,0.5)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ATRIBUIÇÕES' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Cargo / Função
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Analista Operacional"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(248,152,71,0.5)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Departamento / Setor
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <option value="Atendimento" style={{ background: '#1a0010', color: '#fff' }}>Atendimento</option>
                      <option value="Suporte Técnico" style={{ background: '#1a0010', color: '#fff' }}>Suporte Técnico</option>
                      <option value="Operações" style={{ background: '#1a0010', color: '#fff' }}>Operações</option>
                      <option value="Comercial" style={{ background: '#1a0010', color: '#fff' }}>Comercial</option>
                      <option value="Tecnologia" style={{ background: '#1a0010', color: '#fff' }}>Tecnologia</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Perfil de Acesso
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <option value="Colaborador" style={{ background: '#1a0010', color: '#fff' }}>Colaborador</option>
                      <option value="Gestor" style={{ background: '#1a0010', color: '#fff' }}>Gestor</option>
                      <option value="Administrador" style={{ background: '#1a0010', color: '#fff' }}>Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1.5 block text-slate-300">
                      Regime Contratual
                    </label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all cursor-pointer"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <option value="CLT" style={{ background: '#1a0010', color: '#fff' }}>CLT Integral (44h)</option>
                      <option value="PJ" style={{ background: '#1a0010', color: '#fff' }}>PJ / Prestador (160h)</option>
                      <option value="TEMPORARIO" style={{ background: '#1a0010', color: '#fff' }}>Temporário</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Info Banner */}
            <div
              className="p-3.5 rounded-xl flex items-center gap-3 text-xs"
              style={{
                background: 'rgba(248, 152, 71, 0.08)',
                border: '1px solid rgba(248, 152, 71, 0.25)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(248, 152, 71, 0.15)', color: '#f89847' }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-slate-300 leading-relaxed">
                <strong className="text-[#faf0ac] block">Integração com Ponto Digital</strong>
                Após o cadastro, o colaborador terá acesso automático ao Portal do Colaborador para registro de turnos.
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-lg flex items-center gap-2 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
                color: '#faf0ac',
                boxShadow: '0 4px 14px rgba(150,24,60,0.4)',
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
