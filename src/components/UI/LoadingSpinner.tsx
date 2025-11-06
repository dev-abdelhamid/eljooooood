import React, { useRef, useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-20 h-24',
    md: 'w-32 h-36',
    lg: 'w-40 h-44'
  };

  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  // مسار حرف B + الزخرفة العلوية (السنبلة) بدقة عالية جدًا ومطابقة للشعار
  const bLogoPath = `
    M 45 15 
    Q 48 10, 50 8
    Q 52 6, 54 6
    Q 56 6, 57 8
    L 56 10
    Q 55 11, 53 11
    Q 51 11, 50 10
    Q 49 9, 48 9
    Q 47 9, 46 10
    Q 45 11, 45 12
    L 45 15
    Z
    M 35 25 
    C 48 25, 55 30, 55 40
    C 55 46, 51 50, 45 51
    C 51 52, 55 56, 55 62
    C 55 72, 48 77, 35 77
    L 20 77
    L 20 25
    L 35 25
    Z
    M 28 35 L 28 67
    M 35 35
    C 42 35, 46 36, 46 41
    C 46 45, 42 46, 35 46
    L 28 46
    M 35 56
    C 42 56, 46 57, 46 62
    C 46 66, 42 67, 35 67
    L 28 67
  `;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`${sizes[size]} animate-pulse`}
        viewBox="0 0 80 100"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
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
                0%, 50% { opacity: 0; }
                100% { opacity: 1; }
              }
              .draw-path {
                stroke-dasharray: ${length};
                stroke-dashoffset: ${length};
                animation: draw 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite,
                           fadeIn 2.4s ease-in-out infinite;
              }
              .fill-path {
                animation: fadeIn 2.4s ease-in-out infinite;
                animation-delay: 1.2s;
              }
              @keyframes pulse {
                0%, 100% { opacity: 0.95; }
                50% { opacity: 0.8; }
              }
              .animate-pulse { animation: pulse 2.4s ease-in-out infinite; }
            `}
          </style>
        )}

        <g transform="translate(2, 5)">
          {/* رسم الحدود */}
          <path
            ref={pathRef}
            d={bLogoPath}
            fill="none"
            stroke="#B45309"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="draw-path"
          />

          {/* الملء الداخلي */}
          <path
            d={bLogoPath}
            fill="none"
            stroke="#fef3c7"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="fill-path"
          />
        </g>

        {/* إطار الشعار (مربع رفيع) */}
        <rect
          x="5"
          y="8"
          width="70"
          height="84"
          rx="8"
          fill="none"
          stroke="#B45309"
          strokeWidth="1.5"
          opacity="0.7"
          className="fill-path"
        />
      </svg>
    </div>
  );
}