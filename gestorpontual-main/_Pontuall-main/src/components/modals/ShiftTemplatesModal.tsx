import React, { useState } from 'react';
import { 
  Layers, 
  Copy, 
  Plus, 
  X, 
  Check, 
  Sparkles, 
  Lightbulb,
  CheckSquare
} from 'lucide-react';
import { Employee, Shift, ShiftTemplate, ShiftType } from '../../types';

export interface ShiftTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentWeekStart: Date;
  currentWeekShifts: Shift[];
  onApplyTemplate: (template: ShiftTemplate, selectedEmployeeIds: string[]) => void;
  onSaveNewTemplate?: (newTemplate: ShiftTemplate) => void;
  theme?: 'light' | 'dark';
}

export const INITIAL_SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Comercial Padrão (5x2)',
    category: 'Comercial',
    description: 'Segunda a Sexta das 08:00 às 17:00 com 1h de almoço (40h semanais)',
    days: [
      { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', type: 'regular', breakMinutes: 60, title: 'Comercial (5x2)' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', type: 'regular', breakMinutes: 60, title: 'Comercial (5x2)' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', type: 'regular', breakMinutes: 60, title: 'Comercial (5x2)' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', type: 'regular', breakMinutes: 60, title: 'Comercial (5x2)' },
      { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', type: 'regular', breakMinutes: 60, title: 'Comercial (5x2)' },
    ],
  },
  {
    id: 'tpl-2',
    name: 'Operacional 6x1 (Manhã)',
    category: 'Escala 6x1',
    description: 'Segunda a Sábado das 07:00 às 15:20 com 1h de almoço (44h semanais)',
    days: [
      { dayOfWeek: 1, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
      { dayOfWeek: 2, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
      { dayOfWeek: 3, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
      { dayOfWeek: 4, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
      { dayOfWeek: 5, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
      { dayOfWeek: 6, startTime: '07:00', endTime: '15:20', type: 'regular', breakMinutes: 60, title: 'Operacional 6x1' },
    ],
  },
  {
    id: 'tpl-12x36-a',
    name: 'Plantão 12x36 Diurno (Turma A)',
    category: 'Escala 12x36',
    description: 'Segunda, Quarta e Sexta das 07:00 às 19:00 com 1h de intervalo (36h semanais)',
    days: [
      { dayOfWeek: 1, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (A)' },
      { dayOfWeek: 3, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (A)' },
      { dayOfWeek: 5, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (A)' },
    ],
  },
  {
    id: 'tpl-12x36-b',
    name: 'Plantão 12x36 Diurno (Turma B)',
    category: 'Escala 12x36',
    description: 'Terça, Quinta, Sábado e Domingo das 07:00 às 19:00 (48h nesta semana)',
    days: [
      { dayOfWeek: 2, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (B)' },
      { dayOfWeek: 4, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (B)' },
      { dayOfWeek: 6, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (B)' },
      { dayOfWeek: 0, startTime: '07:00', endTime: '19:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Diurno (B)' },
    ],
  },
  {
    id: 'tpl-12x36-noturno',
    name: 'Plantão 12x36 Noturno (Turma A)',
    category: '12x36 Noturno',
    description: 'Segunda, Quarta e Sexta das 19:00 às 07:00 (Jornada Noturna com adicional)',
    days: [
      { dayOfWeek: 1, startTime: '19:00', endTime: '07:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Noturno' },
      { dayOfWeek: 3, startTime: '19:00', endTime: '07:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Noturno' },
      { dayOfWeek: 5, startTime: '19:00', endTime: '07:00', type: 'on_call', breakMinutes: 60, title: 'Plantão 12x36 Noturno' },
    ],
  },
  {
    id: 'tpl-3',
    name: 'Suporte N2 Tarde/Noite',
    category: 'Flexível',
    description: 'Segunda a Sexta das 13:00 às 22:00 com 1h de intervalo',
    days: [
      { dayOfWeek: 1, startTime: '13:00', endTime: '22:00', type: 'regular', breakMinutes: 60, title: 'Suporte N2' },
      { dayOfWeek: 2, startTime: '13:00', endTime: '22:00', type: 'regular', breakMinutes: 60, title: 'Suporte N2' },
      { dayOfWeek: 3, startTime: '13:00', endTime: '22:00', type: 'regular', breakMinutes: 60, title: 'Suporte N2' },
      { dayOfWeek: 4, startTime: '13:00', endTime: '22:00', type: 'regular', breakMinutes: 60, title: 'Suporte N2' },
      { dayOfWeek: 5, startTime: '13:00', endTime: '22:00', type: 'regular', breakMinutes: 60, title: 'Suporte N2' },
    ],
  },
  {
    id: 'tpl-4',
    name: 'Plantão Final de Semana',
    category: 'Plantão',
    description: 'Sábado e Domingo das 08:00 às 20:00 (12h de cobertura)',
    days: [
      { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', type: 'on_call', breakMinutes: 60, title: 'Plantão Fim de Semana' },
      { dayOfWeek: 0, startTime: '08:00', endTime: '20:00', type: 'on_call', breakMinutes: 60, title: 'Plantão Fim de Semana' },
    ],
  },
];

export const ShiftTemplatesModal: React.FC<ShiftTemplatesModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentWeekStart,
  currentWeekShifts,
  onApplyTemplate,
  onSaveNewTemplate,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';

  // Active Tab: 'apply' | 'save'
  const [activeTab, setActiveTab] = useState<'apply' | 'save'>('apply');

  // Templates list
  const [templates, setTemplates] = useState<ShiftTemplate[]>(INITIAL_SHIFT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-4');

  // Selected collaborators (defaults to all employees selected)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() => 
    employees.map(e => e.id)
  );

  // New Template Form States
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('Personalizado');

  // Feedback banner state
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Toggle single employee
  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
    );
  };

  // Toggle all employees
  const handleToggleAllEmployees = () => {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map(e => e.id));
    }
  };

  // Apply template action
  const handleApply = () => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    if (selectedEmployeeIds.length === 0) {
      alert('Selecione pelo menos um colaborador para aplicar o template.');
      return;
    }

    onApplyTemplate(tpl, selectedEmployeeIds);
    setFeedbackMessage(`Template "${tpl.name}" aplicado com sucesso para ${selectedEmployeeIds.length} colaboradores!`);
    setTimeout(() => {
      setFeedbackMessage(null);
      onClose();
    }, 1200);
  };

  // Save new template action
  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    // Build day patterns from current week shifts or default
    const dayMap = new Map<number, { startTime: string; endTime: string; type: ShiftType; breakMinutes?: number; title?: string }>();
    
    if (currentWeekShifts && currentWeekShifts.length > 0) {
      currentWeekShifts.forEach(s => {
        try {
          const shiftDate = new Date(s.date + 'T00:00:00');
          const dayOfWeek = shiftDate.getDay();
          if (!dayMap.has(dayOfWeek)) {
            dayMap.set(dayOfWeek, {
              startTime: s.startTime,
              endTime: s.endTime,
              type: s.type,
              breakMinutes: s.breakMinutes || 60,
              title: s.title || newTemplateName.trim(),
            });
          }
        } catch {
          // ignore date parse issue
        }
      });
    }

    // If no shifts were found in current week, default to Monday-Friday 09:00 - 18:00
    const days = dayMap.size > 0 
      ? Array.from(dayMap.entries()).map(([dayOfWeek, cfg]) => ({
          dayOfWeek,
          ...cfg,
        }))
      : [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', type: 'regular' as ShiftType, breakMinutes: 60, title: newTemplateName.trim() },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', type: 'regular' as ShiftType, breakMinutes: 60, title: newTemplateName.trim() },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', type: 'regular' as ShiftType, breakMinutes: 60, title: newTemplateName.trim() },
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', type: 'regular' as ShiftType, breakMinutes: 60, title: newTemplateName.trim() },
          { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', type: 'regular' as ShiftType, breakMinutes: 60, title: newTemplateName.trim() },
        ];

    const newTemplate: ShiftTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      category: newTemplateCategory || 'Personalizado',
      description: newTemplateDesc.trim() || 'Template criado a partir da configuração de escala.',
      days,
    };

    setTemplates(prev => [newTemplate, ...prev]);
    setSelectedTemplateId(newTemplate.id);
    if (onSaveNewTemplate) {
      onSaveNewTemplate(newTemplate);
    }

    setNewTemplateName('');
    setNewTemplateDesc('');
    setActiveTab('apply');
    setFeedbackMessage(`Novo template "${newTemplate.name}" salvo com sucesso!`);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2500);
  };

  const getBadgeStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case 'comercial':
        return isDark 
          ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.35)', dot: '#60a5fa' }
          : { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#2563eb' };
      case 'escala 6x1':
        return isDark 
          ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.35)', dot: '#34d399' }
          : { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', dot: '#059669' };
      case 'escala 12x36':
      case '12x36':
        return isDark 
          ? { bg: 'rgba(245, 146, 66, 0.18)', text: '#f9de97', border: 'rgba(245, 146, 66, 0.45)', dot: '#f59242' }
          : { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#ea580c' };
      case '12x36 noturno':
        return isDark 
          ? { bg: 'rgba(168, 85, 247, 0.20)', text: '#e9d5ff', border: 'rgba(168, 85, 247, 0.45)', dot: '#c084fc' }
          : { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff', dot: '#9333ea' };
      case 'flexível':
        return isDark 
          ? { bg: 'rgba(249, 222, 151, 0.15)', text: '#f9de97', border: 'rgba(249, 222, 151, 0.35)', dot: '#f9de97' }
          : { bg: '#fefce8', text: '#854d0e', border: '#fef08a', dot: '#ca8a04' };
      case 'plantão':
        return isDark 
          ? { bg: 'rgba(159, 36, 60, 0.25)', text: '#fca5a5', border: 'rgba(159, 36, 60, 0.5)', dot: '#f87171' }
          : { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3', dot: '#e11d48' };
      default:
        return isDark 
          ? { bg: 'rgba(245, 146, 66, 0.15)', text: '#f9de97', border: 'rgba(245, 146, 66, 0.3)', dot: '#f59242' }
          : { bg: '#fef3c7', text: '#b45309', border: '#fde68a', dot: '#d97706' };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto transition-all ${
          isDark 
            ? 'bg-[#15161c] text-white' 
            : 'bg-white text-slate-800'
        }`}
        style={{
          border: isDark ? '1px solid rgba(150, 24, 60, 0.4)' : '1px solid #E8DCCB',
          boxShadow: isDark 
            ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(248, 152, 71, 0.15)' 
            : '0 20px 40px -10px rgba(100, 12, 30, 0.15)',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de destaque superior com gradiente de assinatura da marca */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #96183c, #f89847, #faf0ac)" }} />

        {/* ============================================================
            CABEÇALHO NO ESTILO DA MARCA (Wine -> Amber Glow)
            ============================================================ */}
        <div 
          className={`p-4 sm:p-5 flex items-center justify-between relative overflow-hidden border-b ${
            isDark ? 'border-white/10' : 'border-[#E8DCCB]'
          }`}
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, #190a12 0%, #170d18 50%, #20101c 100%)' 
              : 'linear-gradient(135deg, #FFFDF8 0%, #FCFAF5 100%)',
          }}
        >
          {/* Luz de destaque suave no cabeçalho */}
          <div 
            className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: isDark
                ? 'radial-gradient(circle, rgba(245, 146, 66, 0.22) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(245, 146, 66, 0.12) 0%, transparent 70%)',
              filter: 'blur(30px)'
            }}
          />

          <div className="flex items-center gap-3.5 relative z-10">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
              style={{
                background: 'linear-gradient(135deg, #96183c 0%, #f89847 100%)',
                border: '1px solid rgba(249, 222, 151, 0.35)',
                color: '#ffffff'
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight leading-tight ${
                isDark ? 'text-white' : 'text-[#640C1E]'
              }`}>
                Templates de Escalas & Replicar Semanas
              </h2>
              <p className={`text-xs font-normal mt-0.5 ${
                isDark ? 'text-[#F9DE97]/80' : 'text-[#9F243C]/80'
              }`}>
                Padronize escalas e replique turnos para o futuro em 1 clique
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer relative z-10 ${
              isDark 
                ? 'text-slate-400 hover:text-white hover:bg-white/10' 
                : 'text-slate-500 hover:text-[#640C1E] hover:bg-[#F9DE97]/30'
            }`}
            title="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ============================================================
            NAV TABS: "Aplicar Template Existente" & "+ Salvar Semana Atual como Novo"
            ============================================================ */}
        <div className={`flex items-center border-b px-4 sm:px-6 pt-1 ${
          isDark 
            ? 'bg-[#121318] border-white/10' 
            : 'bg-[#FFFDF8] border-[#E8DCCB]'
        }`}>
          <button
            onClick={() => setActiveTab('apply')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'apply'
                ? isDark
                  ? 'border-[#F59242] text-[#F9DE97]'
                  : 'border-[#9F243C] text-[#640C1E]'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-[#640C1E]'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Aplicar Template Existente</span>
          </button>

          <button
            onClick={() => setActiveTab('save')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'save'
                ? isDark
                  ? 'border-[#F59242] text-[#F9DE97]'
                  : 'border-[#9F243C] text-[#640C1E]'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-[#640C1E]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Salvar Semana Atual como Novo</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {feedbackMessage && (
          <div className={`mx-5 mt-4 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            isDark 
              ? 'bg-[#F59242]/15 border border-[#F59242]/35 text-[#F9DE97]' 
              : 'bg-[#F9DE97]/30 border border-[#F59242]/40 text-[#640C1E]'
          }`}>
            <Sparkles className="w-4 h-4 text-[#F59242] shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* ============================================================
            TAB 1: APLICAR TEMPLATE EXISTENTE
            ============================================================ */}
        {activeTab === 'apply' && (
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-160px)]">
            
            {/* 1. Escolha o Template */}
            <div className="space-y-2.5">
              <label className={`text-[11px] font-bold font-mono tracking-wider block uppercase ${
                isDark ? 'text-[#F9DE97]/90' : 'text-[#640C1E]/80'
              }`}>
                1. ESCOLHA O TEMPLATE
              </label>

              <div className="space-y-2">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  const badge = getBadgeStyle(tpl.category);

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 select-none ${
                        isSelected
                          ? isDark
                            ? 'bg-[#24171d]/75 border-[#F59242] shadow-md shadow-[#9F243C]/20 border-l-4 border-l-[#F59242]'
                            : 'bg-[#FFF9F3] border-[#9F243C] shadow-xs border-l-4 border-l-[#9F243C]'
                          : isDark
                            ? 'bg-[#181922] border-[#282a33] hover:border-[#F59242]/40 hover:bg-[#1f202b]'
                            : 'bg-white border-[#E8DCCB] hover:border-[#9F243C]/40 hover:bg-[#FFFDF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-xs ${
                          isSelected 
                            ? isDark ? 'text-[#F9DE97]' : 'text-[#640C1E] font-extrabold' 
                            : isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          {tpl.name}
                        </span>

                        <span 
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 uppercase tracking-wider flex items-center gap-1.5"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: badge.dot }}
                          />
                          <span>{tpl.category}</span>
                        </span>
                      </div>

                      <p className={`text-[11px] leading-relaxed ${
                        isSelected
                          ? isDark ? 'text-slate-300' : 'text-slate-700'
                          : isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {tpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Selecionar Colaboradores */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className={`text-[11px] font-bold font-mono tracking-wider block uppercase ${
                  isDark ? 'text-[#F9DE97]/90' : 'text-[#640C1E]/80'
                }`}>
                  2. SELECIONAR COLABORADORES ({selectedEmployeeIds.length}/{employees.length})
                </label>

                <button
                  type="button"
                  onClick={handleToggleAllEmployees}
                  className={`text-xs font-bold transition-colors cursor-pointer ${
                    isDark ? 'text-[#F59242] hover:text-[#F9DE97]' : 'text-[#9F243C] hover:text-[#640C1E]'
                  }`}
                >
                  {selectedEmployeeIds.length === employees.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
              </div>

              {/* Grid 2 Colunas de Colaboradores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {employees.map((emp) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer select-none ${
                        isChecked
                          ? isDark
                            ? 'bg-[#24171d]/75 border-[#F59242] shadow-xs'
                            : 'bg-[#FFF9F3] border-[#9F243C] shadow-xs'
                          : isDark
                            ? 'bg-[#181922] border-[#282a33] opacity-65 hover:opacity-100 hover:border-white/20'
                            : 'bg-white border-[#E8DCCB] opacity-70 hover:opacity-100 hover:border-[#9F243C]/40'
                      }`}
                    >
                      {/* Checkbox Styled */}
                      <div 
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? 'text-white'
                            : isDark ? 'border border-slate-600 bg-black/40' : 'border border-[#E8DCCB] bg-white'
                        }`}
                        style={isChecked ? { background: 'linear-gradient(135deg, #96183c, #f89847)' } : undefined}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <img 
                        src={emp.avatar} 
                        alt={emp.name} 
                        className={`w-6 h-6 rounded-full object-cover shrink-0 transition-all ${
                          isChecked ? 'ring-2 ring-[#F59242]/70' : 'ring-1 ring-white/10'
                        }`}
                      />

                      <span className={`text-xs font-semibold truncate ${
                        isChecked
                          ? isDark ? 'text-[#F9DE97]' : 'text-[#640C1E]'
                          : isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {emp.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`flex items-center justify-end gap-3 pt-3 border-t ${
              isDark ? 'border-white/10' : 'border-[#E8DCCB]'
            }`}>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-[#640C1E] hover:bg-[#F9DE97]/25'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{
                  background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                  color: '#F9DE97',
                  boxShadow: '0 4px 18px rgba(100, 12, 30, 0.45)'
                }}
              >
                <Sparkles className="w-4 h-4 fill-[#F9DE97]/30" />
                <span>Aplicar na Semana</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: SALVAR SEMANA ATUAL COMO NOVO
            ============================================================ */}
        {activeTab === 'save' && (
          <form 
            onSubmit={handleSaveTemplateSubmit}
            className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-160px)]"
          >
            {/* Box "Como Funciona" com Lâmpada */}
            <div 
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                isDark 
                  ? 'bg-[#24171d]/75 border-[#F59242]/35' 
                  : 'bg-[#FFF9F3] border-[#F59242]/35'
              }`}
            >
              <span className="text-base select-none shrink-0 mt-0.5">💡</span>
              <div className="space-y-1">
                <span className={`block font-bold text-xs ${
                  isDark ? 'text-[#F9DE97]' : 'text-[#640C1E]'
                }`}>
                  Como funciona:
                </span>
                <p className={`text-xs leading-relaxed ${
                  isDark ? 'text-[#F9DE97]/80' : 'text-[#640C1E]/80'
                }`}>
                  A configuração de dias e horários desta semana será salva como um modelo reutilizável, permitindo replicar instantaneamente para outras semanas e novos colaboradores.
                </p>
              </div>
            </div>

            {/* Input: Nome do Template */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold font-mono tracking-wider block uppercase ${
                isDark ? 'text-[#F9DE97]/90' : 'text-[#640C1E]/80'
              }`}>
                NOME DO TEMPLATE
              </label>
              <input
                type="text"
                required
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Ex: Escala Atendimento Padrão 40h"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all ${
                  isDark
                    ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242] focus:ring-2 focus:ring-[#F59242]/20'
                    : 'bg-white border border-[#E8DCCB] text-slate-900 placeholder:text-slate-400 focus:border-[#9F243C] focus:ring-2 focus:ring-[#9F243C]/15'
                }`}
              />
            </div>

            {/* Input: Categoria / Tag */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold font-mono tracking-wider block uppercase ${
                isDark ? 'text-[#F9DE97]/90' : 'text-[#640C1E]/80'
              }`}>
                CATEGORIA / IDENTIFICADOR
              </label>
              <select
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none cursor-pointer transition-all ${
                  isDark
                    ? 'bg-[#0e0f12] border border-[#282a33] text-white focus:border-[#F59242] focus:ring-2 focus:ring-[#F59242]/20'
                    : 'bg-white border border-[#E8DCCB] text-slate-900 focus:border-[#9F243C] focus:ring-2 focus:ring-[#9F243C]/15'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              >
                <option value="Comercial">Comercial</option>
                <option value="Escala 6x1">Escala 6x1</option>
                <option value="Escala 12x36">Escala 12x36</option>
                <option value="12x36 Noturno">12x36 Noturno</option>
                <option value="Flexível">Flexível</option>
                <option value="Plantão">Plantão</option>
                <option value="Personalizado">Personalizado</option>
              </select>
            </div>

            {/* Textarea: Descrição / Observações */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold font-mono tracking-wider block uppercase ${
                isDark ? 'text-[#F9DE97]/90' : 'text-[#640C1E]/80'
              }`}>
                DESCRIÇÃO / OBSERVAÇÕES
              </label>
              <textarea
                rows={3}
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                placeholder="Ex: Utilizado para equipe de Suporte no período matutino."
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all resize-none ${
                  isDark
                    ? 'bg-[#0e0f12] border border-[#282a33] text-white placeholder:text-slate-500 focus:border-[#F59242] focus:ring-2 focus:ring-[#F59242]/20'
                    : 'bg-white border border-[#E8DCCB] text-slate-900 placeholder:text-slate-400 focus:border-[#9F243C] focus:ring-2 focus:ring-[#9F243C]/15'
                }`}
              />
            </div>

            {/* Footer Buttons */}
            <div className={`flex items-center justify-end gap-3 pt-3 border-t ${
              isDark ? 'border-white/10' : 'border-[#E8DCCB]'
            }`}>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-[#640C1E] hover:bg-[#F9DE97]/25'
                }`}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                style={{
                  background: 'linear-gradient(90deg, #640C1E 0%, #9F243C 55%, #F59242 100%)',
                  color: '#F9DE97',
                  boxShadow: '0 4px 18px rgba(100, 12, 30, 0.45)'
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Template</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
