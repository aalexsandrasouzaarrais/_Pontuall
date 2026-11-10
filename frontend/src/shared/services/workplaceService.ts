/**
 * Serviço de Gestão de Locais de Trabalho e Postos (Workplaces)
 * Permite cadastrar postos com endereços físicos, coordenadas GPS e raios de tolerância.
 */

import { safeStorage } from '../utils/safeStorage';
import { searchAddressCoordinates } from '../utils/geolocation';

import { WorkplaceLocation } from '@/types';
export type { WorkplaceLocation };

const STORAGE_KEY = 'pontuall_workplaces_v1';

/**
 * Retorna a chave de armazenamento isolada por empresa/gestor ativo
 */
function getWorkplaceStorageKey(): string {
  try {
    const rawUser = safeStorage.getItem('pontual_active_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const companyKey = user.companyId || user.company_id || user.empresa_id || user.cnpj || user.email;
      if (companyKey) {
        const sanitized = String(companyKey).replace(/[^a-zA-Z0-9_-]/g, '_');
        return `pontuall_workplaces_${sanitized}`;
      }
    }
  } catch (e) {
    // ignore
  }
  return STORAGE_KEY;
}

// Locais padrão iniciais do sistema (apenas neutro Home Office / Remoto, sem sedes físicas fictícias)
export const DEFAULT_WORKPLACES: WorkplaceLocation[] = [
  {
    id: 'wp-home-office',
    name: 'Home Office / Remoto',
    address: 'Trabalho Remoto / Domiciliar',
    latitude: 0,
    longitude: 0,
    radiusMeters: 0,
    isRemote: true,
  },
];

/**
 * Registra um posto caso ele ainda não esteja cadastrado na lista local
 */
export function registerWorkplaceIfNew(wp: WorkplaceLocation): void {
  if (!wp || !wp.name) return;
  // Não reintroduzir postos fictícios de mock antigos
  if (
    wp.id === 'wp-matriz' || 
    wp.name === 'Sede Principal / Matriz' ||
    wp.id === 'wp-externo-temporario' || 
    wp.name === 'Posto Externo / Temporário' ||
    wp.id === 'wp-sede-sp' ||
    wp.name === 'Sede Central - SP'
  ) {
    return;
  }
  try {
    const list = getStoredWorkplaces();
    const exists = list.some(w => 
      w.id === wp.id || 
      (w.name.toLowerCase() === wp.name.toLowerCase() && w.address === wp.address)
    );
    if (!exists) {
      saveWorkplaces([...list, wp]);
    }
  } catch (err) {
    console.warn('Erro ao registrar posto novo:', err);
  }
}

/**
 * Retorna todos os postos de trabalho cadastrados
 */
export function getStoredWorkplaces(): WorkplaceLocation[] {
  try {
    const key = getWorkplaceStorageKey();
    const raw = safeStorage.getItem(key);
    if (!raw) return DEFAULT_WORKPLACES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Filtra e limpa resquícios antigos de postos fictícios e formatações
      const filtered = parsed
        .filter(w => 
          w &&
          w.id !== 'wp-sede-sp' && 
          w.name !== 'Sede Central - SP' &&
          w.id !== 'wp-matriz' &&
          w.name !== 'Sede Principal / Matriz' &&
          w.id !== 'wp-externo-temporario' &&
          w.name !== 'Posto Externo / Temporário'
        )
        .map(w => ({
          ...w,
          name: typeof w.name === 'string' ? w.name.replace(/📍\s*/g, '').trim() : w.name,
          address: typeof w.address === 'string' ? w.address.replace(/📍\s*/g, '').trim() : w.address,
        }));
      return filtered.length > 0 ? filtered : DEFAULT_WORKPLACES;
    }
  } catch (err) {
    console.warn('Erro ao carregar locais de trabalho do storage:', err);
  }
  return DEFAULT_WORKPLACES;
}

/**
 * Salva a lista de postos de trabalho
 */
export function saveWorkplaces(workplaces: WorkplaceLocation[]): void {
  const key = getWorkplaceStorageKey();
  safeStorage.setItem(key, JSON.stringify(workplaces));
}

/**
 * Cadastra um novo posto de trabalho a partir do nome e endereço/CEP.
 * O sistema busca automaticamente as coordenadas via OpenStreetMap Nominatim.
 */
export async function createWorkplaceFromAddress(params: {
  name: string;
  address: string;
  radiusMeters?: number;
  isRemote?: boolean;
  manualCoordinates?: { latitude: number; longitude: number };
}): Promise<WorkplaceLocation> {
  let lat = 0;
  let lon = 0;

  if (params.isRemote) {
    lat = 0;
    lon = 0;
  } else if (params.manualCoordinates) {
    lat = params.manualCoordinates.latitude;
    lon = params.manualCoordinates.longitude;
  } else {
    // Geocodificação Direta Automática: transforma endereço/CEP em coordenadas reais
    const geo = await searchAddressCoordinates(params.address);
    if (geo) {
      lat = geo.latitude;
      lon = geo.longitude;
    } else {
      throw new Error(
        `Não foi possível localizar o endereço "${params.address}" no mapa. Por favor, selecione uma das sugestões da lista ou informe um CEP válido.`
      );
    }
  }

  const newWorkplace: WorkplaceLocation = {
    id: `wp-${Date.now()}`,
    name: params.name.trim(),
    address: params.address.trim(),
    latitude: lat,
    longitude: lon,
    radiusMeters: params.radiusMeters || 200,
    isRemote: !!params.isRemote,
  };

  const existing = getStoredWorkplaces();
  const updated = [...existing, newWorkplace];
  saveWorkplaces(updated);

  return newWorkplace;
}

/**
 * Localiza o posto pelo nome ou substring
 */
export function findWorkplaceByName(name?: string): WorkplaceLocation | undefined {
  if (!name) return undefined;
  const list = getStoredWorkplaces();
  const lower = name.toLowerCase().trim();
  
  return list.find(w => 
    w.name.toLowerCase() === lower || 
    lower.includes(w.name.toLowerCase()) || 
    w.name.toLowerCase().includes(lower)
  );
}

/**
 * Remove um posto de trabalho pelo seu ID
 */
export function deleteWorkplace(id: string): WorkplaceLocation[] {
  const list = getStoredWorkplaces();
  const updated = list.filter(w => w.id !== id);
  saveWorkplaces(updated);
  return updated;
}

