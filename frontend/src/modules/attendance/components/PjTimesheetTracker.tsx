import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Clock, 
  Plus, 
  Briefcase, 
  FileText, 
  CheckCircle2, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  X, 
  Upload, 
  Sparkles,
  ChevronRight,
  Hash,
  Building2
} from 'lucide-react';
import { Employee, PjTimesheetEntry, PjReportLink, PjActiveTimerState } from '@/types';
import { 
  getActiveTimer, 
  saveActiveTimer, 
  addDraftTimesheetEntry,
  getDraftTimesheet
} from '@/modules/attendance/services/pjReportService';

interface PjTimesheetTrackerProps {
  employee: Employee;
  isDark?: boolean;
  compactMode?: boolean;
  onEntryAdded?: (entry: PjTimesheetEntry) => void;
  onNavigateToFullView?: () => void;
}

const COST_CENTER_SUGGESTIONS = [
  'CC-TI-01 • Tecnologia & Dev',
  'CC-PROD-02 • Produto & Design',
  'CC-OPS-03 • Operações & Infra',
  'CC-MKT-04 • Marketing & Growth',
  'CC-ADM-05 • Administrativo / Corporativo',
];

export const PjTimesheetTracker: React.FC<PjTimesheetTrackerProps> = ({
  employee,
  isDark = true,
  compactMode = false,
  onEntryAdded,
  onNavigateToFullView,
}) => {
  const defaultCC = employee.department 
    ? `CC-${employee.department.toUpperCase().slice(0, 4)}-01 • ${employee.department}`
    : 'CC-TI-01 • Tecnologia & Dev';

  // Gera próximo ID de tarefa sugerido com base na quantidade de itens
  const generateNextTaskCode = () => {
    const existing = getDraftTimesheet(employee.id);
    const nextNum = existing.length + 1;
    return `TK-${String(nextNum).padStart(3, '0')}`;
  };

  // Estado do Timer
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [taskCode, setTaskCode] = useState('');
  const [costCenter, setCostCenter] = useState(defaultCC);
  const [project, setProject] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [startClockTime, setStartClockTime] = useState<string>('');

  // Modais
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Campos para o modal de conclusão / manual
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualTaskCode, setManualTaskCode] = useState('');
  const [manualCostCenter, setManualCostCenter] = useState(defaultCC);
  const [manualStartTime, setManualStartTime] = useState('09:00');
  const [manualEndTime, setManualEndTime] = useState('12:00');
  const [manualBreakMinutes, setManualBreakMinutes] = useState(0);
  const [manualProject, setManualProject] = useState('');
  const [manualTask, setManualTask] = useState('');
  const [modalLinks, setModalLinks] = useState<PjReportLink[]>([{ title: '', url: '' }]);
  const [modalImages, setModalImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar timer salvo na inicialização
  useEffect(() => {
    const saved = getActiveTimer(employee.id);
    if (saved && saved.isRunning) {
      setIsRunning(true);
      setIsPaused(saved.isPaused);
      setTaskCode(saved.taskCode || generateNextTaskCode());
      setCostCenter(saved.costCenter || defaultCC);
      setProject(saved.project || '');
      setTaskDescription(saved.taskDescription || '');
      setBreakSeconds(saved.accumulatedBreakSeconds || 0);

      const now = Date.now();
      if (saved.isPaused && saved.pausedTimestamp) {
        setElapsedSeconds(saved.accumulatedSeconds);
        const currentBreak = Math.floor((now - saved.pausedTimestamp) / 1000);
        setBreakSeconds((saved.accumulatedBreakSeconds || 0) + currentBreak);
      } else {
        const currentRun = Math.floor((now - saved.startTimestamp) / 1000);
        setElapsedSeconds(saved.accumulatedSeconds + currentRun);
      }

      const startDateObj = new Date(saved.startTimestamp);
      setStartClockTime(
        `${String(startDateObj.getHours()).padStart(2, '0')}:${String(startDateObj.getMinutes()).padStart(2, '0')}`
      );
    } else {
      setTaskCode(generateNextTaskCode());
    }
  }, [employee.id]);

  // Intervalo do Cronômetro
  useEffect(() => {
    let interval: any = null;

    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          if (next % 5 === 0) {
            saveTimerState(true, false, next, breakSeconds);
          }
          return next;
        });
      }, 1000);
    } else if (isRunning && isPaused) {
      interval = setInterval(() => {
        setBreakSeconds(prev => {
          const next = prev + 1;
          if (next % 5 === 0) {
            saveTimerState(true, true, elapsedSeconds, next);
          }
          return next;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, isPaused, breakSeconds, elapsedSeconds, taskCode, costCenter, project, taskDescription]);

  const saveTimerState = (
    running: boolean, 
    paused: boolean, 
    accumSecs: number, 
    accumBreakSecs: number
  ) => {
    if (!running) {
      saveActiveTimer(employee.id, null);
      return;
    }

    const state: PjActiveTimerState = {
      isRunning: running,
      isPaused: paused,
      taskCode,
      costCenter,
      project,
      taskDescription,
      startTimestamp: Date.now() - (accumSecs * 1000),
      accumulatedSeconds: accumSecs,
      pausedTimestamp: paused ? Date.now() : undefined,
      accumulatedBreakSeconds: accumBreakSecs,
    };
    saveActiveTimer(employee.id, state);
  };

  // Formatação de Segundos para HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Iniciar Cronômetro
  const handleStartTimer = () => {
    const now = new Date();
    const formattedNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const activeCode = taskCode.trim() || generateNextTaskCode();
    setTaskCode(activeCode);
    setStartClockTime(formattedNow);
    setIsRunning(true);
    setIsPaused(false);
    saveActiveTimer(employee.id, {
      isRunning: true,
      isPaused: false,
      taskCode: activeCode,
      costCenter: costCenter.trim() || defaultCC,
      project,
      taskDescription,
      startTimestamp: Date.now(),
      accumulatedSeconds: 0,
      accumulatedBreakSeconds: 0,
    });

    setNotification({
      type: 'info',
      message: `Tarefa ${activeCode} iniciada! Cronometrando em tempo real...`,
    });
    setTimeout(() => setNotification(null), 3000);
  };

  // Pausar Cronômetro (Interrupção / Pausa)
  const handlePauseTimer = () => {
    setIsPaused(true);
    saveTimerState(true, true, elapsedSeconds, breakSeconds);
    setNotification({
      type: 'info',
      message: 'Atividade pausada. Tempo de interrupção sendo registrado.',
    });
    setTimeout(() => setNotification(null), 3500);
  };

  // Retomar Cronômetro
  const handleResumeTimer = () => {
    setIsPaused(false);
    saveTimerState(true, false, elapsedSeconds, breakSeconds);
    setNotification({
      type: 'info',
      message: 'Atividade retomada!',
    });
    setTimeout(() => setNotification(null), 2500);
  };

  // Descartar Timer
  const handleDiscardTimer = () => {
    if (window.confirm('Tem certeza que deseja descartar este registro sem salvar?')) {
      setIsRunning(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      setBreakSeconds(0);
      setProject('');
      setTaskDescription('');
      saveActiveTimer(employee.id, null);
      setTaskCode(generateNextTaskCode());
    }
  };

  // Abrir Modal de Finalização do Timer Ativo
  const handleOpenFinishModal = () => {
    setIsPaused(true);
    if (!taskCode.trim()) setTaskCode(generateNextTaskCode());
    if (!costCenter.trim()) setCostCenter(defaultCC);
    saveTimerState(true, true, elapsedSeconds, breakSeconds);
    setModalLinks([{ title: '', url: '' }]);
    setModalImages([]);
    setIsFinishModalOpen(true);
  };

  // Confirmar Finalização do Timer Ativo
  const handleConfirmFinish = () => {
    const now = new Date();
    const endClock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Cálculo de horas líquidas: segundos corridos / 3600 (mínimo 0.01h para testes rápidos)
    const rawHours = Math.max(0, elapsedSeconds) / 3600;
    const calculatedHours = Number((rawHours > 0 ? Math.max(0.01, rawHours) : 0.01).toFixed(2));
    const breakMins = Math.round(breakSeconds / 60);

    const validLinks = modalLinks
      .filter(l => l.url.trim().length > 0)
      .map(l => ({
        title: l.title.trim() || l.url.trim(),
        url: l.url.trim().startsWith('http') ? l.url.trim() : `https://${l.url.trim()}`
      }));

    const finalTaskCode = taskCode.trim() || generateNextTaskCode();
    const finalCostCenter = costCenter.trim() || defaultCC;

    const newEntry: PjTimesheetEntry = {
      id: `tse-${Date.now()}`,
      taskCode: finalTaskCode,
      costCenter: finalCostCenter,
      date: new Date().toISOString().slice(0, 10),
      project: project.trim() || 'Projeto Geral',
      taskDescription: taskDescription.trim() || 'Atividade executada no período',
      startTime: startClockTime || endClock,
      endTime: endClock,
      breakMinutes: breakMins,
      durationHours: calculatedHours,
      links: validLinks,
      images: modalImages,
      isLiveTracked: true,
    };

    addDraftTimesheetEntry(employee.id, newEntry);
    if (onEntryAdded) onEntryAdded(newEntry);

    // Reseta estado
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setBreakSeconds(0);
    setProject('');
    setTaskDescription('');
    saveActiveTimer(employee.id, null);
    setIsFinishModalOpen(false);
    setTaskCode(generateNextTaskCode());

    setNotification({
      type: 'success',
      message: `Tarefa ${finalTaskCode} (${newEntry.durationHours}h) salva no Timesheet!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Abrir Modal Manual
  const handleOpenManualModal = () => {
    setManualTaskCode(generateNextTaskCode());
    setManualCostCenter(costCenter || defaultCC);
    setModalLinks([{ title: '', url: '' }]);
    setModalImages([]);
    setIsManualModalOpen(true);
  };

  // Adicionar Entrada Manual (Retroativa)
  const handleSaveManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProject.trim()) {
      alert('Informe o nome do projeto ou cliente.');
      return;
    }
    if (!manualTask.trim()) {
      alert('Informe a descrição da tarefa realizada.');
      return;
    }

    // Calcula duração líquida
    const [sh, sm] = manualStartTime.split(':').map(Number);
    const [eh, em] = manualEndTime.split(':').map(Number);
    let totalMins = (eh * 60 + em) - (sh * 60 + sm) - Number(manualBreakMinutes || 0);
    if (totalMins < 0) totalMins += 24 * 60;
    const durHours = Number((Math.max(0.01, totalMins / 60)).toFixed(2));

    const validLinks = modalLinks
      .filter(l => l.url.trim().length > 0)
      .map(l => ({
        title: l.title.trim() || l.url.trim(),
        url: l.url.trim().startsWith('http') ? l.url.trim() : `https://${l.url.trim()}`
      }));

    const finalTaskCode = manualTaskCode.trim() || generateNextTaskCode();
    const finalCostCenter = manualCostCenter.trim() || defaultCC;

    const newEntry: PjTimesheetEntry = {
      id: `tse-${Date.now()}`,
      taskCode: finalTaskCode,
      costCenter: finalCostCenter,
      date: entryDate,
      project: manualProject.trim(),
      taskDescription: manualTask.trim(),
      startTime: manualStartTime,
      endTime: manualEndTime,
      breakMinutes: Number(manualBreakMinutes || 0),
      durationHours: durHours,
      links: validLinks,
      images: modalImages,
      isLiveTracked: false,
    };

    addDraftTimesheetEntry(employee.id, newEntry);
    if (onEntryAdded) onEntryAdded(newEntry);

    // Limpa formulário
    setManualProject('');
    setManualTask('');
    setManualBreakMinutes(0);
    setModalLinks([{ title: '', url: '' }]);
    setModalImages([]);
    setIsManualModalOpen(false);
    setTaskCode(generateNextTaskCode());

    setNotification({
      type: 'success',
      message: `Tarefa ${finalTaskCode} (${durHours}h) adicionada ao Timesheet!`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setModalImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO: MODO COMPACTO (Dentro do Card de Ponto Diário do Colaborador)
  // ==========================================================================
  if (compactMode) {
    return (
      <div className={`p-4 rounded-2xl border transition-all ${
        isDark ? 'bg-[#151822] border-[#F59242]/30' : 'bg-amber-50/70 border-amber-200 shadow-sm'
      }`}>
        {notification && (
          <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            isDark
              ? 'bg-[#9F243C]/20 border-[#F59242]/40 text-[#F9DE97]'
              : 'bg-[#96183c]/10 border-[#96183c]/30 text-[#96183c]'
          }`}>
            <Sparkles className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
            <span className="font-medium text-[11px]">{notification.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isRunning ? (isPaused ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-ping') : 'bg-[#f89847]'
            }`} />
            <span className={`text-xs font-black uppercase tracking-wider ${
              isDark ? 'text-[#F9DE97]' : 'text-[#96183c]'
            }`}>
              Timesheet em Tempo Real
            </span>
          </div>

          {onNavigateToFullView && (
            <button
              onClick={onNavigateToFullView}
              className={`text-[11px] font-bold flex items-center gap-0.5 cursor-pointer ${
                isDark ? 'text-[#f89847] hover:text-amber-300' : 'text-[#96183c] hover:text-[#640C1E]'
              }`}
            >
              <span>Ver Completo</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Display do Cronômetro */}
        <div className={`text-center py-2 rounded-xl border mb-3 ${
          isDark ? 'bg-black/30 border-white/5' : 'bg-white border-amber-200/80 shadow-2xs'
        }`}>
          <span className={`font-mono text-3xl font-black tracking-wider ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            {formatTime(elapsedSeconds)}
          </span>
          <div className={`flex items-center justify-center gap-3 text-[10px] mt-0.5 ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {isRunning && <span>Início: <strong>{startClockTime}</strong></span>}
            {isPaused && <span className={`font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>• Em Pausa ({formatTime(breakSeconds)})</span>}
          </div>
        </div>

        {/* Inputs Compactos: ID Tarefa, Centro de Custo, Projeto e Tarefa */}
        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              placeholder="ID (ex: TK-001)"
              value={taskCode}
              onChange={e => setTaskCode(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-mono border outline-none transition-all ${
                isDark 
                  ? 'bg-black/30 border-white/10 text-[#F9DE97] placeholder-slate-500 focus:border-[#f89847]' 
                  : 'bg-white border-slate-300 text-[#96183c] placeholder-slate-400 focus:border-[#96183c]'
              }`}
              title="ID da Tarefa"
            />
            <input
              type="text"
              list="cost-centers-compact"
              placeholder="Centro de Custo..."
              value={costCenter}
              onChange={e => setCostCenter(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] border outline-none transition-all ${
                isDark 
                  ? 'bg-black/30 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
              }`}
              title="Centro de Custo"
            />
            <datalist id="cost-centers-compact">
              {COST_CENTER_SUGGESTIONS.map((cc, i) => (
                <option key={i} value={cc} />
              ))}
            </datalist>
          </div>
          <input
            type="text"
            placeholder="Nome do Projeto ou Cliente..."
            value={project}
            onChange={e => setProject(e.target.value)}
            className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition-all ${
              isDark 
                ? 'bg-black/30 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
            }`}
          />
          <input
            type="text"
            placeholder="O que você está realizando agora?"
            value={taskDescription}
            onChange={e => setTaskDescription(e.target.value)}
            className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition-all ${
              isDark 
                ? 'bg-black/30 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
            }`}
          />
        </div>

        {/* Botões de Controle Play / Pause / Stop */}
        <div className="grid grid-cols-2 gap-2">
          {!isRunning ? (
            <button
              onClick={handleStartTimer}
              className="col-span-2 py-2.5 px-3 rounded-xl font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Dar Play na Atividade</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={handleResumeTimer}
                  className="py-2 px-3 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Retomar</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="py-2 px-3 rounded-xl font-bold text-xs text-amber-900 bg-amber-400 hover:bg-amber-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pausar</span>
                </button>
              )}

              <button
                onClick={handleOpenFinishModal}
                className="py-2 px-3 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)' }}
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Salvar Tarefa</span>
              </button>
            </>
          )}
        </div>

        <div className={`mt-2.5 flex items-center justify-between text-[11px] px-1 ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <button
            onClick={handleOpenManualModal}
            className={`transition-colors cursor-pointer flex items-center gap-1 font-semibold ${
              isDark ? 'hover:text-[#f89847]' : 'text-[#96183c] hover:text-[#640C1E]'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>Registro Manual</span>
          </button>
          {isRunning && (
            <button
              onClick={handleDiscardTimer}
              className={`transition-colors cursor-pointer font-semibold ${
                isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'
              }`}
            >
              Descartar
            </button>
          )}
        </div>

        {isFinishModalOpen && renderFinishModal()}
        {isManualModalOpen && renderManualModal()}
      </div>
    );
  }

  // ==========================================================================
  // RENDERIZAÇÃO: MODO COMPLETO (Barra Superior de Ação no PjDeliverablesView)
  // ==========================================================================
  return (
    <div className={`p-5 sm:p-6 rounded-3xl border relative overflow-hidden transition-all shadow-xl ${
      isDark 
        ? 'bg-[#151822] border-[#252A3A]' 
        : 'bg-white border-slate-200'
    }`}>
      {notification && (
        <div className={`mb-4 p-3 rounded-2xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
          isDark
            ? 'bg-[#9F243C]/20 border-[#F59242]/40 text-[#F9DE97]'
            : 'bg-[#96183c]/10 border-[#96183c]/30 text-[#96183c]'
        }`}>
          <Sparkles className={`w-4 h-4 shrink-0 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6">
        
        {/* Coluna da Esquerda: Cronômetro & Status */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="relative">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border transition-all ${
              isRunning 
                ? (isPaused 
                    ? isDark ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-700' 
                    : isDark ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse' : 'bg-emerald-100 border-emerald-300 text-emerald-700 animate-pulse') 
                : isDark ? 'bg-[#9F243C]/20 border-[#F59242]/30 text-[#f89847]' : 'bg-[#96183c]/10 border-[#96183c]/25 text-[#96183c]'
            }`}>
              <Clock className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            {isRunning && (
              <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 ${isDark ? 'border-slate-900' : 'border-white'} ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
              }`} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isRunning 
                  ? (isPaused
                      ? isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-300'
                      : isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
                  : isDark
                  ? 'bg-[#9F243C]/20 text-[#F9DE97] border border-[#F59242]/30'
                  : 'bg-[#96183c]/10 text-[#96183c] border border-[#96183c]/25'
              }`}>
                {isRunning ? (isPaused ? '⏸️ Atividade em Pausa' : '⏱️ Rastreando em Tempo Real') : 'Timesheet Interativo'}
              </span>
              {startClockTime && isRunning && (
                <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Iniciado às {startClockTime}</span>
              )}
            </div>

            <div className={`font-mono text-3xl sm:text-4xl font-black tracking-tight mt-1 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {formatTime(elapsedSeconds)}
            </div>

            <div className={`text-xs mt-0.5 flex items-center gap-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {breakSeconds > 0 && (
                <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Pausa acumulada: {formatTime(breakSeconds)}</span>
              )}
              <span>• Prestação de Serviços PJ</span>
            </div>
          </div>
        </div>

        {/* Coluna Central: ID da Tarefa, Centro de Custo, Projeto e Descrição */}
        <div className="flex-1 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-3">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Hash className={`w-3 h-3 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                <span>ID da Tarefa:</span>
              </label>
              <input
                type="text"
                placeholder="Ex: TK-001, JIRA-12"
                value={taskCode}
                onChange={e => setTaskCode(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold border outline-none transition-all ${
                  isDark 
                    ? 'bg-black/40 border-white/10 text-[#F9DE97] placeholder-slate-500 focus:border-[#f89847]' 
                    : 'bg-white border-slate-300 text-[#96183c] placeholder-slate-400 focus:border-[#96183c]'
                }`}
              />
            </div>

            <div className="sm:col-span-4">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Building2 className={`w-3 h-3 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                <span>Centro de Custo:</span>
              </label>
              <input
                type="text"
                list="cost-centers-list"
                placeholder="Ex: CC-TI-01 • Tecnologia"
                value={costCenter}
                onChange={e => setCostCenter(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none transition-all ${
                  isDark 
                    ? 'bg-black/40 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
                }`}
              />
              <datalist id="cost-centers-list">
                {COST_CENTER_SUGGESTIONS.map((cc, i) => (
                  <option key={i} value={cc} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-5">
              <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Projeto ou Cliente Atendido:
              </label>
              <input
                type="text"
                placeholder="Ex: App Mobile, Cliente XPTO"
                value={project}
                onChange={e => setProject(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none transition-all ${
                  isDark 
                    ? 'bg-black/40 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Descrição da Tarefa Realizada:
            </label>
            <input
              type="text"
              placeholder="Ex: Desenvolvimento de API, ajuste de telas no Figma, reunião técnica..."
              value={taskDescription}
              onChange={e => setTaskDescription(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs sm:text-sm border outline-none transition-all ${
                isDark 
                  ? 'bg-black/40 border-white/10 text-white placeholder-slate-500 focus:border-[#f89847]' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#96183c]'
              }`}
            />
          </div>
        </div>

        {/* Coluna da Direita: Controles Play / Pause / Stop / Manual */}
        <div className="flex flex-wrap xl:flex-col items-center justify-end gap-2.5 shrink-0">
          {!isRunning ? (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleStartTimer}
                className="flex-1 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Iniciar Play ▶️</span>
              </button>

              <button
                onClick={handleOpenManualModal}
                className={`px-3.5 py-3 rounded-2xl font-bold text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
                }`}
                title="Inserir registro manual (Ex: trabalhado offline/Excel)"
              >
                <Plus className={`w-4 h-4 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                <span>Manual</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              {isPaused ? (
                <button
                  onClick={handleResumeTimer}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Retomar</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-amber-950 bg-amber-400 hover:bg-amber-300 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Pausa para almoço, descanso ou interrupção"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pausar</span>
                </button>
              )}

              <button
                onClick={handleOpenFinishModal}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                  boxShadow: '0 4px 16px rgba(100, 12, 30, 0.30)',
                }}
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Salvar & Concluir</span>
              </button>

              <button
                onClick={handleDiscardTimer}
                className={`p-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isDark ? 'text-rose-400 hover:bg-rose-500/20' : 'text-rose-600 hover:bg-rose-100'
                }`}
                title="Descartar cronômetro"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>

      {isFinishModalOpen && renderFinishModal()}
      {isManualModalOpen && renderManualModal()}
    </div>
  );

  // ==========================================================================
  // MODAL DE CONCLUSÃO DO TIMER (Permite revisar ID/Centro de Custo e adicionar links/prints)
  // ==========================================================================
  function renderFinishModal() {
    const rawHours = Math.max(0, elapsedSeconds) / 3600;
    const calculatedHours = Number((rawHours > 0 ? Math.max(0.01, rawHours) : 0.01).toFixed(2));
    const breakMins = Math.round(breakSeconds / 60);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
        <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 overflow-hidden ${
          isDark ? 'bg-[#151822] border-[#F59242]/30 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <h3 className="font-extrabold text-base">Salvar Atividade no Timesheet</h3>
            </div>
            <button 
              onClick={() => setIsFinishModalOpen(false)}
              className={`p-1 rounded-lg cursor-pointer ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Edição rápida de ID da Tarefa e Centro de Custo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>ID da Tarefa:</label>
                <input
                  type="text"
                  value={taskCode}
                  onChange={e => setTaskCode(e.target.value)}
                  placeholder="Ex: TK-001"
                  className={`w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold border outline-none ${
                    isDark ? 'border-white/10 bg-black/30 text-[#F9DE97]' : 'border-slate-300 bg-slate-50 text-[#96183c]'
                  }`}
                />
              </div>
              <div>
                <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Centro de Custo:</label>
                <input
                  type="text"
                  list="cost-centers-list"
                  value={costCenter}
                  onChange={e => setCostCenter(e.target.value)}
                  placeholder="Ex: CC-TI-01"
                  className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                    isDark ? 'border-white/10 bg-black/30 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Resumo da Atividade */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Projeto / Cliente:</span>
                <strong className={isDark ? 'text-[#F9DE97]' : 'text-[#96183c]'}>{project || 'Projeto Geral'}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Tarefa:</span>
                <strong className={isDark ? 'text-white' : 'text-slate-900'}>{taskDescription || 'Atividade executada no período'}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Horário:</span>
                <span className="font-mono">{startClockTime} até {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Pausas / Interrupções:</span>
                <span className={`font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{breakMins} minutos</span>
              </div>
              <div className={`flex items-center justify-between text-xs pt-1 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Duração Líquida Final:</span>
                <span className={`font-mono font-black text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {calculatedHours}h ({Math.max(1, Math.round(elapsedSeconds / 60))} min)
                </span>
              </div>
            </div>

            {/* Links de Comprovação */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <LinkIcon className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Links de Evidência (GitHub, Figma, Docs)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalLinks([...modalLinks, { title: '', url: '' }])}
                  className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    isDark ? 'text-[#f89847] hover:text-amber-300' : 'text-[#96183c] hover:text-[#640C1E]'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Link</span>
                </button>
              </div>

              <div className="space-y-2">
                {modalLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Título (ex: PR #42)"
                      value={link.title}
                      onChange={e => {
                        const updated = [...modalLinks];
                        updated[idx].title = e.target.value;
                        setModalLinks(updated);
                      }}
                      className={`w-1/3 px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                    <input
                      type="url"
                      placeholder="URL (https://...)"
                      value={link.url}
                      onChange={e => {
                        const updated = [...modalLinks];
                        updated[idx].url = e.target.value;
                        setModalLinks(updated);
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                    {modalLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setModalLinks(modalLinks.filter((_, i) => i !== idx))}
                        className="text-rose-500 p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Imagens e Prints de Comprovação */}
            <div>
              <label className={`text-xs font-bold flex items-center gap-1.5 mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <ImageIcon className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                <span>Capturas de Tela ou Comprovantes (Opcional)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border border-dashed flex items-center gap-1.5 cursor-pointer ${
                    isDark
                      ? 'border-[#F59242]/40 hover:bg-[#9F243C]/15 text-[#F9DE97]'
                      : 'border-[#96183c]/40 hover:bg-[#96183c]/10 text-[#96183c]'
                  }`}
                >
                  <Upload className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Anexar Prints</span>
                </button>

                {modalImages.map((img, iIdx) => (
                  <div key={iIdx} className={`relative w-12 h-12 rounded-xl overflow-hidden border group ${
                    isDark ? 'border-white/10' : 'border-slate-300'
                  }`}>
                    <img src={img} alt="print" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setModalImages(modalImages.filter((_, i) => i !== iIdx))}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setIsFinishModalOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Voltar ao Timer
            </button>
            <button
              type="button"
              onClick={handleConfirmFinish}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                boxShadow: '0 4px 16px rgba(100, 12, 30, 0.30)',
              }}
            >
              Salvar Entrada no Timesheet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MODAL DE ENTRADA MANUAL (Estilo Excel / Retroativo)
  // ==========================================================================
  function renderManualModal() {
    const [sh, sm] = manualStartTime.split(':').map(Number);
    const [eh, em] = manualEndTime.split(':').map(Number);
    let totalMins = (eh * 60 + em) - (sh * 60 + sm) - Number(manualBreakMinutes || 0);
    if (totalMins < 0) totalMins += 24 * 60;
    const computedHours = Number((Math.max(0.01, totalMins / 60)).toFixed(2));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
        <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 overflow-hidden ${
          isDark ? 'bg-[#151822] border-[#F59242]/30 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Plus className={`w-5 h-5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
              <h3 className="font-extrabold text-base">Novo Registro Manual de Timesheet</h3>
            </div>
            <button 
              onClick={() => setIsManualModalOpen(false)}
              className={`p-1 rounded-lg cursor-pointer ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveManualEntry} className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-bold flex items-center gap-1 mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Hash className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>ID da Tarefa*:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: TK-001, JIRA-402"
                  value={manualTaskCode}
                  onChange={e => setManualTaskCode(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                    isDark ? 'border-white/10 bg-black/20 text-[#F9DE97]' : 'border-slate-300 bg-slate-50 text-[#96183c]'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-bold flex items-center gap-1 mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Building2 className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Centro de Custo*:</span>
                </label>
                <input
                  type="text"
                  list="cost-centers-list"
                  placeholder="Ex: CC-TI-01 • Tecnologia"
                  value={manualCostCenter}
                  onChange={e => setManualCostCenter(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Data da Atividade:</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Projeto ou Cliente*:</label>
                <input
                  type="text"
                  placeholder="Ex: Cliente Alfa, Projeto Web"
                  value={manualProject}
                  onChange={e => setManualProject(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Descrição da Tarefa Realizada*:</label>
              <textarea
                placeholder="Descreva detalhadamente a entrega técnica ou atividade desempenhada..."
                value={manualTask}
                onChange={e => setManualTask(e.target.value)}
                rows={2}
                required
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none ${
                  isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              />
            </div>

            {/* Horários e Pausa */}
            <div className={`p-3 rounded-2xl border space-y-3 ${
              isDark ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Horário Início:</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={e => setManualStartTime(e.target.value)}
                    required
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                      isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Horário Término:</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={e => setManualEndTime(e.target.value)}
                    required
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                      isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pausa (minutos):</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualBreakMinutes}
                    onChange={e => setManualBreakMinutes(Number(e.target.value))}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs border outline-none ${
                      isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex items-center justify-between text-xs pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Total Líquido Calculado:</span>
                <span className={`font-mono font-extrabold text-sm ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`}>
                  {computedHours} horas líquidas
                </span>
              </div>
            </div>

            {/* Links e Evidências */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <LinkIcon className={`w-3.5 h-3.5 ${isDark ? 'text-[#f89847]' : 'text-[#96183c]'}`} />
                  <span>Links de Evidência</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalLinks([...modalLinks, { title: '', url: '' }])}
                  className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    isDark ? 'text-[#f89847] hover:text-amber-300' : 'text-[#96183c] hover:text-[#640C1E]'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar Link</span>
                </button>
              </div>

              <div className="space-y-2">
                {modalLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Título (ex: Figma)"
                      value={link.title}
                      onChange={e => {
                        const updated = [...modalLinks];
                        updated[idx].title = e.target.value;
                        setModalLinks(updated);
                      }}
                      className={`w-1/3 px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                    <input
                      type="url"
                      placeholder="URL (https://...)"
                      value={link.url}
                      onChange={e => {
                        const updated = [...modalLinks];
                        updated[idx].url = e.target.value;
                        setModalLinks(updated);
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark ? 'border-white/10 bg-black/20 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                  boxShadow: '0 4px 16px rgba(100, 12, 30, 0.30)',
                }}
              >
                Salvar no Timesheet
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
};
