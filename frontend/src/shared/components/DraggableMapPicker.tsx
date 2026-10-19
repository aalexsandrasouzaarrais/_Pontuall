import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Info, ZoomIn } from 'lucide-react';

interface DraggableMapPickerProps {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  isLight?: boolean;
}

export const DraggableMapPicker: React.FC<DraggableMapPickerProps> = ({
  latitude,
  longitude,
  radiusMeters = 200,
  onLocationChange,
  isLight = false,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentCoords, setCurrentCoords] = useState({ lat: latitude, lng: longitude });

  useEffect(() => {
    setCurrentCoords({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  // Listener para capturar mensagens de arrasto do pino vindo do iframe do Leaflet
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PONTUALL_PIN_DRAGGED') {
        const { lat, lng } = event.data;
        if (typeof lat === 'number' && typeof lng === 'number') {
          setCurrentCoords({ lat, lng });
          onLocationChange(lat, lng);
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [onLocationChange]);

  // Atualiza a posição do mapa e do círculo caso as props mudem externamente
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'UPDATE_MAP_VIEW',
          lat: latitude,
          lng: longitude,
          radius: radiusMeters,
        },
        '*'
      );
    }
  }, [latitude, longitude, radiusMeters]);

  // HTML autocontido para carregar Leaflet com tiles OpenStreetMap
  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${isLight ? '#f1f5f9' : '#0f172a'}; }
    .custom-tooltip {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255,255,255,0.2);
      color: #ffffff;
      font-family: sans-serif;
      font-size: 11px;
      font-weight: bold;
      border-radius: 6px;
      padding: 4px 8px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map = null;
    let marker = null;
    let circle = null;

    function initMap(initialLat, initialLng, initialRadius) {
      map = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView([initialLat, initialLng], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Círculo sombreado do Raio de Tolerância
      circle = L.circle([initialLat, initialLng], {
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.22,
        radius: initialRadius,
        weight: 2
      }).addTo(map);

      // Marcador com pino arrastável
      marker = L.marker([initialLat, initialLng], {
        draggable: true
      }).addTo(map);

      marker.bindTooltip("Arraste até a portaria da empresa", {
        permanent: false,
        direction: 'top',
        className: 'custom-tooltip'
      });

      function notifyParent(newLat, newLng) {
        if (circle) circle.setLatLng([newLat, newLng]);
        window.parent.postMessage({
          type: 'PONTUALL_PIN_DRAGGED',
          lat: newLat,
          lng: newLng
        }, '*');
      }

      // Evento de arrastar o pino
      marker.on('dragend', function(e) {
        let pos = marker.getLatLng();
        notifyParent(pos.lat, pos.lng);
      });

      // Evento de clicar no mapa para reposicionar o pino imediatamente
      map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        notifyParent(e.latlng.lat, e.latlng.lng);
      });
    }

    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'UPDATE_MAP_VIEW') {
        const { lat, lng, radius } = event.data;
        if (map && marker && circle) {
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          if (radius) circle.setRadius(radius);
          map.panTo([lat, lng]);
        }
      }
    });

    initMap(${latitude}, ${longitude}, ${radiusMeters});
  </script>
</body>
</html>
  `;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${
        isLight
          ? 'bg-slate-50 border-slate-200 text-slate-800'
          : 'bg-[#12141a] border-white/10 text-white'
      }`}
    >
      {/* Barra de instruções no topo do mapa */}
      <div
        className={`px-3 py-2 border-b flex items-center justify-between text-[11px] font-medium ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
        }`}
      >
        <span className="flex items-center gap-1.5 font-bold">
          <MapPin className="w-3.5 h-3.5 text-rose-500" />
          <span>Ajuste Fino do Posto:</span>
          <span className="font-normal opacity-80 hidden sm:inline">
            Clique no mapa ou arraste o pino para a portaria
          </span>
        </span>

        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-500 border border-sky-500/20 font-bold">
          Raio: {radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)}km` : `${radiusMeters}m`}
        </span>
      </div>

      {/* Frame do Mapa Interativo */}
      <div className="relative w-full h-[220px] bg-slate-900">
        <iframe
          ref={iframeRef}
          srcDoc={mapHtml}
          title="Mini-Mapa de Localização"
          className="w-full h-full border-none select-none"
          loading="lazy"
        />
      </div>

      {/* Rodapé com Coordenadas Exatas Atualizadas em Tempo Real */}
      <div
        className={`px-3 py-1.5 text-[10px] font-mono flex items-center justify-between opacity-80 border-t ${
          isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/5 bg-black/20 text-slate-400'
        }`}
      >
        <span>
          Coordenadas: <strong>{currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}</strong>
        </span>
        <span className="text-[9.5px]">✓ Satélite GPS Alinhado</span>
      </div>
    </div>
  );
};
