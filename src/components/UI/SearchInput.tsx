import React, { useState, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isRtl: boolean;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder, isRtl, className }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div
      className={`relative flex items-center w-full rounded-lg border transition-all duration-300 ease-in-out
        ${isFocused ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200'}
        bg-white shadow-sm hover:shadow-md ${className}`}
    >
      <Search
        className={`w-5 h-5 absolute top-1/2 transform -translate-y-1/2 text-gray-400
          ${isRtl ? 'right-3' : 'left-3'}`}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`w-full bg-transparent text-gray-900 text-sm py-2.5
          ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}
          rounded-lg focus:outline-none placeholder-gray-400 transition-colors duration-200`}
        aria-label={isRtl ? 'بحث الطلبات' : 'Search orders'}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={handleClear}
            className={`absolute top-1/2 transform -translate-y-1/2
              ${isRtl ? 'left-3' : 'right-3'}
              text-gray-400 hover:text-gray-600 focus:outline-none`}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchInput;