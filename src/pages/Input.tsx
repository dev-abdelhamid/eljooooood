// First, the custom Input component
import React from 'react';

interface InputProps {
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  [key: string]: any;
}

const Input: React.FC<InputProps> = ({
  type = 'text',
  value,
  onChange,
  className = '',
  placeholder = '',
  min,
  max,
  ...props
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition duration-150 ease-in-out ${className}`}
      placeholder={placeholder}
      min={min}
      max={max}
      {...props}
    />
  );
};

export default Input;