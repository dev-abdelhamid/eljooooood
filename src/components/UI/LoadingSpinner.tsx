import React, { useRef, useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-16 h-16'
  };

  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg className={`${sizes[size]}`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {length > 0 && (
          <style>
            {`@keyframes draw {
              0% {
                stroke-dashoffset: ${length};
              }
              100% {
                stroke-dashoffset: 0;
              }
            }`}
          </style>
        )}
        <g transform="translate(20, 10) scale(1.2)">
          <path
            ref={pathRef}
            d="M45.691667,45.15 C48.591667,46.1 50.691667,48.95 50.691667,52.2 C50.691667,57.95 46.691667,61 40.291667,61 L28.541667,61 L28.541667,30.3 L39.291667,30.3 C45.691667,30.3 49.691667,33.15 49.691667,38.65 C49.691667,41.95 47.941667,44.35 45.691667,45.15 Z M33.591667,43.2 L39.241667,43.2 C42.791667,43.2 44.691667,41.85 44.691667,38.95 C44.691667,36.05 42.791667,34.8 39.241667,34.8 L33.591667,34.8 L33.591667,43.2 Z M33.591667,47.5 L33.591667,56.5 L40.191667,56.5 C43.691667,56.5 45.591667,54.75 45.591667,52 C45.591667,49.2 43.691667,47.5 40.191667,47.5 L33.591667,47.5 Z"
            fill="none"
            stroke="#B45309"
            strokeWidth="2"
            style={length > 0 ? { strokeDasharray: length, animation: 'draw 2s ease-in-out infinite' } : {}}
          />
        </g>
      </svg>
    </div>
  );
}