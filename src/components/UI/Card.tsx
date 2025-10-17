import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  gradient?: boolean;
}

export function Card({ children, className = '', onClick, gradient = false }: CardProps) {
  return (
    <div
      className={`${
        gradient 
          ? 'bg-gradient-to-br from-white to-amber-50' 
          : 'bg-white'
      } rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-amber-100 ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}