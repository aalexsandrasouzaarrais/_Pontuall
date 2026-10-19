/**
 * Utilitário de Geolocalização e Geocodificação 100% Gratuito
 * - Captura de coordenadas GPS nativas via HTML5 Geolocation API
 * - Geocodificação reversa e direta via OpenStreetMap (Nominatim) com fallback BigDataCloud
 * - Cálculo geodésico de distância e perímetro (Haversine)
 */

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number; // Precisão em metros
  timestamp: number;
}

export interface GeocodedAddress {
  formattedAddress: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export interface LocationSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Obtém as coordenadas GPS reais do dispositivo (celular ou navegador)
 */
export async function getCurrentCoordinates(): Promise<GpsCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Seu navegador ou dispositivo não possui suporte a geolocalização.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        let msg = 'Erro ao obter localização GPS.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Permissão de localização negada. Habilite o GPS no navegador/aparelho para registrar o ponto.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Sinal de GPS indisponível no momento. Certifique-se de estar conectado e tente novamente.';
            break;
          case err.TIMEOUT:
            msg = 'Tempo limite esgotado ao buscar o sinal GPS. Tente novamente.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Converte latitude e longitude no endereço humano legível em português.
 * Usa OpenStreetMap Nominatim com fallback para BigDataCloud Client API.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodedAddress> {
  // 1. Tentativa via OpenStreetMap Nominatim (Gratuito e Aberto)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.street || '';
        const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
        const neighbourhood = addr.suburb || addr.neighbourhood || addr.city_district || '';
        const city = addr.city || addr.town || addr.municipality || addr.village || '';
        const state = addr.state || '';
        const postcode = addr.postcode || '';

        const parts: string[] = [];
        if (road) parts.push(`${road}${houseNumber}`);
        if (neighbourhood) parts.push(neighbourhood);
        if (city) parts.push(city);
        if (state) parts.push(state);

        const formatted = parts.length > 0 ? parts.join(' - ') : data.display_name || `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;

        return {
          formattedAddress: formatted,
          road,
          neighbourhood,
          city,
          state,
          postcode,
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim falhou, acionando fallback BigDataCloud:', err);
  }

  // 2. Fallback via BigDataCloud Client API (100% Gratuito, sem necessidade de chave)
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`
    );
    if (res.ok) {
      const data = await res.json();
      const road = data.locality || data.principalSubdivision || '';
      const city = data.city || '';
      const state = data.principalSubdivision || '';
      const parts = [road, city, state].filter(Boolean);
      const formatted = parts.length > 0 ? parts.join(' - ') : `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;

      return {
        formattedAddress: formatted,
        road,
        city,
        state,
      };
    }
  } catch (err) {
    console.warn('Fallback BigDataCloud também falhou:', err);
  }

  // Fallback final: Coordenadas brutas formatadas
  return {
    formattedAddress: `GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
  };
}

export interface AddressSuggestion {
  latitude: number;
  longitude: number;
  displayName: string;
  road?: string;
  houseNumber?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

/**
 * Remove ruídos, parênteses e complementos que quebram a busca no Nominatim
 * Ex: "Rua Antônio Chemin, 117 – Bairro São Gabriel (ou Roça Grande), Colombo – PR, CEP..."
 * -> "Rua Antônio Chemin, 117, Colombo – PR"
 */
export function cleanAddressQuery(query: string): string {
  if (!query) return '';
  return query
    .replace(/\(.*?\)/g, '') // remove parenteses e conteudo interno
    .replace(/\b(ou|e\/ou)\b.*?(?=,|-|$)/gi, '') // remove "ou Roça Grande" etc
    .replace(/cep\s*:?\s*[\d.-]+/gi, '') // remove "CEP 83404-000"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Consulta CEP gratuitamente via ViaCEP (100% gratuito, sem necessidade de chaves de API)
 */
export async function fetchAddressByCep(cep: string): Promise<{
  road: string;
  neighbourhood: string;
  city: string;
  state: string;
  formatted: string;
} | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          road: data.logradouro || '',
          neighbourhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
          formatted: [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(', '),
        };
      }
    }
  } catch (err) {
    console.warn('ViaCEP falhou:', err);
  }
  return null;
}

/**
 * Busca sugestões de endereço em tempo real (Estilo Uber Autocomplete)
 * Retorna até 5 locais reais com nome, bairro, cidade e coordenadas exatas.
 */
export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const raw = query.trim();

  // 1. Se o usuário colou coordenadas brutas ou do Google Maps (Ex: "-25.3214, -49.2015")
  const coordMatch = raw.match(/(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const rev = await reverseGeocode(lat, lon);
      return [{
        latitude: lat,
        longitude: lon,
        displayName: `📍 Coordenadas do Maps: ${rev.formattedAddress}`,
        road: rev.road,
        neighbourhood: rev.neighbourhood,
        city: rev.city,
        state: rev.state,
      }];
    }
  }

  // 2. Se for ou contiver um CEP (8 dígitos com ou sem hífen)
  const cepMatch = raw.match(/\b\d{5}-?\d{3}\b/);
  if (cepMatch) {
    const viaCepResult = await fetchAddressByCep(cepMatch[0]);
    if (viaCepResult && viaCepResult.city) {
      // Busca coordenadas com a query limpa oficial do CEP
      const cepQuery = `${viaCepResult.road ? viaCepResult.road + ', ' : ''}${viaCepResult.city} - ${viaCepResult.state}, Brasil`;
      const directCoords = await searchAddressCoordinatesDirect(cepQuery);
      if (directCoords) {
        return [{
          latitude: directCoords.latitude,
          longitude: directCoords.longitude,
          displayName: `${viaCepResult.road ? viaCepResult.road + ' - ' : ''}${viaCepResult.neighbourhood ? viaCepResult.neighbourhood + ', ' : ''}${viaCepResult.city} - ${viaCepResult.state}`,
          road: viaCepResult.road,
          neighbourhood: viaCepResult.neighbourhood,
          city: viaCepResult.city,
          state: viaCepResult.state,
          postcode: cepMatch[0],
        }];
      }
    }
  }

  const cleaned = cleanAddressQuery(raw);
  const q = cleaned.length >= 3 ? cleaned : raw;

  try {
    const encoded = encodeURIComponent(q);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&countrycodes=br&limit=5`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item: any) => {
          const addr = item.address || {};
          const road = addr.road || addr.street || addr.pedestrian || addr.building || '';
          const houseNumber = addr.house_number || '';
          const neighbourhood = addr.suburb || addr.neighbourhood || addr.city_district || '';
          const city = addr.city || addr.town || addr.municipality || addr.village || '';
          const state = addr.state || '';
          const postcode = addr.postcode || '';

          let title = road ? `${road}${houseNumber ? `, ${houseNumber}` : ''}` : item.name || '';
          const subtitle = [neighbourhood, city, state].filter(Boolean).join(' - ');
          const displayName = subtitle ? (title ? `${title}, ${subtitle}` : subtitle) : item.display_name;

          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName,
            road,
            houseNumber,
            neighbourhood,
            city,
            state,
            postcode,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Erro no autocomplete Nominatim:', err);
  }

  return [];
}

/**
 * Busca direta simplificada no Nominatim
 */
async function searchAddressCoordinatesDirect(query: string): Promise<LocationSearchResult | null> {
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return {
          latitude: parseFloat(list[0].lat),
          longitude: parseFloat(list[0].lon),
          displayName: list[0].display_name,
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Busca coordenadas (Latitude e Longitude) a partir de um endereço ou CEP digitado pelo Gestor.
 * Usa OpenStreetMap Nominatim Search com suporte a ViaCEP e higienização inteligente.
 */
export async function searchAddressCoordinates(query: string): Promise<LocationSearchResult | null> {
  if (!query || query.trim().length < 3) return null;

  // 1. Tenta autocomplete inteligente
  const suggestions = await searchAddressSuggestions(query);
  if (suggestions.length > 0) {
    return {
      latitude: suggestions[0].latitude,
      longitude: suggestions[0].longitude,
      displayName: suggestions[0].displayName,
    };
  }

  // 2. Fallback direto com texto higienizado
  const cleaned = cleanAddressQuery(query);
  return searchAddressCoordinatesDirect(cleaned || query);
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas
 * utilizando a Fórmula de Haversine.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Valida se uma coordenada do colaborador está dentro do raio permitido de um posto
 */
export function validateGeofence(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number = 200
): { isValid: boolean; distanceMeters: number } {
  const distance = calculateHaversineDistance(currentLat, currentLon, targetLat, targetLon);
  return {
    isValid: distance <= radiusMeters,
    distanceMeters: distance,
  };
}
