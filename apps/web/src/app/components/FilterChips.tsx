import { ReactNode } from 'react';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}

export function FilterChip({ label, active, onClick, icon }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors whitespace-nowrap ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border hover:bg-muted/20'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface FilterChipsContainerProps {
  children: ReactNode;
}

export function FilterChipsContainer({ children }: FilterChipsContainerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {children}
    </div>
  );
}
