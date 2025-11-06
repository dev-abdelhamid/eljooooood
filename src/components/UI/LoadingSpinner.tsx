import React, { useEffect, useRef } from 'react';

export default function LoadingSpinner() {
  const leafRef = useRef<SVGPathElement>(null);
  const jRef = useRef<SVGPathElement>(null);
  const bRef = useRef<SVGPathElement>(null);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="relative">
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          className="drop-shadow-2xl"
        >
          {/* خلفية توهج دافئة */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* دوران خفيف للكل */}
          <g className="animate-spin-slow origin-center">
            {/* J مع تأثير الرسم */}
            <path
              ref={jRef}
              d="M 55 135 
                   C 45 135, 38 128, 38 118 
                   C 38 108, 45 95, 55 95 
                   L 65 95 
                   L 65 135 
                   Z"
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              className="draw-j"
              filter="url(#glow)"
            />

            {/* B مع تأثير الرسم */}
            <path
              ref={bRef}
              d="M 90 95 
                   C 105 95, 115 102, 115 115 
                   C 115 125, 108 130, 100 132 
                   C 110 134, 118 140, 118 150 
                   C 118 162, 108 170, 95 170 
                   L 80 170 
                   L 80 95 
                   Z 
                   M 90 105 L 90 125 
                   M 90 135 L 90 160"
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              className="draw-b delay-300"
              filter="url(#glow)"
            />

            {/* الورقة النابتة */}
            <g className="origin-center leaf-grow">
              <path
                ref={leafRef}
                d="M 50 70 
                     C 48 65, 50 60, 53 60 
                     C 56 60, 58 65, 56 70 
                     L 53 78 
                     L 50 70"
                fill="#d97706"
                className="leaf-path"
              />
            </g>
          </g>

          {/* نبضة خفيفة */}
          <circle
            cx="90"
            cy="90"
            r="4"
            fill="#f59e0b"
            className="animate-ping"
          />
        </svg>

        <style jsx>{`
          @keyframes draw-j {
            from { stroke-dashoffset: 100; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes draw-b {
            from { stroke-dashoffset: 100; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes leaf-grow {
            0% { transform: scale(0) rotate(-180deg); opacity: 0; }
            60% { transform: scale(0.3) rotate(-90deg); opacity: 0.6; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .draw-j {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw-j 2.5s ease-out forwards infinite;
          }
          .draw-b {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: draw-b 2.5s ease-out 0.4s forwards infinite;
          }
          .leaf-grow {
            animation: leaf-grow 3s ease-out 1s forwards infinite;
          }
          .animate-spin-slow {
            animation: spin-slow 20s linear infinite;
          }
        `}</style>
      </div>

      <div className="mt-8 text-center">
        <p className="text-amber-700 font-medium animate-pulse">جاري التحميل بأناقة...</p>
      </div>
    </div>
  );
}