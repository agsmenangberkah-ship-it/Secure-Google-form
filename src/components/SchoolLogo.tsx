import { useState } from 'react';
import { SCHOOL_INFO } from '../utils/examConfig';

interface SchoolLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SchoolLogoProps['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11 sm:h-12 sm:w-12',
  lg: 'h-16 w-16 sm:h-20 sm:w-20',
};

export function SchoolLogo({ size = 'md', className = '' }: SchoolLogoProps) {
  const [hasError, setHasError] = useState(false);

  const dimensionClass = SIZE_CLASSES[size];

  if (hasError) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-blue-800 text-white ring-2 ring-amber-400/70 ${dimensionClass} ${className}`}
        aria-label={`Logo ${SCHOOL_INFO.schoolNameTitle}`}
      >
        <svg
          viewBox="0 0 40 40"
          className="h-3/5 w-3/5"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 4L33 9.5V19.5C33 27.5 27.5 34 20 36.5C12.5 34 7 27.5 7 19.5V9.5L20 4Z"
            stroke="#FACC15"
            strokeWidth="2.5"
            fill="rgba(255,255,255,0.12)"
          />
          <path
            d="M15 20.5L18.5 24L26 16.5"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-slate-200 ${dimensionClass} ${className}`}
    >
      <img
        src={SCHOOL_INFO.logoUrl}
        alt={`Logo ${SCHOOL_INFO.schoolNameTitle}`}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
