import React, { useState, useEffect, useRef, memo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
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
    const firstOptionRef = useRef<HTMLDivElement>(null);
    const selectedOption =
      options.find((opt) => opt.value === value) || { value: '', label: isRtl ? 'اختر' : 'Select' };

    // إغلاق الـ dropdown لما نضغط برا
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        firstOptionRef.current?.focus();
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // دعم التنقل باستخدام لوحة المفاتيح
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
      <div className={`relative group ${className}`} ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <motion.button
          type="button"
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-xs text-gray-700 dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          role="combobox"
        >
          <span className="truncate">{selectedOption.label}</span>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-gray-400 group-focus-within:text-amber-500 dark:group-focus-within:text-amber-400 transition-colors" />
          </motion.div>
        </motion.button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 z-20 max-h-48 overflow-y-auto scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
              {options.map((option, index) => (
                <motion.div
                  key={option.value}
                  ref={index === 0 ? firstOptionRef : null}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(option.value);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  onKeyDown={(e) => handleKeyDown(e, option.value)}
                  className={`px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors duration-200 focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-900 focus:text-amber-600 dark:focus:text-amber-400 ${isRtl ? 'text-right' : 'text-left'}`}
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