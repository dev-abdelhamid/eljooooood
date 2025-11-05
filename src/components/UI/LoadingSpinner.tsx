import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LogoLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

export function LogoLoadingSpinner({ 
  size = 'lg', 
  className = '', 
  showText = true,
  animate = true 
}: LogoLoadingSpinnerProps) {
  const sizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-40 h-40',
    xxl: 'w-56 h-56'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    xxl: 'text-5xl'
  };

  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      const totalLength = pathRef.current.getTotalLength();
      setLength(totalLength);
    }
  }, []);

  // مسار حرف B مع الزخرفة (أدق من الأصل + محسن)
  const logoPath = `
    M 42,62 
    C 48,62 52,58 52,52 
    C 52,46 48,42 42,42 
    L 32,42 
    L 32,62 
    Z 
    M 32,38 
    L 42,38 
    C 46,38 48,36 48,33 
    C 48,30 46,28 42,28 
    L 32,28 
    L 32,38 
    Z 
    M 32,24 
    L 32,18 
    L 48,18 
    C 54,18 58,22 58,28 
    C 58,34 54,38 48,38 
    L 32,38 
    Z
  `;

  // مسار الورقة (زخرفة فوق B)
  const leafPath = `
    M 38,12 
    C 36,10 36,8 38,7 
    C 40,6 42,7 43,9 
    C 44,11 43,13 41,14 
    C 39,15 37,14 36,12 
    Z 
    M 39,9 
    L 39,5 
    M 36.5,10.5 
    L 33,8 
    M 41.5,10.5 
    L 45,8
  `;

  return (
    <div className={`flex flex-col items-center justify-center space-y-6 ${className}`}>
      {/* الشعار مع التأثيرات */}
      <motion.div
        initial={animate ? { scale: 0.8, opacity: 0 } : false}
        animate={animate ? { scale: 1, opacity: 1 } : false}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`${sizes[size]} relative`}
      >
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full drop-shadow-2xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* خلفية فاخرة مع تدرج ونسيج */}
          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF8F0" />
              <stop offset="50%" stopColor="#FEF3E8" />
              <stop offset="100%" stopColor="#FFF8F0" />
            </linearGradient>
            <filter id="paperTexture">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
              <feDiffuseLighting in="noise" lightingColor="#FFF8F0" surfaceScale="2">
                <feDistantLight azimuth="45" elevation="60" />
              </feDiffuseLighting>
            </filter>
            <filter id="goldGlow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood floodColor="#B45309" floodOpacity="0.4"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <pattern id="grain" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="#FEF3E8"/>
              <rect width="100" height="100" fill="url(#bgGradient)" opacity="0.7"/>
            </pattern>
          </defs>

          {/* إطار خارجي فاخر */}
          <motion.rect
            x="5" y="5" width="90" height="90"
            rx="12" ry="12"
            fill="url(#grain)"
            stroke="#B45309"
            strokeWidth="1.5"
            filter="url(#paperTexture)"
            initial={animate ? { scale: 0.9, opacity: 0 } : false}
            animate={animate ? { scale: 1, opacity: 1 } : false}
            transition={{ delay: 0.2, duration: 0.8 }}
          />

          {/* الشعار الرئيسي */}
          <g transform="translate(25, 20) scale(1.8)">
            {/* الورقة */}
            <motion.path
              d={leafPath}
              fill="#B45309"
              initial={animate ? { scale: 0, rotate: -180 } : false}
              animate={animate ? { scale: 1, rotate: 0 } : false}
              transition={{ delay: 0.4, duration: 0.6, type: "spring", stiffness: 200 }}
            />

            {/* حرف B */}
            <motion.path
              ref={pathRef}
              d={logoPath}
              fill="none"
              stroke="#B45309"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#goldGlow)"
              initial={animate ? { pathLength: 0, opacity: 0 } : false}
              animate={animate ? { pathLength: 1, opacity: 1 } : false}
              transition={{ delay: 0.6, duration: 1.5, ease: "easeInOut" }}
              style={length > 0 && animate ? {
                strokeDasharray: length,
                strokeDashoffset: length,
                animation: `draw 3s ease-in-out infinite`,
              } : {}}
            />

            {/* تأثير لمعان داخلي */}
            <motion.path
              d={logoPath}
              fill="none"
              stroke="url(#goldGradient)"
              strokeWidth="1"
              opacity="0.6"
              initial={animate ? { pathLength: 0 } : false}
              animate={animate ? { pathLength: 1 } : false}
              transition={{ delay: 1.2, duration: 1.2 }}
            />
          </g>

          {/* تأثيرات إضافية */}
          <motion.circle
            cx="50" cy="50"
            r="45"
            fill="none"
            stroke="#B45309"
            strokeWidth="0.5"
            opacity="0.1"
            initial={animate ? { scale: 0.8 } : false}
            animate={animate ? { scale: 1.1 } : false}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </svg>

        {/* ظل أرضي */}
        <div className="absolute inset-0 blur-3xl">
          <div className="w-full h-full bg-gradient-to-t from-amber-900/20 to-transparent rounded-full"></div>
        </div>
      </motion.div>

      {/* النص */}
      {showText && (
        <motion.div
          initial={animate ? { y: 20, opacity: 0 } : false}
          animate={animate ? { y: 0, opacity: 1 } : false}
          transition={{ delay: 1, duration: 0.8 }}
          className={`font-bold tracking-widest ${textSizes[size]} bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 bg-clip-text text-transparent`}
          style={{
            fontFamily: '"Geeza Pro", "Arial", sans-serif',
            letterSpacing: '0.3em',
            textShadow: '0 2px 4px rgba(180, 83, 9, 0.2)'
          }}
        >
          الجودية
        </motion.div>
      )}

      {/* حركة دوران خفيفة للشعار */}
      {animate && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="w-full h-full bg-gradient-to-t from-amber-500/5 to-transparent rounded-full"></div>
        </motion.div>
      )}

      <style jsx>{`
        @keyframes draw {
          from {
            stroke-dashoffset: ${length};
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}