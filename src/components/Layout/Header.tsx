import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Globe, Menu } from 'lucide-react';
import Notifications from '../Notifications';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <header
      className="sticky top-0 z-50 w-full flex items-center justify-between h-16 px-2 sm:px-4 lg:px-4 border-b border-amber-200 bg-amber-100 shadow-md"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-2 sm:gap-4 flex-1">
        <img
          src="/logo.png"
          alt={t('app.logo_alt')}
          className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl border border-amber-300 shadow-sm"
        />
        <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate flex-1">
          {t('app.title')}
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Notifications />
        <button
          onClick={toggleLanguage}
          aria-label={t('header.toggle_language')}
          className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-700 text-xs sm:text-sm font-semibold transition shadow-sm"
        >
          <Globe size={16} />
          <span>{language === 'ar' ? 'En' : 'ع'}</span>
        </button>
        <button
          onClick={onMenuToggle}
          aria-label={t('header.toggle_menu')}
          className="text-amber-700 hover:text-amber-900 transition-colors p-2 rounded-full hover:bg-amber-200"
        >
          <Menu size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>
    </header>
  );
}