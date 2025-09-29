// src/components/CustomDropdown.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CustomDropdownProps {
  value: string | boolean;
  onChange: (value: string) => void;
  options: { value: string | boolean; label: string }[];
  ariaLabel: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative group" ref={dropdownRef}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
        role="combobox"
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
          <ChevronDown className="w-4 h-4 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-300 z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100"
          >
            {options.map((option) => (
              <motion.div
                key={option.value.toString()}
                onClick={() => {
                  onChange(option.value.toString());
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-amber-100 hover:text-amber-700 cursor-pointer transition-colors duration-200"
                whileHover={{ backgroundColor: '#fde68a' }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};