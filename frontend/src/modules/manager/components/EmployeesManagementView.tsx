import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Building2, 
  Briefcase, 
  Mail, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Check, 
  LayoutGrid, 
  List,
  Sparkles,
  UserX
} from 'lucide-react';
import { Employee } from '@/types';
import { useTheme } from '@/shared/context/ThemeContext';

interface EmployeesManagementViewProps {
  employees: Employee[];
  activeEmployee?: Employee;
  onAddEmployee: () => void;
  onUpdateEmployee: (updated: Employee) => void;
  onDeactivateEmployee: (employeeId: string) => void;
}

export const EmployeesManagementView: React.FC<EmployeesManagementViewProps> = ({
  employees,
  activeEmployee,
  onAddEmployee,
  onUpdateEmployee,
  onDeactivateEmployee,
}) => {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modais de ações
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // Formulário de Edição
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    department: '',
    phone: '',
    standardHoursPerWeek: 40,
  });

  // Lista de departamentos únicos
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Filtragem da lista
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        emp.name.toLowerCase().includes(q) || 
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.registrationId && emp.registrationId.toLowerCase().includes(q)) ||
        emp.role.toLowerCase().includes(q);

      const matchDept = selectedDept === 'all' || emp.department === selectedDept;

      return matchSearch && matchDept;
    });
  }, [employees, searchQuery, selectedDept]);

  // Abertura do modal de edição
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name,
      role: emp.role,
      department: emp.department,
      phone: emp.phone || '',
      standardHoursPerWeek: emp.standardHoursPerWeek || 40,
    });
  };

  // Salvar Edição
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const updated: Employee = {
      ...editingEmployee,
      name: editForm.name.trim(),
      role: editForm.role.trim(),
      department: editForm.department.trim(),
      phone: editForm.phone.trim(),
      standardHoursPerWeek: Number(editForm.standardHoursPerWeek) || 40,
    };

    onUpdateEmployee(updated);
    setEditingEmployee(null);
  };

  // Confirmação de Inativação / Desativação
  const handleConfirmDeactivate = () => {
    if (deletingEmployee) {
      onDeactivateEmployee(deletingEmployee.id);
      setDeletingEmployee(null);
    }
  };

  return (
    <div className={`space-y-6 p-2 sm:p-4 transition-colors duration-300 ${isDark ? 'text-white' : 'text-[#1e293b]'}`}>

      {/* Header Principal */}
      <div 
        className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl transition-all duration-300 ${
          isDark 
            ? 'border-white/10 bg-[#0F1117]' 
            : 'border-slate-200 bg-white shadow-slate-200/50'
        }`}
        style={
          isDark 
            ? { background: 'radial-gradient(ellipse 80% 90% at 95% 50%, rgba(150, 24, 60, 0.35) 0%, rgba(248, 150, 66, 0.15) 50%, rgba(15, 17, 23, 0) 80%), #0F1117' }
            : { background: 'radial-gradient(ellipse 80% 90% at 95% 50%, rgba(150, 24, 60, 0.15) 0%, rgba(248, 150, 66, 0.1) 50%, rgba(255, 255, 255, 0) 80%), #ffffff' }
        }
      >
        <div className="space-y-2 relative z-10">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isDark ? 'bg-white/10 text-[#f89642] border border-white/10' : 'bg-slate-100 text-[#96183c] border border-slate-200'
          }`}>
            <Users className="w-3.5 h-3.5" />
            <span>Quadro Geral da Empresa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Gestão de <span className="bg-gradient-to-r from-[#96183c] via-[#f89642] to-[#f89642] bg-clip-text text-transparent">Colaboradores</span>
          </h1>
          <p className={`text-xs sm:text-sm max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cadastre, edite cargos, gerencie jornadas de trabalho e desative colaboradores da sua equipe com conformidade e segurança auditável.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={onAddEmployee}
            className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Novo Colaborador</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#96183c] to-[#f89642] flex items-center justify-center text-white shrink-0 shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-xs font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total de Colaboradores</span>
            <span className="text-2xl font-black">{employees.length}</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-xs font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Departamentos Ativos</span>
            <span className="text-2xl font-black">{departments.length || 1}</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-xs font-bold block uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gestores Ativos</span>
            <span className="text-2xl font-black">
              {employees.filter(e => e.isMasterManager || e.role.toLowerCase().includes('gestor') || e.role.toLowerCase().includes('gerente')).length || 1}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
        isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          {/* Busca por Texto */}
          <div className="relative w-full sm:w-72">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou código..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none transition-all ${
                isDark 
                  ? 'bg-[#0b0c10] border-[#252A3A] text-white focus:border-[#f89642]' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#96183c]'
              }`}
            />
          </div>

          {/* Filtro por Departamento */}
          <div className="relative w-full sm:w-56">
            <Filter className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none appearance-none cursor-pointer ${
                isDark 
                  ? 'bg-[#0b0c10] border-[#252A3A] text-white focus:border-[#f89642]' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#96183c]'
              }`}
            >
              <option value="all">Todos os Departamentos</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modo de Exibição (Grid / Tabela) */}
        <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-[#0b0c10] border-[#252A3A]' : 'bg-slate-100 border-slate-200'}`}>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-gradient-to-r from-[#96183c] to-[#f89642] text-white shadow-md' 
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Visualização em Cards"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table' 
                ? 'bg-gradient-to-r from-[#96183c] to-[#f89642] text-white shadow-md' 
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Visualização em Tabela"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Exibição dos Colaboradores */}
      {filteredEmployees.length === 0 ? (
        <div className={`p-12 rounded-3xl border text-center space-y-4 ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <UserX className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold">Nenhum colaborador encontrado</h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Não há colaboradores cadastrados que correspondam aos filtros selecionados. Clique no botão "+ Novo Colaborador" para adicionar membros à sua equipe.
            </p>
          </div>
          <button
            onClick={onAddEmployee}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
          >
            Adicionar Primeiro Colaborador
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUALIZAÇÃO EM GRID (CARDS) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => {
            const isSelf = activeEmployee?.id === emp.id;
            return (
              <div 
                key={emp.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-200 hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-[#151822] border-[#252A3A] hover:border-[#f89642]/40 shadow-xl' 
                    : 'bg-white border-slate-200 hover:border-[#96183c]/30 shadow-md'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
                        alt={emp.name} 
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 shadow-md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-sm truncate">{emp.name}</h4>
                          {emp.isMasterManager && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Master RH
                            </span>
                          )}
                        </div>
                        <span className={`text-xs block font-semibold truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {emp.role}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 shrink-0">
                      {emp.registrationId || 'PNT-1000'}
                    </span>
                  </div>

                  <div className={`space-y-1.5 text-xs p-3 rounded-xl border ${
                    isDark ? 'bg-[#0b0c10] border-white/5' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{emp.department}</span>
                    </div>
                    {emp.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-400">{emp.email}</span>
                      </div>
                    )}
                    {emp.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-400">{emp.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de Ações do Card */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Editar informações cadastrais"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                  </div>

                  {!isSelf && (
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        isDark 
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400' 
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                      }`}
                      title="Desativar ou remover colaborador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Desativar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM TABELA */
        <div className={`rounded-2xl border overflow-hidden overflow-x-auto ${
          isDark ? 'bg-[#151822] border-[#252A3A]' : 'bg-white border-slate-200'
        }`}>
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className={`border-b font-mono uppercase text-[10px] ${
                isDark ? 'bg-[#0b0c10] border-[#252A3A] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <th className="p-3.5">COLABORADOR</th>
                <th className="p-3.5">MATRÍCULA</th>
                <th className="p-3.5">CARGO / FUNÇÃO</th>
                <th className="p-3.5">DEPARTAMENTO</th>
                <th className="p-3.5">CONTATO</th>
                <th className="p-3.5 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEmployees.map(emp => {
                const isSelf = activeEmployee?.id === emp.id;
                return (
                  <tr key={emp.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <img 
                          src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
                          alt={emp.name} 
                          className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                        />
                        <div>
                          <span className="font-bold block text-sm">{emp.name}</span>
                          {emp.isMasterManager && (
                            <span className="text-[9px] font-bold text-amber-400 uppercase">Gestor Master RH</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{emp.registrationId || 'PNT-1000'}</td>
                    <td className="p-3.5 font-semibold">{emp.role}</td>
                    <td className="p-3.5 text-slate-400">{emp.department}</td>
                    <td className="p-3.5 text-slate-400">{emp.email || emp.phone || '—'}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => setDeletingEmployee(emp)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                            title="Desativar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE EDIÇÃO CADASTRAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-lg rounded-3xl border p-6 sm:p-7 shadow-2xl space-y-6 ${
            isDark ? 'bg-[#0F1117] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#96183c] to-[#f89642] flex items-center justify-center text-white font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">Editar Colaborador</h3>
                  <span className="text-xs text-slate-400 block">{editingEmployee.name}</span>
                </div>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-slate-400">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                    isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400">Cargo / Função</label>
                  <input
                    type="text"
                    required
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400">Departamento</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400">Telefone / Celular</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400">Jornada Semanal (Horas)</label>
                  <input
                    type="number"
                    value={editForm.standardHoursPerWeek}
                    onChange={e => setEditForm({ ...editForm, standardHoursPerWeek: Number(e.target.value) })}
                    className={`w-full px-4 py-2.5 rounded-xl border outline-none ${
                      isDark ? 'bg-[#0b0c10] border-[#252A3A] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className={`px-4 py-2.5 rounded-xl font-bold cursor-pointer ${
                    isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white cursor-pointer shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #96183c, #f89847)' }}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE INATIVAÇÃO / EXCLUSÃO */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#0F1117] border-[#252A3A] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black">Desativar Colaborador?</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Tem certeza que deseja inativar <strong className="text-white">{deletingEmployee.name}</strong>?
                <br />
                Por conformidade trabalhista, o funcionário deixará de aparecer nas escalas ativas, mas seu histórico de pontos e atestados será <strong>preservado com segurança auditável</strong>.
              </p>
            </div>

            <div className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
              isDark ? 'bg-[#0b0c10] border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="font-bold flex items-center gap-1.5 text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Soft Delete Seguro</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Matrícula: {deletingEmployee.registrationId || 'PNT-1000'} • Cargo: {deletingEmployee.role}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                  isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-950/40"
              >
                Confirmar Desativação
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
