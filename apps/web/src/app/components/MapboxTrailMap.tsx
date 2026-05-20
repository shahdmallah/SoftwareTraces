import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../config/mapbox';
import type { MapBubble } from '../api/map';
import type { Trail } from '../api/trails';

type Props = {
  trails?: Trail[];
  selectedTrailId?: string | null;
  routeCoordinates?: [number, number][];
  bubbles?: MapBubble[];
  interactive?: boolean;
  heightClassName?: string;
  onSelectTrail?: (trail: Trail) => void;
  onMapClick?: (point: [number, number]) => void;
};

function markerColor(difficulty: string) {
  if (difficulty === 'Hard' || difficulty === 'Expert') return '#BB2823';
  if (difficulty === 'Moderate') return '#D4A843';
  return '#7A9A3A';
}

export function MapboxTrailMap({
  trails = [],
  selectedTrailId,
  routeCoordinates,
  bubbles = [],
  interactive = true,
  heightClassName = 'h-full',
  onSelectTrail,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_ACCESS_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URL,
      center: [35.24, 31.78],
      zoom: 8,
      pitch: 45,
      bearing: -12,
      interactive,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapRef.current.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: true }), 'top-right');

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;
    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      onMapClick([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    trails.forEach((trail) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'w-8 h-8 rounded-full border-2 border-white shadow-lg';
      el.style.background = markerColor(trail.difficulty);
      el.style.transform = trail.id === selectedTrailId ? 'scale(1.25)' : 'scale(1)';
      el.title = trail.name;
      el.addEventListener('click', () => onSelectTrail?.(trail));
      markerRefs.current.push(new mapboxgl.Marker(el).setLngLat(trail.coordinates).addTo(map));
    });

    bubbles.forEach((bubble) => {
      const el = document.createElement('div');
      el.className = 'rounded-full border-2 border-white shadow-lg bg-primary text-white text-xs font-bold flex items-center justify-center';
      const size = Math.min(72, Math.max(42, 34 + bubble.count));
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      if (bubble.preview_images[0]) {
        el.style.backgroundImage = `linear-gradient(rgba(99,14,19,.35), rgba(99,14,19,.35)), url(${bubble.preview_images[0]})`;
        el.style.backgroundSize = 'cover';
      }
      el.textContent = String(bubble.count);
      markerRefs.current.push(new mapboxgl.Marker(el).setLngLat([bubble.lng, bubble.lat]).addTo(map));
    });

    const bounds = new mapboxgl.LngLatBounds();
    trails.forEach((trail) => bounds.extend(trail.coordinates));
    routeCoordinates?.forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: routeCoordinates?.length ? 13 : 10, duration: 700 });
    }
  }, [trails, selectedTrailId, routeCoordinates, bubbles, onSelectTrail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRoute = () => {
      const source = map.getSource('trail-route') as mapboxgl.GeoJSONSource | undefined;
      const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: routeCoordinates?.length
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordinates } }]
          : [],
      };

      if (source) {
        source.setData(data);
        return;
      }

      map.addSource('trail-route', { type: 'geojson', data });
      map.addLayer({
        id: 'trail-route-line',
        type: 'line',
        source: 'trail-route',
        paint: {
          'line-color': '#7AFC38',
          'line-width': 5,
          'line-opacity': 0.92,
        },
      });
    };

    if (map.isStyleLoaded()) updateRoute();
    else map.once('load', updateRoute);
  }, [routeCoordinates]);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div className={`${heightClassName} bg-card border border-border rounded-xl flex items-center justify-center p-6 text-center text-secondary`}>
        Add VITE_MAPBOX_ACCESS_TOKEN to enable Mapbox maps.
      </div>
    );
  }

  return <div ref={containerRef} className={`${heightClassName} min-h-[280px] overflow-hidden`} />;
}
