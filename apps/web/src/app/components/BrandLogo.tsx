const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

type BrandLogoSize = keyof typeof sizeClasses;

interface BrandLogoProps {
  showText?: boolean;
  tone?: 'light' | 'dark';
  size?: BrandLogoSize;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export function BrandLogo({
  showText = true,
  tone = 'light',
  size = 'md',
  className = '',
  imageClassName = '',
  textClassName = '',
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="Traces logo"
        className={`block object-contain ${sizeClasses[size]} ${
          tone === 'dark' ? 'invert' : ''
        } ${imageClassName}`}
      />
      {showText && <span className={textClassName}>Traces</span>}
    </div>
  );
}
