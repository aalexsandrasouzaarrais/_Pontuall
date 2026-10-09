import { supabase } from '@/shared/services/supabase';

export interface ChatAttachment {
  type: 'image' | 'file';
  name: string;
  url: string;
  size?: string;
}

export interface ParsedChatPayload {
  text: string;
  attachment?: ChatAttachment | null;
}

/**
 * Converte e otimiza um arquivo de imagem para Base64 compacto (máx 1200px, JPEG 0.8)
 * garantindo salvamento direto no banco de dados com alta performance.
 */
export async function compressImageFile(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          type: 'file',
          name: file.name,
          url: reader.result as string,
          size: formatBytes(file.size),
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            type: 'image',
            name: file.name,
            url: e.target?.result as string,
            size: formatBytes(file.size),
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        const stringLength = dataUrl.length - 'data:image/jpeg;base64,'.length;
        const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.562489633438344;

        resolve({
          type: 'image',
          name: file.name,
          url: dataUrl,
          size: formatBytes(sizeInBytes),
        });
      };
      img.onerror = () => {
        resolve({
          type: 'image',
          name: file.name,
          url: e.target?.result as string,
          size: formatBytes(file.size),
        });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converte mensagem do banco de dados:
 * 1. Prioriza a coluna dedicada 'attachment' caso exista
 * 2. Faz fallback transparente caso tenha sido gravado no campo 'text'
 */
export function parseChatMessage(rawText: string, rawAttachment?: any | null): ParsedChatPayload {
  // 1. Se veio pela coluna dedicada 'attachment'
  if (rawAttachment) {
    if (typeof rawAttachment === 'object' && rawAttachment.url) {
      return {
        text: rawText || '',
        attachment: rawAttachment,
      };
    }
    if (typeof rawAttachment === 'string' && rawAttachment.trim().startsWith('{')) {
      try {
        const parsedAtt = JSON.parse(rawAttachment);
        return {
          text: rawText || '',
          attachment: parsedAtt,
        };
      } catch {}
    }
  }

  // 2. Se não veio em rawAttachment, verifica se está embutido no rawText
  if (!rawText) return { text: '' };

  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('"attachment"') || trimmed.includes('"url"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        text: parsed.text || '',
        attachment: parsed.attachment || null,
      };
    } catch {}
  }

  return { text: rawText };
}

/**
 * Serializa texto e anexo para formato de fallback
 */
export function serializeChatMessage(text: string, attachment?: ChatAttachment | null): string {
  if (!attachment) {
    return text.trim();
  }

  return JSON.stringify({
    text: text.trim(),
    attachment: {
      type: attachment.type,
      name: attachment.name,
      url: attachment.url,
      size: attachment.size,
    },
  });
}

/**
 * Salva a mensagem no Supabase priorizando a coluna dedicada 'attachment'.
 * Se a coluna 'attachment' não existir no banco do usuário ainda, faz o fallback
 * automático e salva no campo 'text' para nunca quebrar a experiência.
 */
export async function sendChatMessageToSupabase(params: {
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar: string;
  text: string;
  attachment?: ChatAttachment | null;
  channel?: string;
  recipient_id?: string | null;
}): Promise<{ error: any }> {
  // Se tem anexo, tenta gravar na coluna dedicada 'attachment'
  if (params.attachment) {
    const attachmentJson = JSON.stringify(params.attachment);
    const { error } = await supabase.from('messages').insert([
      {
        sender_id: params.sender_id,
        sender_name: params.sender_name,
        sender_role: params.sender_role,
        sender_avatar: params.sender_avatar,
        text: params.text.trim(),
        attachment: attachmentJson,
        channel: params.channel,
        recipient_id: params.recipient_id,
      }
    ]);

    if (!error) {
      return { error: null };
    }

    // Fallback: se a coluna attachment ainda não foi criada no banco
    const fallbackText = serializeChatMessage(params.text, params.attachment);
    return await supabase.from('messages').insert([
      {
        sender_id: params.sender_id,
        sender_name: params.sender_name,
        sender_role: params.sender_role,
        sender_avatar: params.sender_avatar,
        text: fallbackText,
        channel: params.channel,
        recipient_id: params.recipient_id,
      }
    ]);
  }

  // Mensagem simples de texto
  return await supabase.from('messages').insert([
    {
      sender_id: params.sender_id,
      sender_name: params.sender_name,
      sender_role: params.sender_role,
      sender_avatar: params.sender_avatar,
      text: params.text.trim(),
      channel: params.channel,
      recipient_id: params.recipient_id,
    }
  ]);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + (sizes[i] || 'MB');
}

/**
 * Retorna o canal do banco isolado por empresa/inquilino (multi-tenant).
 * Evita vazamento de histórico e mensagens entre empresas diferentes ou contas recém-cadastradas.
 */
export function getScopedChatChannel(companyId?: string | null, rawChannel: string = 'geral'): string {
  const cleanCompany = (companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanChan = (rawChannel || 'geral').trim();
  if (cleanChan.startsWith(`cmp_${cleanCompany}__`)) return cleanChan;
  return `cmp_${cleanCompany}__${cleanChan}`;
}

/**
 * Retorna o canal de mensagem privada 1-a-1 isolado por empresa e pelo par ordenado de participantes.
 * Desta forma ambos os participantes sempre entram no mesmo canal seguro.
 */
export function getScopedDirectChannel(companyId?: string | null, user1Id?: string | null, user2Id?: string | null): string {
  const cleanCompany = (companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const u1 = (user1Id || 'user_a').trim();
  const u2 = (user2Id || 'user_b').trim();
  const pair = [u1, u2].sort().join('_');
  return `cmp_${cleanCompany}__direct_${pair}`;
}

/**
 * Extrai o nome amigável do canal a partir de um canal isolado (ex: cmp_xxx__geral -> geral).
 */
export function getDisplayChatChannel(scopedChannel: string): string {
  if (!scopedChannel) return 'geral';
  if (scopedChannel.includes('__')) {
    const parts = scopedChannel.split('__');
    return parts.slice(1).join('__');
  }
  return scopedChannel;
}

/**
 * Retorna a chave do localStorage para registrar o último momento em que o usuário leu as mensagens.
 */
export function getChatLastReadStorageKey(companyId?: string | null, userId?: string | null): string {
  const cleanCompany = (companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUser = (userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `pontuall_chat_last_read_${cleanCompany}_${cleanUser}`;
}

/**
 * Lê o timestamp (ISO) da última leitura do chat pelo usuário nesta empresa.
 */
export function getChatLastReadTimestamp(companyId?: string | null, userId?: string | null): string | null {
  try {
    const key = getChatLastReadStorageKey(companyId, userId);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Salva o timestamp (ISO) da leitura do chat pelo usuário nesta empresa.
 */
export function setChatLastReadTimestamp(companyId?: string | null, userId?: string | null, timestamp?: string): void {
  try {
    const key = getChatLastReadStorageKey(companyId, userId);
    const ts = timestamp || new Date().toISOString();
    localStorage.setItem(key, ts);
  } catch {}
}

/**
 * Verifica se uma mensagem recebida do Supabase pertence ao escopo desta empresa
 * e deve ser contabilizada como não lida pelo usuário ativo.
 */
export function isMessageRelevantForUser(
  msg: { channel?: string; sender_id?: string; recipient_id?: string; text?: string },
  userId?: string | null,
  companyId?: string | null
): boolean {
  if (!msg || !userId) return false;

  // Mensagens enviadas pelo próprio usuário logado não contam como não lidas
  if (msg.sender_id === userId) return false;

  // Metadados de exclusão ou criação de grupos não são mensagens de bate-papo
  if (msg.recipient_id?.startsWith('group_deleted:') || msg.recipient_id?.startsWith('group_meta:')) {
    return false;
  }

  const cleanCompany = (companyId || 'demo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = `cmp_${cleanCompany}__`;
  const channel = (msg.channel || '').trim();

  // A mensagem deve pertencer à mesma empresa
  if (!channel.startsWith(prefix)) {
    return false;
  }

  // Se for mensagem direta 1-a-1: cmp_empresa__direct_id1_id2
  if (channel.startsWith(`${prefix}direct_`)) {
    const suffix = channel.replace(`${prefix}direct_`, '');
    const participants = suffix.split('_');
    // Só é relevante se o usuário ativo for um dos participantes
    return participants.includes(userId) || msg.recipient_id === userId;
  }

  // Canal de grupo da empresa (geral, escalas, etc.)
  return true;
}


