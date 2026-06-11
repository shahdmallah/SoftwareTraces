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
  drawingEnabled?: boolean;
  fitToContent?: boolean;
  onSelectTrail?: (trail: Trail) => void;
  onMapClick?: (point: [number, number]) => void;
  onRouteDraw?: (points: [number, number][]) => void;
};

function markerColor(difficulty: string) {
  if (difficulty === 'Hard' || difficulty === 'Expert') return '#BB2823';
  if (difficulty === 'Moderate') return '#D4A843';
  return '#7A9A3A';
}

function distanceMeters(left: [number, number], right: [number, number]) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [leftLng, leftLat] = left;
  const [rightLng, rightLat] = right;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapboxTrailMap({
  trails = [],
  selectedTrailId,
  routeCoordinates,
  bubbles = [],
  interactive = true,
  heightClassName = 'h-full',
  drawingEnabled = false,
  fitToContent = true,
  onSelectTrail,
  onMapClick,
  onRouteDraw,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const routeCoordinatesRef = useRef<[number, number][]>(routeCoordinates ?? []);
  const isDrawingRef = useRef(false);
  const drawingPointsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    routeCoordinatesRef.current = routeCoordinates ?? [];
  }, [routeCoordinates]);

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
      if (drawingEnabled) return;
      onMapClick([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [drawingEnabled, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onRouteDraw) return;

    const canvas = map.getCanvas();
    const addPoint = (point: [number, number]) => {
      const previous = drawingPointsRef.current.at(-1);
      if (previous && distanceMeters(previous, point) < 8) return;
      const nextPoints = [...drawingPointsRef.current, point];
      drawingPointsRef.current = nextPoints;
      onRouteDraw(nextPoints);
    };
    const startDrawing = (event: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      if (!drawingEnabled) return;
      event.preventDefault();
      isDrawingRef.current = true;
      drawingPointsRef.current = [...routeCoordinatesRef.current];
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      addPoint([event.lngLat.lng, event.lngLat.lat]);
    };
    const draw = (event: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      if (!drawingEnabled || !isDrawingRef.current) return;
      event.preventDefault();
      addPoint([event.lngLat.lng, event.lngLat.lat]);
    };
    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      map.dragPan.enable();
      map.touchZoomRotate.enable();
    };

    canvas.style.cursor = drawingEnabled ? 'crosshair' : '';
    map.on('mousedown', startDrawing);
    map.on('mousemove', draw);
    map.on('mouseup', stopDrawing);
    map.on('mouseleave', stopDrawing);
    map.on('touchstart', startDrawing);
    map.on('touchmove', draw);
    map.on('touchend', stopDrawing);

    if (!drawingEnabled) stopDrawing();

    return () => {
      canvas.style.cursor = '';
      map.off('mousedown', startDrawing);
      map.off('mousemove', draw);
      map.off('mouseup', stopDrawing);
      map.off('mouseleave', stopDrawing);
      map.off('touchstart', startDrawing);
      map.off('touchmove', draw);
      map.off('touchend', stopDrawing);
      stopDrawing();
    };
  }, [drawingEnabled, onRouteDraw]);

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
    if (fitToContent && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: routeCoordinates?.length ? 13 : 10, duration: 700 });
    }
  }, [trails, selectedTrailId, routeCoordinates, bubbles, fitToContent, onSelectTrail]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRoute = () => {
      const lineSource = map.getSource('trail-route') as mapboxgl.GeoJSONSource | undefined;
      const lineData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: routeCoordinates?.length
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordinates } }]
          : [],
      };
      const pointSource = map.getSource('trail-route-points') as mapboxgl.GeoJSONSource | undefined;
      const pointData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: (routeCoordinates ?? []).map((point, index, points) => ({
          type: 'Feature',
          properties: {
            kind: index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
          },
          geometry: { type: 'Point', coordinates: point },
        })),
      };

      if (lineSource) {
        lineSource.setData(lineData);
      } else {
        map.addSource('trail-route', { type: 'geojson', data: lineData });
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
      }

      if (pointSource) {
        pointSource.setData(pointData);
      } else {
        map.addSource('trail-route-points', { type: 'geojson', data: pointData });
        map.addLayer({
          id: 'trail-route-points',
          type: 'circle',
          source: 'trail-route-points',
          paint: {
            'circle-color': [
              'match',
              ['get', 'kind'],
              'start',
              '#7A9A3A',
              'end',
              '#BB2823',
              '#D4A843',
            ],
            'circle-radius': ['match', ['get', 'kind'], 'middle', 4, 6],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
          },
        });
      }
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
