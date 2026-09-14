import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  CalendarDays, 
  TrendingUp, 
  Sparkles, 
  Plus, 
  Briefcase, 
  Download, 
  UserPlus, 
  Bell, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Employee, Shift } from '../types';

interface ManagerMainViewProps {
  employees: Employee[];
  shifts: Shift[];
  pendingRequestsCount: number;
  onOpenCreateShift: () => void;
  onOpenAddUser: () => void;
  onOpenRequests: () => void;
  onOpenPjModal: () => void;
  onExportCsv: () => void;
  onNavigateToCalendar: () => void;
}

export const ManagerMainView: React.FC<ManagerMainViewProps> = ({
  employees,
  shifts,
  pendingRequestsCount,
  onOpenCreateShift,
  onOpenAddUser,
  onOpenRequests,
  onOpenPjModal,
  onExportCsv,
  onNavigateToCalendar,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Turnos da equipe hoje
  const todayShifts = shifts.filter(s => s.date === todayStr || s.date === '2026-10-19');
  const presentCount = todayShifts.filter(s => s.attendanceStatus === 'present').length;
  const totalToday = todayShifts.length || 5;

  // Estatísticas da semana
  const totalEmployees = employees.length;
  const totalHoursWeekly = employees.reduce((acc, e) => acc + (e.standardHoursPerWeek || 44), 0);
  const pjEmployees = employees.filter(e => e.contractType === 'PJ').length;

  return (
    <div className="space-y-5 font-sans">
      
      {/* 1. HERO BANNER DO GESTOR (Estilo Ponto Digital do Colaborador) */}
      <div className="bg-[#181824] text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/10 relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#E2F952]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Lado Esquerdo: Relógio & Status Operacional */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-[#E2F952] uppercase bg-[#E2F952]/10 px-3 py-1 rounded-full w-fit border border-[#E2F952]/20">
              <span className="w-2 h-2 rounded-full bg-[#E2F952] animate-pulse" />
              <span>MONITORAMENTO GPS & OPERAÇÕES PONTUAL</span>
            </div>

            {/* Relógio Digital Grande */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                {currentTime.toLocaleTimeString('pt-BR')}
              </span>
              <span className="text-xs text-slate-400 font-medium capitalize font-mono">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Card de Status Operacional Hoje */}
            <div className="bg-[#111117] border border-white/10 rounded-2xl p-3.5 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-4 h-4 text-[#E2F952]" />
                <span>
                  <strong>{totalToday}</strong> turnos ativos hoje
                </span>
              </div>
              <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{presentCount} presenças confirmadas via GPS</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-2 text-slate-400 font-mono">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Posto Matriz (Raio 150m OK)</span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Ação Rápida de Ir para o Calendário */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={onNavigateToCalendar}
              className="px-6 py-4 bg-[#E2F952] hover:bg-[#D4F639] text-black font-black text-xs rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 font-mono"
            >
              <CalendarDays className="w-4 h-4" />
              <span>VER GRADE DE ESCALAS & TURNOS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 2. CARDS DE MÉTRICAS DA EQUIPE (Estilo Frequência & Carga Horária) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Carga Horária da Equipe */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-mono">
              Carga Horária Semanal da Equipe
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              84% Agendado
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-900 font-mono">184h</span>
              <span className="text-xs text-slate-500 font-bold">de {totalHoursWeekly}h previstas</span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mt-2 p-0.5 border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-[#68b361] rounded-full transition-all duration-500"
                style={{ width: '84%' }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Total da equipe: {totalEmployees} colaboradores</span>
            <span className="font-mono text-purple-700 font-bold">{pjEmployees} PJ Contratados</span>
          </div>
        </div>

        {/* Card 2: Frequência & Assiduidade da Equipe */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-mono">
              Frequência da Equipe (Semana)
            </span>
            <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              Assiduidade: 92%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
              <span className="block text-xl font-black text-emerald-700 font-mono">18</span>
              <span className="text-[9px] font-extrabold uppercase text-emerald-800 tracking-wider">Presenças</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              <span className="block text-xl font-black text-rose-700 font-mono">1</span>
              <span className="text-[9px] font-extrabold uppercase text-rose-800 tracking-wider">Faltas</span>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5">
              <span className="block text-xl font-black text-purple-700 font-mono">2</span>
              <span className="text-[9px] font-extrabold uppercase text-purple-800 tracking-wider">Atestados</span>
            </div>
          </div>
        </div>

        {/* Card 3: Ações Rápidas de Gestão */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 font-mono">
            Ações Rápidas do Gestor
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenCreateShift}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-all flex items-center gap-2 group"
            >
              <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 leading-tight">Novo Turno</span>
                <span className="text-[9px] text-slate-500 font-mono">Criar escala</span>
              </div>
            </button>

            <button
              onClick={onOpenAddUser}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-all flex items-center gap-2 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#68b361] text-white flex items-center justify-center font-bold text-xs shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 leading-tight">+ Colaborador</span>
                <span className="text-[9px] text-slate-500 font-mono">Cadastrar</span>
              </div>
            </button>

            <button
              onClick={onOpenRequests}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-all flex items-center gap-2 relative group"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 leading-tight">Aprovações</span>
                <span className="text-[9px] text-rose-600 font-mono font-bold">{pendingRequestsCount} pendentes</span>
              </div>
            </button>

            <button
              onClick={onOpenPjModal}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-all flex items-center gap-2 group"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-slate-900 leading-tight">Contratos PJ</span>
                <span className="text-[9px] text-slate-500 font-mono">Horas & NFS-e</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* 3. MONITOR DE PRESENÇA EM TEMPO REAL DA EQUIPE */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status de Presença GPS dos Colaboradores Hoje</span>
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhamento ao vivo de check-in geolocalizado e escalas da equipe
            </p>
          </div>

          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Lista de Colaboradores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {employees.map((emp) => {
            const empShift = shifts.find(s => s.employeeId === emp.id);
            const isPresent = empShift?.attendanceStatus === 'present';
            const isPj = emp.contractType === 'PJ';

            return (
              <div
                key={emp.id}
                className="p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between space-x-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200"
                  />
                  <div>
                    <span className="block font-bold text-xs text-slate-900 leading-tight">
                      {emp.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {emp.role}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isPj ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {emp.contractType || 'CLT'}
                      </span>
                      <span className="text-[10px] text-slate-400">· {emp.workplace || 'Sede Matriz'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {isPresent ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      GPS OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                      Escala OK
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
