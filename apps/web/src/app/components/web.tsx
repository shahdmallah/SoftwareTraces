import type { ReactNode } from 'react';
import { ArrowRight, Image, MapPin } from 'lucide-react';
import type { Trail } from '../data/trails';

export const difficultyTone: Record<Trail['difficulty'], string> = {
  Easy: 'easy',
  Moderate: 'moderate',
  Hard: 'hard',
  Expert: 'expert',
};

export function BrandMark() {
  return (
    <div className="brand-mark" aria-label="Traces">
      <span className="brand-pin">T</span>
      <span>
        <strong>Traces</strong>
      </span>
    </div>
  );
}

export function PageShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <main className={compact ? 'page-shell page-shell--compact' : 'page-shell'}>{children}</main>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title = 'No items available yet.', description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="alert">{message}</div>;
}

export function TrailCard({ trail, onClick, compact = false }: { trail: Trail; onClick?: () => void; compact?: boolean }) {
  return (
    <article className={compact ? 'trail-card trail-card--compact' : 'trail-card'} onClick={onClick}>
      <div className="trail-card__image">
        {trail.image ? <img src={trail.image} alt={trail.name} /> : <Image size={28} />}
        <span className={`difficulty-pill difficulty-pill--${difficultyTone[trail.difficulty]}`}>{trail.difficulty}</span>
      </div>
      <div className="trail-card__body">
        <div>
          {trail.region ? (
            <div className="trail-card__meta">
              <MapPin size={14} />
              {trail.region}
            </div>
          ) : null}
          <h3>{trail.name}</h3>
          {trail.description ? <p>{trail.description}</p> : null}
        </div>
        <div className="trail-card__footer">
          <span>{trail.distance} km</span>
          {trail.duration ? <span>{trail.duration}</span> : null}
          <span>{Math.round(trail.elevationGain)} m gain</span>
          {trail.reviews > 0 ? <span>{trail.rating.toFixed(1)} rating</span> : null}
        </div>
      </div>
      {onClick ? <ArrowRight className="trail-card__arrow" size={18} /> : null}
    </article>
  );
}

export function LoadingPanel({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="loading-panel">
      <span className="loader" />
      {label}
    </div>
  );
}
