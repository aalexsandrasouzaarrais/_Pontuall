import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus } from 'lucide-react';
import {
  PjNoteItem,
  getPjNotesLocal,
  syncPjNotesFromSupabase,
  savePjNotesToSupabase,
} from '@/modules/attendance/services/pjNotesService';
import papelVinho from '@/assets/notas/papel-vinho.jpg';
import papelLaranja from '@/assets/notas/papel-laranja.jpg';
import papelAmarelo from '@/assets/notas/papel-amarelo.jpg';
import './PjNotepadSection.css';

interface PjNotepadSectionProps {
  employeeId: string;
  isDark: boolean;
}

function escapeHtml(texto = ''): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizarConteudoNota(conteudo = ''): string {
  if (!conteudo) return '';
  const pareceHtml = /<\/?[a-z][\s\S]*>/i.test(conteudo);
  if (pareceHtml) return conteudo;
  return escapeHtml(conteudo).replace(/\n/g, '<br>');
}

function formatarData(dataIso: string): string {
  try {
    const data = new Date(dataIso);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'agora';
  }
}

interface PjNoteCardProps {
  nota: PjNoteItem;
  autoFocusTitle?: boolean;
  onUpdate: (id: string, patch: { titulo?: string; texto?: string }) => void;
  onDelete: (id: string) => void;
}

const PjNoteCard: React.FC<PjNoteCardProps> = ({
  nota,
  autoFocusTitle,
  onUpdate,
  onDelete,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [isListActive, setIsListActive] = useState(false);
  const [statusSalvo, setStatusSalvo] = useState('Salvo');

  useEffect(() => {
    if (editorRef.current) {
      const normalized = normalizarConteudoNota(nota.texto);
      if (editorRef.current.innerHTML !== normalized) {
        editorRef.current.innerHTML = normalized;
      }
      if (editorRef.current.textContent?.trim() === '' && !editorRef.current.querySelector('li')) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [nota.id]);

  useEffect(() => {
    if (autoFocusTitle && titleRef.current) {
      titleRef.current.focus();
    }
  }, [autoFocusTitle]);

  const placeCursorAtEnd = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const checkListState = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setIsListActive(Boolean(editorRef.current.querySelector('ul')));
      return;
    }
    const anchor = sel.anchorNode;
    if (!anchor || !editorRef.current.contains(anchor)) {
      setIsListActive(Boolean(editorRef.current.querySelector('ul')));
      return;
    }
    let el: Node | null = anchor.nodeType === 1 ? anchor : anchor.parentElement;
    let foundUl = false;
    while (el && el !== editorRef.current) {
      if ((el as HTMLElement).tagName === 'UL') {
        foundUl = true;
        break;
      }
      el = el.parentElement;
    }
    setIsListActive(foundUl);
  };

  const handleToggleList = (e: React.MouseEvent) => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const hasExistingList = Boolean(editor.querySelector('ul'));
    const plainText = editor.innerText || editor.textContent || '';

    // Caso 1: Editor está vazio -> cria imediatamente a lista com o pontinho (•)
    if (!hasExistingList && plainText.trim() === '') {
      editor.innerHTML = '<ul><li><br></li></ul>';
      const li = editor.querySelector('li');
      if (li) placeCursorAtEnd(li);
      setIsListActive(true);
      setStatusSalvo('Salvo agora');
      onUpdate(nota.id, { texto: editor.innerHTML });
      return;
    }

    // Caso 2: Tenta alternar via execCommand se o cursor estiver dentro do editor
    const selecao = window.getSelection();
    const dentroDoEditor =
      selecao && selecao.rangeCount > 0 && editor.contains(selecao.anchorNode);

    if (!dentroDoEditor) {
      placeCursorAtEnd(editor);
    }

    const beforeHtml = editor.innerHTML;
    document.execCommand('insertUnorderedList', false);

    // Fallback garantido caso o navegador não tenha convertido o texto em <ul><li>
    if (editor.innerHTML === beforeHtml) {
      if (hasExistingList) {
        // Remove a lista mantendo as linhas
        const items = Array.from(editor.querySelectorAll('li')).map(
          (li) => escapeHtml(li.textContent || '')
        );
        editor.innerHTML = items.join('<br>');
      } else {
        const lines = plainText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const listItems =
          lines.length > 0
            ? lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')
            : '<li><br></li>';
        editor.innerHTML = `<ul>${listItems}</ul>`;
      }
      const lastLi = editor.querySelector('li:last-child') as HTMLElement | null;
      if (lastLi) {
        placeCursorAtEnd(lastLi);
      } else {
        placeCursorAtEnd(editor);
      }
    }

    if (editor.textContent?.trim() === '' && !editor.querySelector('li')) {
      editor.innerHTML = '';
    }

    setStatusSalvo('Salvo agora');
    onUpdate(nota.id, { texto: editor.innerHTML });
    checkListState();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const editor = editorRef.current;
    if (!editor) return;

    const selecao = window.getSelection();
    if (!selecao || !selecao.rangeCount) return;

    const no = selecao.anchorNode;
    const element = no?.nodeType === 1 ? (no as HTMLElement) : no?.parentElement;
    const itemLista = element?.closest ? element.closest('li') : null;

    if (itemLista && editor.contains(itemLista) && itemLista.textContent?.trim() === '') {
      e.preventDefault();
      document.execCommand('insertUnorderedList', false);
      setStatusSalvo('Salvo agora');
      onUpdate(nota.id, { texto: editor.innerHTML });
      checkListState();
    }
  };

  const handleEditorInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.textContent?.trim() === '' && !editor.querySelector('li')) {
      editor.innerHTML = '';
    }
    setStatusSalvo('Salvo agora');
    onUpdate(nota.id, { texto: editor.innerHTML });
    checkListState();
  };

  return (
    <article className="pj-nota">
      <div className="pj-espiral" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className="pj-nota-conteudo">
        <div className="pj-nota-topo">
          <span className="pj-indicador" aria-hidden="true"></span>
          <input
            ref={titleRef}
            className="pj-titulo"
            type="text"
            maxLength={80}
            placeholder="Título da nota"
            value={nota.titulo}
            onChange={(e) => {
              setStatusSalvo('Salvo agora');
              onUpdate(nota.id, { titulo: e.target.value });
            }}
          />
          <button
            className="pj-excluir"
            type="button"
            title="Excluir nota"
            aria-label="Excluir nota"
            onClick={() => onDelete(nota.id)}
          >
            ×
          </button>
        </div>

        <div className="pj-ferramentas-nota">
          <button
            className={`pj-botao-lista ${isListActive ? 'ativo' : ''}`}
            type="button"
            title="Transformar em lista com tópicos"
            aria-label="Transformar em lista com tópicos"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleList}
          >
            • Lista
          </button>
        </div>

        <div
          ref={editorRef}
          className="pj-texto pj-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder="Escreva aqui suas ideias..."
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={checkListState}
          onMouseUp={checkListState}
        />

        <div className="pj-nota-rodape">
          <span className="pj-data">Editado: {formatarData(nota.atualizadoEm)}</span>
          <span className="pj-salvo">{statusSalvo}</span>
        </div>
      </div>
    </article>
  );
};

export const PjNotepadSection: React.FC<PjNotepadSectionProps> = ({
  employeeId,
  isDark,
}) => {
  const [notas, setNotas] = useState<PjNoteItem[]>(() => getPjNotesLocal(employeeId));
  const [newestNoteId, setNewestNoteId] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const local = getPjNotesLocal(employeeId);
    setNotas(local);
    syncPjNotesFromSupabase(employeeId).then((synced) => {
      if (mounted) setNotas(synced);
    });
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const persistNotes = (updated: PjNoteItem[]) => {
    setNotas(updated);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      savePjNotesToSupabase(employeeId, updated);
    }, 350);
  };

  const handleNovaNota = () => {
    const newId = `nota-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nova: PjNoteItem = {
      id: newId,
      titulo: '',
      texto: '',
      atualizadoEm: new Date().toISOString(),
    };
    setNewestNoteId(newId);
    persistNotes([...notas, nova]);
  };

  const handleUpdateNota = (id: string, patch: { titulo?: string; texto?: string }) => {
    const updated = notas.map((n) =>
      n.id === id
        ? {
            ...n,
            ...patch,
            atualizadoEm: new Date().toISOString(),
          }
        : n
    );
    persistNotes(updated);
  };

  const handleDeleteNota = (id: string) => {
    const updated = notas.filter((n) => n.id !== id);
    persistNotes(updated);
  };

  return (
    <section
      className={`rounded-3xl border p-5 sm:p-7 space-y-6 transition-colors ${
        isDark
          ? 'bg-[#121622] border-white/10'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      {/* Topo do Bloco de Notas (Estilo Imagem de Referência 1 com espaçamento adequado) */}
      <div className="pj-bloco-notas-wrapper flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #f89847, #96183c)' }}
          >
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#2c1d18]'}`}>
              Meu Bloco de Notas
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNovaNota}
          className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-black text-white shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          style={{
            background: 'linear-gradient(135deg, #96183c, #b32047)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Nova nota</span>
        </button>
      </div>

      {/* Quadro de Notas com Texturas e Presilhas */}
      <div
        className="pj-bloco-notas-wrapper pt-2 sm:pt-4"
        style={
          {
            '--tex-vinho': `url(${papelVinho})`,
            '--tex-laranja': `url(${papelLaranja})`,
            '--tex-amarelo': `url(${papelAmarelo})`,
          } as React.CSSProperties
        }
      >
        <div className="pj-quadro-notas" aria-live="polite">
          {notas.length === 0 ? (
            <div
              className={`pj-vazio ${
                isDark ? 'bg-white/[0.03] text-slate-300' : 'bg-[#fffaf2] text-[#2c1d18]'
              }`}
            >
              <h4 className="font-bold text-base mb-1">Seu bloco está vazio</h4>
              <p className="text-xs opacity-80">
                Clique em <strong>+ Nova nota</strong> para começar a anotar.
              </p>
            </div>
          ) : (
            notas.map((nota) => (
              <PjNoteCard
                key={nota.id}
                nota={nota}
                autoFocusTitle={nota.id === newestNoteId}
                onUpdate={handleUpdateNota}
                onDelete={handleDeleteNota}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
};
