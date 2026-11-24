import { supabase } from './supabase';
import { safeStorage } from '@/shared/utils/safeStorage';
import {
  ALLOWED_DOCUMENT_MIMES,
  sanitizeSafeUrl,
  validateUploadFile,
  validateUploadMagicBytes,
} from '@/shared/utils/security';

const DEFAULT_BUCKET = 'atestados';

async function resolveClientAuthToken(): Promise<string | null> {
  const localToken = safeStorage.getItem('pontual_auth_token');
  if (localToken) return localToken;

  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {}

  return null;
}

function buildStorageApiEndpoints(action: 'upload-url' | 'signed-url'): string[] {
  const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return [
    ...(backendBase ? [`${backendBase}/api/storage/${action}`] : []),
    `/api/storage/${action}`,
    ...(import.meta.env.DEV ? [`http://localhost:5000/api/storage/${action}`] : []),
  ];
}

function extractBucketAndPath(
  storedUrlOrPath: string,
  defaultBucket = DEFAULT_BUCKET
): { bucket: string; objectPath: string; isManagedStorage: boolean } {
  const trimmed = storedUrlOrPath.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const match = parsed.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(atestados|documentos)\/(.+)$/i
      );
      if (match) {
        return {
          bucket: match[1].toLowerCase(),
          objectPath: decodeURIComponent(match[2]),
          isManagedStorage: true,
        };
      }
    } catch {}
    return { bucket: defaultBucket, objectPath: '', isManagedStorage: false };
  }

  if (trimmed.toLowerCase().startsWith('atestados/')) {
    return {
      bucket: 'atestados',
      objectPath: trimmed.slice('atestados/'.length),
      isManagedStorage: true,
    };
  }
  if (trimmed.toLowerCase().startsWith('documentos/')) {
    return {
      bucket: 'documentos',
      objectPath: trimmed.slice('documentos/'.length),
      isManagedStorage: true,
    };
  }

  return {
    bucket: defaultBucket,
    objectPath: trimmed.replace(/^\/+/, ''),
    isManagedStorage: true,
  };
}

/**
 * Envia um arquivo (atestado/comprovante) para bucket privado do Supabase Storage.
 * Valida MIME/extensão/tamanho/magic bytes e retorna o caminho canônico privado (`bucket/path`).
 */
export async function uploadDocumentSupabase(
  file: File,
  bucketName = DEFAULT_BUCKET
): Promise<{ url: string; path: string } | null> {
  const check = validateUploadFile(file, { mode: 'document', maxSizeBytes: 10 * 1024 * 1024 });
  if (!check.valid) {
    throw new Error(check.error || 'Arquivo inválido ou formato não permitido.');
  }

  const magicCheck = await validateUploadMagicBytes(file, { mode: 'document' });
  if (!magicCheck.valid) {
    throw new Error(magicCheck.error || 'Conteúdo de arquivo inválido ou formato adulterado.');
  }

  const contentType = (file.type || '').trim().toLowerCase() || magicCheck.detectedMime || 'application/pdf';

  // 1. Fluxo Server-First: URL assinada para upload privado escopado por empresa/usuário
  if (typeof fetch !== 'undefined') {
    const token = await resolveClientAuthToken();
    const endpoints = buildStorageApiEndpoints('upload-url');

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            bucket: bucketName,
            fileName: file.name,
            contentType,
            fileSize: file.size,
          }),
        });

        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.bucket && json?.path && json?.token) {
            const { error: uploadErr } = await supabase.storage
              .from(json.bucket)
              .uploadToSignedUrl(json.path, json.token, file, {
                contentType,
                upsert: false,
              });

            if (uploadErr) {
              throw new Error(uploadErr.message || 'Falha ao enviar arquivo para o armazenamento privado.');
            }

            const canonicalPath = json.canonicalPath || `${json.bucket}/${json.path}`;
            return {
              url: canonicalPath,
              path: canonicalPath,
            };
          }
        } else if (res.status >= 400 && res.status < 500 && res.status !== 404) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || 'Upload rejeitado pela política de segurança.');
        }
      } catch (err: any) {
        if (err?.message && !String(err.message).includes('Failed to fetch')) {
          throw err;
        }
      }
    }
  }

  // 2. Fallback direto no Supabase Storage (retornando caminho canônico privado, nunca publicUrl)
  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });

    if (error) {
      console.warn(`Aviso ao enviar arquivo para bucket '${bucketName}':`, error.message);
      if (bucketName !== 'documentos') {
        return uploadDocumentSupabase(file, 'documentos');
      }
      return null;
    }

    const canonicalPath = `${bucketName}/${data.path}`;
    return {
      url: canonicalPath,
      path: canonicalPath,
    };
  } catch (err: any) {
    console.error('Exceção ao fazer upload de documento no Supabase Storage:', err);
    return null;
  }
}

/**
 * Resolve uma URL temporária assinada (Signed URL) para exibição/abertura segura do documento.
 */
export async function resolveDocumentUrl(
  storedUrlOrPath?: string | null,
  bucketName = DEFAULT_BUCKET
): Promise<string | null> {
  if (!storedUrlOrPath || !storedUrlOrPath.trim()) return null;

  const url = storedUrlOrPath.trim();

  // 1. Data URL base64 (validada antes da abertura em openDocumentSafe)
  if (url.startsWith('data:')) {
    return url;
  }

  const parsedRef = extractBucketAndPath(url, bucketName);

  // 2. Caminho privado ou URL do Storage gerenciado -> solicita Signed URL efêmera autenticada no servidor
  if (parsedRef.isManagedStorage) {
    if (typeof fetch !== 'undefined') {
      const token = await resolveClientAuthToken();
      const endpoints = buildStorageApiEndpoints('signed-url');

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              path: url,
              bucket: parsedRef.bucket,
            }),
          });

          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json?.signedUrl) {
              return json.signedUrl;
            }
          } else if (res.status === 403 || res.status === 401) {
            return null;
          }
        } catch {}
      }
    }

    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(parsedRef.bucket)
        .createSignedUrl(parsedRef.objectPath, 300);

      if (!signedErr && signedData?.signedUrl) {
        return signedData.signedUrl;
      }
    } catch (err) {
      console.warn('Erro ao resolver URL assinada no Storage:', err);
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    return null;
  }

  // 3. URL web externa não gerenciada pelo bucket privado
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return null;
}

/**
 * Abre o documento de forma segura em uma nova aba do navegador.
 * Suporta Data URLs convertendo-as em Blobs para evitar bloqueios do navegador.
 */
export async function openDocumentSafe(
  storedUrlOrPath?: string | null,
  fileName = 'comprovante.pdf'
): Promise<boolean> {
  const resolvedUrl = await resolveDocumentUrl(storedUrlOrPath);
  if (!resolvedUrl) {
    alert(`O documento "${fileName}" não possui link válido para visualização ou acesso autorizado.`);
    return false;
  }

  if (resolvedUrl.startsWith('data:')) {
    try {
      const parts = resolvedUrl.split(';base64,');
      const contentType = parts[0].replace('data:', '').trim().toLowerCase() || 'application/pdf';
      if (!ALLOWED_DOCUMENT_MIMES.has(contentType) || parts.length !== 2) {
        alert(`Tipo de arquivo não permitido para visualização segura (${contentType}).`);
        return false;
      }

      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return true;
    } catch (e) {
      console.warn('Erro ao abrir base64 como blob:', e);
      return false;
    }
  }

  const safeHref = sanitizeSafeUrl(resolvedUrl, { allowBlob: true, fallback: '' });
  if (!safeHref) {
    alert(`O link do documento "${fileName}" é inválido ou inseguro.`);
    return false;
  }

  const opened = window.open(safeHref, '_blank', 'noopener,noreferrer');
  if (!opened) {
    // Caso bloqueador de popups impeça window.open
    const link = document.createElement('a');
    link.href = safeHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return true;
}
