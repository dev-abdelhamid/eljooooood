import React, { useRef, useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-20 h-16',
    md: 'w-32 h-20',
    lg: 'w-40 h-32'
  };

  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  const bPath = `
    M 35 25 
    C 45 25, 52 28, 52 35
    C 52 40, 48 43, 43 44
    C 48 45, 52 48, 52 54
    C 52 61, 45 64, 35 64
    L 20 64
    L 20 25
    L 35 25
    Z
    M 28 32 L 28 57
    M 35 32
    C 40 32, 43 33, 43 36
    C 43 39, 40 40, 35 40
    L 28 40
    M 35 49
    C 40 49, 43 50, 43 53
    C 43 56, 40 57, 35 57
    L 28 57
  `;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`${sizes[size]} animate-pulse`}
        viewBox="0 0 80 90"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(180, 83, 9, 0.15))' }}
      >
        {length > 0 && (
          <style>
            {`
              @keyframes draw {
                0% { stroke-dashoffset: ${length}; }
                70% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes fadeIn {
                0% { opacity: 0; }
                50% { opacity: 0; }
                100% { opacity: 1; }
              }
              .draw-path {
                stroke-dasharray: ${length};
                stroke-dashoffset: ${length};
                animation: draw 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite,
                           fadeIn 2.2s ease-in-out infinite;
              }
              .fill-path {
                animation: fadeIn 2.2s ease-in-out infinite;
              }
            `}
          </style>
        )}

        <g transform="translate(2, 2)">
          <path
            ref={pathRef}
            d={bPath}
            fill="none"
            stroke="#B45309"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="draw-path"
          />
          <path
            d={bPath}
            fill="none"
            stroke="#fef3c7"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="fill-path"
            style={{ animationDelay: '1s' }}
          />
        </g>

        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 0.9; }
              50% { opacity: 0.7; }
            }
            .animate-pulse { animation: pulse 2.2s ease-in-out infinite; }
          `}
        </style>
      </svg>
    </div>
  );
}