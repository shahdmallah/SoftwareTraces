import { useState } from 'react';
import { trails, type Trail } from '../data/trails';

interface PalestineMapProps {
  onTrailSelect?: (trail: Trail) => void;
  selectedTrailId?: string;
  height?: number;
}

// Coordinate mapping:
// lon: 34.0–36.0 -> x: 0–390
// lat: 33.2–31.0 -> y: 0–480
function toX(lon: number) { return ((lon - 34.0) / 2.0) * 390; }
function toY(lat: number) { return ((33.2 - lat) / 2.2) * 480; }

const WEST_BANK_PATH = `M ${toX(35.35)},${toY(32.55)} 
  L ${toX(35.6)},${toY(32.50)} 
  L ${toX(35.58)},${toY(32.35)} 
  L ${toX(35.57)},${toY(32.15)} 
  L ${toX(35.56)},${toY(31.85)} 
  L ${toX(35.55)},${toY(31.6)} 
  L ${toX(35.45)},${toY(31.4)} 
  L ${toX(35.2)},${toY(31.35)} 
  L ${toX(35.0)},${toY(31.3)} 
  L ${toX(34.9)},${toY(31.5)} 
  L ${toX(34.92)},${toY(31.75)} 
  L ${toX(34.93)},${toY(32.0)} 
  L ${toX(35.0)},${toY(32.2)} 
  L ${toX(35.05)},${toY(32.35)} 
  Z`;

const GAZA_PATH = `M ${toX(34.22)},${toY(31.67)} 
  L ${toX(34.56)},${toY(31.67)} 
  L ${toX(34.53)},${toY(31.45)} 
  L ${toX(34.48)},${toY(31.22)} 
  L ${toX(34.22)},${toY(31.22)} 
  Z`;

const DEAD_SEA_PATH = `M ${toX(35.55)},${toY(32.0)} 
  L ${toX(35.62)},${toY(31.8)} 
  L ${toX(35.58)},${toY(31.55)} 
  L ${toX(35.5)},${toY(31.35)} 
  L ${toX(35.44)},${toY(31.35)} 
  L ${toX(35.42)},${toY(31.55)} 
  L ${toX(35.47)},${toY(31.8)} 
  L ${toX(35.52)},${toY(32.0)} 
  Z`;

const JORDAN_RIVER = `M ${toX(35.55)},${toY(32.55)} L ${toX(35.56)},${toY(32.3)} L ${toX(35.57)},${toY(32.0)} L ${toX(35.56)},${toY(31.8)}`;

const cities = [
  { name: 'Jerusalem', nameAr: 'القدس', lat: 31.78, lon: 35.22, size: 7 },
  { name: 'Ramallah', nameAr: 'رام الله', lat: 31.9, lon: 35.2, size: 5 },
  { name: 'Nablus', nameAr: 'نابلس', lat: 32.22, lon: 35.25, size: 5 },
  { name: 'Hebron', nameAr: 'الخليل', lat: 31.53, lon: 35.1, size: 5 },
  { name: 'Jericho', nameAr: 'أريحا', lat: 31.85, lon: 35.44, size: 4 },
  { name: 'Bethlehem', nameAr: 'بيت لحم', lat: 31.7, lon: 35.2, size: 4 },
  { name: 'Jenin', nameAr: 'جنين', lat: 32.45, lon: 35.3, size: 4 },
  { name: 'Tulkarm', nameAr: 'طولكرم', lat: 32.31, lon: 35.03, size: 3 },
  { name: 'Gaza', nameAr: 'غزة', lat: 31.5, lon: 34.47, size: 5 },
];

const trailPaths: Record<string, string> = {
  '1': `M ${toX(35.22)},${toY(31.78)} L ${toX(35.3)},${toY(31.84)} L ${toX(35.38)},${toY(31.85)} L ${toX(35.44)},${toY(31.85)}`,
  '2': `M ${toX(34.88)},${toY(31.62)} L ${toX(34.9)},${toY(31.61)}`,
  '3': `M ${toX(35.1)},${toY(31.72)} L ${toX(35.12)},${toY(31.73)}`,
  '4': `M ${toX(35.25)},${toY(32.2)} L ${toX(35.27)},${toY(32.22)}`,
  '5': `M ${toX(35.47)},${toY(31.52)} L ${toX(35.52)},${toY(31.5)}`,
  '6': `M ${toX(35.18)},${toY(31.88)} L ${toX(35.22)},${toY(31.9)}`,
};

const difficultyMarkerColor: Record<string, string> = {
  Easy: '#7A9A3A',
  Moderate: '#D4A843',
  Hard: '#BB2823',
  Expert: '#630E13',
};

export function PalestineMap({ onTrailSelect, selectedTrailId, height = 480 }: PalestineMapProps) {
  const [hoveredTrail, setHoveredTrail] = useState<string | null>(null);

  return (
    <svg
      viewBox={`0 0 390 ${height}`}
      width="100%"
      height={height}
      style={{ background: 'linear-gradient(135deg, #C5D5A0 0%, #B8C890 30%, #D4C898 60%, #E8DFB8 100%)' }}
    >
      {/* Background terrain gradient */}
      <defs>
        <linearGradient id="terrainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7A9A3A" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#D4C898" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#C4A870" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="deadSeaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5BA3C9" />
          <stop offset="100%" stopColor="#2E7FA8" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
        </filter>
        <filter id="markerShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Background overlay */}
      <rect width="390" height={height} fill="url(#terrainGrad)" />

      {/* Mediterranean Sea */}
      <rect x="0" y="0" width={toX(34.2)} height={height} fill="#7DB3CC" opacity="0.55" />
      <text x="10" y="200" fontSize="8" fill="#1B5E80" opacity="0.7" fontFamily="Cairo, Inter, sans-serif">
        البحر المتوسط
      </text>

      {/* Jordan area (right) */}
      <rect x={toX(35.6)} y="0" width={390 - toX(35.6)} height={height} fill="#D4A870" opacity="0.35" />

      {/* Gaza Strip */}
      <path d={GAZA_PATH} fill="#B8D490" stroke="#5B6435" strokeWidth="1.5" opacity="0.9" />

      {/* West Bank */}
      <path d={WEST_BANK_PATH} fill="#C8D8A0" stroke="#5B6435" strokeWidth="2" filter="url(#shadow)" />

      {/* Terrain texture lines */}
      <path d={`M ${toX(34.95)},${toY(32.3)} Q ${toX(35.1)},${toY(32.1)} ${toX(35.2)},${toY(32.0)}`} fill="none" stroke="#7A9A3A" strokeWidth="0.8" opacity="0.3" />
      <path d={`M ${toX(35.0)},${toY(31.9)} Q ${toX(35.15)},${toY(31.75)} ${toX(35.25)},${toY(31.65)}`} fill="none" stroke="#7A9A3A" strokeWidth="0.8" opacity="0.25" />
      <path d={`M ${toX(35.1)},${toY(31.55)} Q ${toX(35.2)},${toY(31.5)} ${toX(35.3)},${toY(31.45)}`} fill="none" stroke="#7A9A3A" strokeWidth="0.8" opacity="0.2" />

      {/* Dead Sea */}
      <path d={DEAD_SEA_PATH} fill="url(#deadSeaGrad)" stroke="#2E7FA8" strokeWidth="1" opacity="0.9" />
      <text x={toX(35.48)} y={toY(31.68) + 4} fontSize="7" fill="white" fontFamily="Cairo, Inter, sans-serif" textAnchor="middle">
        البحر الميت
      </text>
      <text x={toX(35.48)} y={toY(31.68) + 14} fontSize="7" fill="#E1F5FE" fontFamily="Inter, sans-serif" textAnchor="middle">
        –430m
      </text>

      {/* Jordan River */}
      <path d={JORDAN_RIVER} fill="none" stroke="#5BA3C9" strokeWidth="2" strokeDasharray="4,3" opacity="0.75" />

      {/* Trail paths */}
      {trails.map(trail => (
        <g key={trail.id}>
          <path
            d={trailPaths[trail.id] || ''}
            fill="none"
            stroke={selectedTrailId === trail.id ? '#D4A843' : '#630E13'}
            strokeWidth={selectedTrailId === trail.id ? 3 : 2}
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
      ))}

      {/* Cities */}
      {cities.map(city => (
        <g key={city.name}>
          <circle
            cx={toX(city.lon)}
            cy={toY(city.lat)}
            r={city.size / 2}
            fill="#3D2A18"
            opacity="0.75"
          />
          <text
            x={toX(city.lon) + 5}
            y={toY(city.lat) + 4}
            fontSize="7"
            fill="#2C2418"
            fontFamily="Cairo, Inter, sans-serif"
            opacity="0.85"
          >
            {city.nameAr}
          </text>
        </g>
      ))}

      {/* Trail markers */}
      {trails.map(trail => (
        <g
          key={trail.id}
          style={{ cursor: 'pointer' }}
          onClick={() => onTrailSelect?.(trail)}
          onMouseEnter={() => setHoveredTrail(trail.id)}
          onMouseLeave={() => setHoveredTrail(null)}
        >
          {/* Pulse ring for selected */}
          {selectedTrailId === trail.id && (
            <circle cx={trail.mapX} cy={trail.mapY} r="18" fill="#D4A843" opacity="0.22" />
          )}
          {/* Marker shadow */}
          <circle cx={trail.mapX} cy={trail.mapY + 1} r="9" fill="rgba(0,0,0,0.2)" filter="url(#markerShadow)" />
          {/* Marker */}
          <circle
            cx={trail.mapX}
            cy={trail.mapY}
            r="8"
            fill={selectedTrailId === trail.id ? '#D4A843' : '#630E13'}
            stroke="white"
            strokeWidth="2"
          />
          {/* Difficulty color dot */}
          <circle
            cx={trail.mapX}
            cy={trail.mapY}
            r="3"
            fill={difficultyMarkerColor[trail.difficulty] || '#7A9A3A'}
          />
          {/* Tooltip on hover */}
          {(hoveredTrail === trail.id || selectedTrailId === trail.id) && (
            <g>
              <rect
                x={trail.mapX - 42}
                y={trail.mapY - 33}
                width="84"
                height="22"
                rx="5"
                fill="rgba(44,36,24,0.92)"
              />
              <text x={trail.mapX} y={trail.mapY - 18} fontSize="8" fill="white" textAnchor="middle" fontFamily="Cairo, Inter, sans-serif">
                {trail.nameAr}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Dead Sea special marker */}
      <g>
        <rect x={toX(35.47) - 24} y={toY(31.5) - 13} width="48" height="16" rx="4" fill="#2E7FA8" opacity="0.9" />
        <text x={toX(35.47)} y={toY(31.5) - 2} fontSize="7.5" fill="white" textAnchor="middle" fontFamily="Inter, sans-serif">
          ⬇ –430m
        </text>
      </g>
    </svg>
  );
}