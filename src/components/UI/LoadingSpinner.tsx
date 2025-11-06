import React, { useRef, useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'lg', className = '' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64'
  };

  const jRef = useRef<SVGPathElement>(null);
  const bRef = useRef<SVGPathElement>(null);
  const leafRef = useRef<SVGPathElement>(null);
  const [jLength, setJLength] = useState(0);
  const [bLength, setBLength] = useState(0);

  useEffect(() => {
    if (jRef.current) setJLength(jRef.current.getTotalLength());
    if (bRef.current) setBLength(bRef.current.getTotalLength());
  }, []);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`${sizes[size]} drop-shadow-2xl`}
        viewBox="0 0 280 280"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* الورقة تنبت من الصفر */}
        <g className="leaf-group">
          <path
            ref={leafRef}
            d="M 78 68 
               C 76 62, 78 56, 82 56 
               C 86 56, 88 62, 86 68 
               L 82 80 
               L 78 68"
            fill="#b45309"
            className="leaf"
          />
        </g>

        {/* J - يُرسم أولاً */}
        <path
          ref={jRef}
          d="M 55 200 
             C 40 200, 30 185, 30 165 
             C 30 145, 40 130, 55 130 
             L 75 130 
             Q 85 130, 90 140 
             Q 95 150, 95 165 
             Q 95 185, 80 195 
             L 75 200 
             Z"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#glow)"
          className="draw-j"
          style={{ strokeDasharray: jLength, strokeDashoffset: jLength }}
        />

        {/* B - يُرسم بعد J */}
        <path
          ref={bRef}
          d="M 120 130 
             L 120 200 
             L 155 200 
             Q 180 200, 195 185 
             Q 210 170, 210 150 
             Q 210 135, 200 125 
             Q 215 115, 215 95 
             Q 215 70, 195 60 
             Q 175 50, 155 50 
             L 120 50 
             Z
             M 140 75 L 155 75 
             Q 165 75, 170 80 
             Q 175 85, 175 95 
             Q 175 105, 170 110 
             Q 165 115, 155 115 
             L 140 115 
             Z
             M 140 135 L 155 135 
             Q 170 135, 180 142 
             Q 190 149, 190 158 
             Q 190 167, 180 173 
             Q 170 180, 155 180 
             L 140 180 
             Z"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#glow)"
          className="draw-b"
          style={{ strokeDasharray: bLength, strokeDashoffset: bLength }}
        />

        {/* الأنيميشن السحري */}
        <style jsx>{`
          @keyframes drawJ {
            to { stroke-dashoffset: 0; }
          }
          @keyframes drawB {
            to { stroke-dashoffset: 0; }
          }
          @keyframes growLeaf {
            0%   { transform: scale(0) translateY(30px); opacity: 0; }
            70%  { transform: scale(0.3) translateY(10px); opacity: 0.6; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50%      { transform: translateY(-6px) rotate(2deg); }
          }

          .draw-j {
            animation: drawJ 2.2s ease-out 0.3s forwards infinite;
          }
          .draw-b {
            animation: drawB 2.2s ease-out 1.2s forwards infinite;
          }
          .leaf-group {
            transform-origin: 82px 80px;
            animation: growLeaf 2.8s ease-out 1.8s forwards infinite,
                       float 5s ease-in-out 3s infinite;
          }
        `}</style>
      </svg>
    </div>
  );
}