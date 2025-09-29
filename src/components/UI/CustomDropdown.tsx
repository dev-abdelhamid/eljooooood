import React, { useState, useEffect, useRef, memo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}

export const CustomDropdown = memo(
  ({ value, onChange, options, ariaLabel, className = '' }: CustomDropdownProps) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const selectedOption =
      options.find((opt) => opt.value === value) || { value: '', label: isRtl ? 'اختر' : 'Select' };

    // إغلاق الـ dropdown عند النقر خارج العنصر
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

    // التعامل مع التنقل باستخدام لوحة المفاتيح
    const handleKeyDown = (e: React.KeyboardEvent, optionValue?: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (optionValue !== undefined) {
          onChange(optionValue);
          setIsOpen(false);
          buttonRef.current?.focus();
        } else {
          setIsOpen(!isOpen);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const nextIndex = (currentIndex + 1) % options.length;
        onChange(options[nextIndex].value);
        (dropdownRef.current?.querySelectorAll('[role="option"]')[nextIndex] as HTMLElement)?.focus();
      } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        onChange(options[prevIndex].value);
        (dropdownRef.current?.querySelectorAll('[role="option"]')[prevIndex] as HTMLElement)?.focus();
      }
    };

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <motion.button
          type="button"
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm hover:shadow-md text-sm text-gray-800 transition-colors flex justify-between items-center ${isRtl ? 'text-right' : 'text-left'}`}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          role="combobox"
        >
          <span className="truncate">{selectedOption.label}</span>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </motion.div>
        </motion.button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute w-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto"
            >
              {options.map((option, index) => (
                <motion.div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  onKeyDown={(e) => handleKeyDown(e, option.value)}
                  className={`px-4 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer transition-colors focus:outline-none focus:bg-blue-50 focus:text-blue-600 ${isRtl ? 'text-right' : 'text-left'}`}
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={0}
                >
                  {option.label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);