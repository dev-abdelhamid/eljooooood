import React, { useRef, useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-24 h-20',
    md: 'w-36 h-28',
    lg: 'w-48 h-36'
  };

  const pathRef = useRef<SVGPathElement>(null);
  const leafRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`${sizes[size]} drop-shadow-2xl`}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          <filter id="softGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* الورقة الأصلية تمامًا – تنبض وتطفو */}
        <path
          ref={leafRef}
          d="M23.5 19.5 C23.5 18.4 24.4 17.5 25.5 17.5 C26.6 17.5 27.5 18.4 27.5 19.5 C27.5 20.6 26.6 21.5 25.5 21.5 C24.4 21.5 23.5 20.6 23.5 19.5 Z"
          fill="#b45309"
          className="leaf"
        />

        {/* JB الأصلي – لا تغيير في حرف واحد */}
        {length > 0 && (
          <g transform="translate(20, 10) scale(1.2)">
            <path
              ref={pathRef}
              d="M45.691667,45.15 C48.591667,46.1 50.691667,48.95 50.691667,52.2 C50.691667,57.95 46.691667,61 40.291667,61 L28.541667,61 L28.541667,30.3 L39.291667,30.3 C45.691667,30.3 49.691667,33.15 49.691667,38.65 C49.691667,41.95 47.941667,44.35 45.691667,45.15 Z M33.591667,43.2 L39.241667,43.2 C42.791667,43.2 44.691667,41.85 44.691667,38.95 C44.691667,36.05 42.791667,34.8 39.241667,34.8 L33.591667,34.8 L33.591667,43.2 Z M33.591667,47.5 L33.591667,56.5 L40.191667,56.5 C43.691667,56.5 45.591667,54.75 45.591667,52 C45.591667,49.2 43.691667,47.5 40.191667,47.5 L33.591667,47.5 Z"
              fill="none"
              stroke="url(#gold)"
              strokeWidth="2.8"
              strokeLinecap="round"
              filter="url(#softGlow)"
              style={{
                strokeDasharray: length,
                strokeDashoffset: length,
              }}
              className="jb-draw"
            />
          </g>
        )}

        {/* الأنيميشن السحري */}
        <style jsx>{`
          @keyframes draw {
            to { stroke-dashoffset: 0; }
          }
          @keyframes leafPop {
            0%   { transform: scale(0)   rotate(-180deg); opacity: 0; }
            60%  { transform: scale(0.5) rotate(-60deg);  opacity: 0.8; }
            100% { transform: scale(1)   rotate(0deg);    opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-4px); }
          }

          .jb-draw {
            animation: draw 2.8s cubic-bezier(0.4, 0, 0.2, 1) forwards infinite;
          }
          .leaf {
            transform-origin: 25.5px 19.5px;
            animation: 
              leafPop 2.8s ease-out 0.6s forwards infinite,
              float 3.6s ease-in-out infinite;
          }
        `}</style>
      </svg>
    </div>
  );
}