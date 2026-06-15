import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  variant?: 'primary' | 'success';
}

export function StatCard({ icon, label, value, unit, variant }: StatCardProps) {
  const accentClass =
    variant === 'primary'
      ? 'text-primary'
      : variant === 'success'
      ? 'text-green-600'
      : 'text-foreground';

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">{icon}</div>
      <p className={`text-2xl font-semibold ${accentClass}`}>
        {value}
        {unit && <span className="text-base font-normal ml-1">{unit}</span>}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
