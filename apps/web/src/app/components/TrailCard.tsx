import { MapPin, Clock, TrendingUp, Star, Bookmark, Download } from 'lucide-react';
import { Link } from 'react-router';
import { ImageWithFallback } from './ImageWithFallback';

interface TrailCardProps {
  id: string;
  name: string;
  nameAr?: string;
  region: string;
  regionAr?: string;
  distance: string;
  duration: string;
  elevation: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  rating: number;
  reviewCount: number;
  image: string;
  downloaded?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onDownload?: () => void;
}

const difficultyConfig = {
  easy: { label: 'Easy', className: 'bg-green-100 text-green-700 border-green-200' },
  moderate: { label: 'Moderate', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  hard: { label: 'Hard', className: 'bg-red-100 text-red-700 border-red-200' },
};

export function TrailCard({
  id,
  name,
  nameAr,
  region,
  distance,
  duration,
  elevation,
  difficulty,
  rating,
  reviewCount,
  image,
  downloaded,
  saved,
  onSave,
  onDownload,
}: TrailCardProps) {
  const diff = difficultyConfig[difficulty];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative h-48 overflow-hidden">
        <Link to={`/trail/${id}`}>
          <ImageWithFallback
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
        <div className="absolute top-3 right-3 flex gap-2">
          {onSave && (
            <button
              onClick={(e) => { e.preventDefault(); onSave(); }}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm"
            >
              <Bookmark
                className={`w-4 h-4 ${saved ? 'fill-primary text-primary' : 'text-foreground'}`}
              />
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => { e.preventDefault(); onDownload(); }}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm"
            >
              <Download
                className={`w-4 h-4 ${downloaded ? 'text-green-600' : 'text-foreground'}`}
              />
            </button>
          )}
        </div>
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${diff.className}`}>
            {diff.label}
          </span>
        </div>
      </div>

      <div className="p-4">
        <Link to={`/trail/${id}`}>
          <h3 className="font-semibold text-foreground mb-1 hover:text-primary transition-colors">
            {name}
          </h3>
        </Link>
        {nameAr && <p className="text-sm text-muted-foreground mb-2">{nameAr}</p>}

        <div className="flex items-center gap-1 text-muted-foreground mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-sm">{region}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="flex flex-col items-center p-2 bg-background rounded-lg">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground mb-1" />
            <span className="text-xs font-medium text-foreground">{distance}</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-background rounded-lg">
            <Clock className="w-3.5 h-3.5 text-muted-foreground mb-1" />
            <span className="text-xs font-medium text-foreground">{duration}</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-background rounded-lg">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground mb-1 rotate-90" />
            <span className="text-xs font-medium text-foreground">{elevation}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium text-foreground">{rating}</span>
          <span className="text-sm text-muted-foreground">({reviewCount})</span>
        </div>
      </div>
    </div>
  );
}
