import React, { useState, useEffect, useRef, memo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: Option[];
  placeholder?: string;
  multiple?: boolean;
  ariaLabel: string;
  className?: string;
}

export const CustomDropdown = memo(
  ({
    value,
    onChange,
    options,
    placeholder,
    multiple = false,
    ariaLabel,
    className = '',
  }: CustomDropdownProps) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // تحديد القيم المختارة
    const selectedValues = multiple
      ? Array.isArray(value)
        ? value
        : []
      : value
      ? [value]
      : [];

    const selectedLabels = options
      .filter((opt) => selectedValues.includes(opt.value))
      .map((opt) => opt.label);

    const displayText =
      selectedLabels.length > 0
        ? selectedLabels.join(', ')
        : placeholder || (isRtl ? 'اختر' : 'Select');

    // تصفية الخيارات بناءً على البحث
    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    );

    // إغلاق عند النقر خارج
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearch('');
        }
      };
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // فوكس على حقل البحث عند الفتح
    useEffect(() => {
      if (isOpen && multiple && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isOpen, multiple]);

    // تبديل الخيار
    const toggleOption = (optionValue: string) => {
      if (!multiple) {
        onChange(optionValue);
        setIsOpen(false);
        setSearch('');
        buttonRef.current?.focus();
        return;
      }

      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];

      onChange(newValues);
    };

    // إزالة عنصر مختار
    const removeSelected = (optionValue: string) => {
      if (multiple) {
        onChange(selectedValues.filter((v) => v !== optionValue));
      }
    };

    // التنقل بلوحة المفاتيح
    const handleKeyDown = (e: React.KeyboardEvent, optionValue?: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (optionValue !== undefined) {
          toggleOption(optionValue);
          if (!multiple) {
            setIsOpen(false);
            buttonRef.current?.focus();
          }
        } else {
          setIsOpen(!isOpen);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
        buttonRef.current?.focus();
      } else if (e.key === 'ArrowDown' && isOpen && !multiple) {
        e.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const nextIndex = (currentIndex + 1) % options.length;
        onChange(options[nextIndex].value);
      } else if (e.key === 'ArrowUp' && isOpen && !multiple) {
        e.preventDefault();
        const currentIndex = options.findIndex((opt) => opt.value === value);
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        onChange(options[prevIndex].value);
      }
    };

    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* زر الـ Dropdown */}
        <motion.button
          type="button"
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`
            w-full px-4 py-1.5 border border-gray-200 rounded-md 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent 
            bg-white shadow-sm hover:shadow-md text-sm text-gray-800 
            transition-colors flex justify-between items-center 
            ${isRtl ? 'text-right' : 'text-left'}
            ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
          `}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          role="combobox"
          aria-multiselectable={multiple}
        >
          <div className="flex-1 flex flex-wrap gap-1 items-center min-h-[1.5rem] pr-1">
            {multiple && selectedLabels.length > 0 ? (
              selectedLabels.map((label, idx) => (
                <span
                  key={selectedValues[idx]}
                  className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelected(selectedValues[idx]);
                    }}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="truncate">{displayText}</span>
            )}
          </div>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </motion.div>
        </motion.button>

        {/* قائمة الخيارات */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute w-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto"
            >
              {/* حقل البحث عند multiple */}
              {multiple && (
                <div className="p-2 border-b border-gray-100">
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={isRtl ? 'ابحث...' : 'Search...'}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* الخيارات */}
              <div className="py-1">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-gray-500 text-center">
                    {isRtl ? 'لا توجد خيارات' : 'No options'}
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <motion.div
                        key={option.value}
                        onClick={() => toggleOption(option.value)}
                        onKeyDown={(e) => handleKeyDown(e, option.value)}
                        className={`
                          px-4 py-1.5 text-sm text-gray-800 cursor-pointer 
                          transition-colors focus:outline-none 
                          ${isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-blue-50'}
                          ${isRtl ? 'text-right' : 'text-left'}
                        `}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

CustomDropdown.displayName = 'CustomDropdown';