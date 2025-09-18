import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { Card } from '../UI/Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  onClick?: () => void;
}

export function StatsCard({ title, value, icon: Icon, trend, color, onClick }: StatsCardProps) {
  const colors = {
    blue: {
      icon: 'bg-blue-500',
      gradient: 'from-blue-50 to-blue-100',
      text: 'text-blue-700'
    },
    green: {
      icon: 'bg-green-500',
      gradient: 'from-green-50 to-green-100',
      text: 'text-green-700'
    },
    yellow: {
      icon: 'bg-amber-500',
      gradient: 'from-amber-50 to-amber-100',
      text: 'text-amber-700'
    },
    red: {
      icon: 'bg-red-500',
      gradient: 'from-red-50 to-red-100',
      text: 'text-red-700'
    },
    purple: {
      icon: 'bg-purple-500',
      gradient: 'from-purple-50 to-purple-100',
      text: 'text-purple-700'
    }
  };

  const colorConfig = colors[color];

  return (
    <Card 
      className={`p-6 bg-gradient-to-br ${colorConfig.gradient} hover:shadow-lg transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${colorConfig.text} opacity-80`}>
            {title}
          </p>
          <p className={`text-3xl font-bold ${colorConfig.text} mt-2`}>
            {value}
          </p>
          {trend && (
            <p className={`text-sm mt-2 flex items-center ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span className="mr-1">
                {trend.isPositive ? '↗' : '↘'}
              </span>
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={`p-3 ${colorConfig.icon} rounded-full shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}