/**
 * Serviço de Gestão de Locais de Trabalho e Postos (Workplaces)
 * Permite cadastrar postos com endereços físicos, coordenadas GPS e raios de tolerância.
 */

import { safeStorage } from '../utils/safeStorage';
import { searchAddressCoordinates } from '../utils/geolocation';

import { WorkplaceLocation } from '@/types';
export type { WorkplaceLocation };

const STORAGE_KEY = 'pontuall_workplaces_v1';

// Locais padrão iniciais do sistema (neutros e personalizáveis pelo gestor)
export const DEFAULT_WORKPLACES: WorkplaceLocation[] = [
  {
    id: 'wp-matriz',
    name: 'Sede Principal / Matriz',
    address: 'Endereço Principal da Empresa',
    latitude: 0,
    longitude: 0,
    radiusMeters: 200,
    isRemote: false,
  },
  {
    id: 'wp-home-office',
    name: 'Home Office / Remoto',
    address: 'Trabalho Remoto / Domiciliar',
    latitude: 0,
    longitude: 0,
    radiusMeters: 0,
    isRemote: true,
  },
  {
    id: 'wp-externo-temporario',
    name: 'Posto Externo / Temporário',
    address: 'Local definido no momento do check-in',
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
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WORKPLACES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Filtra e limpa resquícios antigos de 'wp-sede-sp' se o usuário ainda tiver em cache antigo
      const filtered = parsed.filter(w => w.id !== 'wp-sede-sp' && w.name !== 'Sede Central - SP');
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
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(workplaces));
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

