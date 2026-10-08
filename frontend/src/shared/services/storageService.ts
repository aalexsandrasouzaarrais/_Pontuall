import { supabase } from './supabase';

const DEFAULT_BUCKET = 'atestados';

/**
 * Envia um arquivo (atestado/comprovante) para o bucket do Supabase Storage.
 * Retorna a URL pública (ou path do arquivo) ou nulo se falhar.
 */
export async function uploadDocumentSupabase(
  file: File,
  bucketName = DEFAULT_BUCKET
): Promise<{ url: string; path: string } | null> {
  try {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn(`Aviso ao enviar arquivo para bucket '${bucketName}':`, error.message);
      // Tentativa de fallback no bucket 'documentos' caso 'atestados' não exista
      if (bucketName !== 'documentos') {
        return uploadDocumentSupabase(file, 'documentos');
      }
      return null;
    }

    // Tenta obter a URL pública
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return {
      url: publicData?.publicUrl || data.path,
      path: data.path,
    };
  } catch (err: any) {
    console.error('Exceção ao fazer upload de documento no Supabase Storage:', err);
    return null;
  }
}

/**
 * Resolve uma URL de documento para exibição/abertura pelo gestor ou colaborador.
 * Trata URLs completas, Data URLs (base64) e paths relativos do Supabase Storage.
 */
export async function resolveDocumentUrl(
  storedUrlOrPath?: string | null,
  bucketName = DEFAULT_BUCKET
): Promise<string | null> {
  if (!storedUrlOrPath || !storedUrlOrPath.trim()) return null;

  const url = storedUrlOrPath.trim();

  // 1. Já é uma URL web pública (HTTP / HTTPS)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 2. É uma Data URL base64
  if (url.startsWith('data:')) {
    return url;
  }

  // 3. É um caminho relativo no Supabase Storage (ex: 'atestados/arquivo.pdf' ou 'arquivo.pdf')
  try {
    const cleanPath = url.replace(/^(atestados\/|documentos\/)/, '');

    // Primeiro tenta gerar Signed URL (caso o bucket seja privado)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanPath, 3600);

    if (!signedErr && signedData?.signedUrl) {
      return signedData.signedUrl;
    }

    // Fallback: URL pública
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(cleanPath);

    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  } catch (err) {
    console.warn('Erro ao resolver URL no Storage do Supabase:', err);
  }

  return url;
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
    alert(`O documento "${fileName}" não possui link válido para visualização.`);
    return false;
  }

  if (resolvedUrl.startsWith('data:')) {
    try {
      const parts = resolvedUrl.split(';base64,');
      const contentType = parts[0].replace('data:', '') || 'application/pdf';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      const newTab = window.open(blobUrl, '_blank');
      if (!newTab) {
        window.location.href = blobUrl;
      }
      return true;
    } catch (e) {
      console.warn('Erro ao abrir base64 como blob, tentando abertura direta:', e);
    }
  }

  const opened = window.open(resolvedUrl, '_blank');
  if (!opened) {
    // Caso bloqueador de popups impeça window.open
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return true;
}
