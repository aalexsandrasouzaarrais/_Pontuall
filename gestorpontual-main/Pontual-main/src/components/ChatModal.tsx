import React, { useState } from 'react';
import { X, Send, MessageSquare, Sparkles, User } from 'lucide-react';
import { Employee } from '../types';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmployee: Employee;
  isLightTheme?: boolean;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  senderAvatar: string;
  isMe: boolean;
  text: string;
  timestamp: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentEmployee,
  isLightTheme = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      senderName: 'Camila Duarte',
      senderRole: 'Gerente de Escalas',
      senderAvatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
      isMe: false,
      text: 'Olá equipe! A escala semanal já está disponível no portal. Por favor confirmem seus horários e avisem caso haja qualquer divergência.',
      timestamp: '09:00'
    },
    {
      id: 'm-2',
      senderName: 'Lucas Silva',
      senderRole: 'Analista de Atendimento',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isMe: currentEmployee.id === 'emp-1',
      text: 'Bom dia Camila! Escala conferida e ponto batido com sucesso via GPS.',
      timestamp: '09:05'
    },
    {
      id: 'm-3',
      senderName: 'Beatriz Santos',
      senderRole: 'Especialista de Suporte',
      senderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      isMe: currentEmployee.id === 'emp-2',
      text: 'Conferido também! Qualquer dúvida aviso por aqui.',
      timestamp: '09:12'
    }
  ]);

  const [inputMsg, setInputMsg] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderName: currentEmployee.name,
      senderRole: currentEmployee.role,
      senderAvatar: currentEmployee.avatar,
      isMe: true,
      text: inputMsg,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMsg]);
    setInputMsg('');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isLightTheme ? 'bg-slate-900/40 backdrop-blur-xs' : 'bg-black/70 backdrop-blur-md'
    } animate-in fade-in duration-200`}>
      <div className={`rounded-2xl shadow-2xl max-w-lg w-full border overflow-hidden flex flex-col h-[600px] max-h-[90vh] transition-colors ${
        isLightTheme ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#13141B] border-white/10 text-slate-100'
      }`}>
        {/* Top Highlight Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#96183C] via-[#F89847] to-[#FCEABB]"></div>

        {/* Header */}
        <div className="px-4 py-3 text-white flex items-center justify-between shadow-xs" style={{ background: 'linear-gradient(to right, #96183c, #f89642)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
              <MessageSquare className="w-4 h-4 text-[#faf0ac]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">Chat da Equipe & Gestão</h3>
              <p className="text-[10px] text-[#faf0ac]/80">Comunicação direta em tempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Area */}
        <div className={`flex-1 p-4 overflow-y-auto space-y-3 transition-colors ${
          isLightTheme ? 'bg-slate-50' : 'bg-[#0B0C10]'
        }`}>
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <img
                src={msg.senderAvatar}
                alt={msg.senderName}
                className={`w-7 h-7 rounded-full object-cover shrink-0 ring-1 ${
                  isLightTheme ? 'ring-slate-300' : 'ring-white/20'
                }`}
              />
              <div className={`max-w-[75%] rounded-xl p-2.5 text-xs shadow-2xs ${
                msg.isMe
                  ? 'text-white rounded-tr-none'
                  : (isLightTheme
                      ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      : 'bg-[#1C1D26] text-slate-200 border border-white/10 rounded-tl-none')
              }`} style={msg.isMe ? { background: 'linear-gradient(135deg, #96183c, #f89642)' } : {}}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`font-bold text-[10px] ${
                    msg.isMe ? 'text-white' : (isLightTheme ? 'text-slate-900' : 'text-white')
                  }`}>
                    {msg.senderName}
                  </span>
                  <span className={`text-[9px] font-mono ${
                    msg.isMe ? 'text-[#faf0ac]/80' : (isLightTheme ? 'text-slate-400' : 'text-slate-400')
                  }`}>
                    {msg.timestamp}
                  </span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className={`p-3 border-t flex items-center gap-2 transition-colors ${
          isLightTheme ? 'bg-white border-slate-200' : 'bg-[#13141B] border-white/10'
        }`}>
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Digite uma mensagem para a equipe..."
            className={`flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors border ${
              isLightTheme
                ? 'bg-slate-100 border-slate-300 text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#96183c]'
                : 'bg-[#1F202B] border-white/10 text-white placeholder-slate-400 focus:ring-1 focus:ring-[#f89642]'
            }`}
          />
          <button
            type="submit"
            className="p-2 text-white hover:brightness-110 rounded-lg shadow-xs transition-colors cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #96183c, #f89642)' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
