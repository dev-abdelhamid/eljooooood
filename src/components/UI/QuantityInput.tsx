import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Plus, Minus } from 'lucide-react';
import { toast } from 'react-toastify';

const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
}: {
  value: number;
  onChange: (val: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [error, setError] = useState('');

  const validateQuantity = (val: string) => {
    const num = parseFloat(val);
    if (val === '' || isNaN(num)) {
      const message = isRtl ? 'الكمية مطلوبة' : 'Quantity is required';
      setError(message);
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left' });
      return false;
    }
    if (num <= 0) {
      const message = isRtl ? 'الكمية يجب أن تكون أكبر من 0' : 'Quantity must be greater than 0';
      setError(message);
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left' });
      return false;
    }
    if (num % 0.5 !== 0) {
      const message = isRtl ? 'الكمية يجب أن تكون مضاعفات 0.5' : 'Quantity must be in increments of 0.5';
      setError(message);
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left' });
      return false;
    }
    setError('');
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setError('');
      return; // Allow empty input temporarily
    }
    if (validateQuantity(val)) {
      onChange(parseFloat(val));
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrement}
          className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
          aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
          disabled={value <= 0.5}
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className={`w-12 h-8 text-center border ${error ? 'border-red-500' : 'border-gray-200'} rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm min-w-[2.75rem] transition-all duration-200`}
          style={{ appearance: 'none' }}
          aria-label={isRtl ? 'الكمية' : 'Quantity'}
        />
        <button
          onClick={onIncrement}
          className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
          aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default QuantityInput;