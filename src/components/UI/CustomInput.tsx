// src/components/CustomInput.tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion } from 'framer-motion';
import { Search, X, Eye, EyeOff } from 'lucide-react';

interface CustomInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  type?: string;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  togglePasswordVisibility?: () => void;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  showPasswordToggle = false,
  showPassword = false,
  togglePasswordVisibility,
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      {!showPasswordToggle && (
        <motion.div
          initial={{ opacity: value ? 0 : 1 }}
          animate={{ opacity: value ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          className={`absolute flex justify-center items-center align-center ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-600`}
        >
          <Search className="w-4 h-4" />
        </motion.div>
      )}
      <input
        type={showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {showPasswordToggle ? (
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className={`absolute  flex justify-center items-center align-center ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors`}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: value ? 1 : 0 }}
          animate={{ opacity: value ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'}  flex justify-center items-center align-center top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors`}
        >
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
};