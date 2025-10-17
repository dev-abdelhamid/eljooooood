import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
  count?: number; // Number of skeleton cards to display
  className?: string; // Additional classes for customization
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 5, className = '' }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  // Animation for the skeleton pulse effect
  const pulseAnimation = {
    opacity: [1, 0.7, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  };

  return (
    <div className={`space-y-6 ${className}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          className="p-4 sm:p-6 bg-white shadow-md rounded-xl border border-gray-200"
          animate={pulseAnimation}
          role="status"
          aria-label="Loading order card"
        >
          <div className="flex flex-col gap-4">
            {/* Header: Order number and status */}
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="h-6 w-32 bg-gray-200 rounded-md"></div>
              <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div className="bg-gray-200 h-2.5 rounded-full w-1/2"></div>
            </div>
            {/* Order details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-5 w-40 bg-gray-200 rounded-md"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-5 w-24 bg-gray-200 rounded-md"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-5 w-32 bg-gray-200 rounded-md"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-gray-200 rounded-md mb-2"></div>
                <div className="h-5 w-28 bg-gray-200 rounded-md"></div>
              </div>
            </div>
            {/* Items list */}
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, itemIndex) => (
                <div
                  key={itemIndex}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                      <div className="h-5 w-48 bg-gray-200 rounded-md"></div>
                    </div>
                    <div className="h-4 w-32 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-28 bg-gray-200 rounded-md"></div>
                    <div className="h-4 w-36 bg-gray-200 rounded-md"></div>
                  </div>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <div className="h-5 w-24 bg-gray-200 rounded-md mb-2"></div>
                    <div className="h-4 w-20 bg-gray-200 rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Buttons */}
            <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <div className="h-10 w-24 bg-gray-200 rounded-full"></div>
              <div className="h-10 w-24 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default SkeletonLoader;