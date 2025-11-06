import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Globe, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // تأكد من تثبيت react-router-dom
import Notifications from '../Notifications';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const isRtl = language === 'ar';
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  return (
    <header
      className="sticky top-0 z-50 w-full flex items-center justify-between h-16 px-2 sm:px-4 lg:px-4 border-b border-amber-200 bg-amber-100 shadow-md"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center px-2 flex-1">
        <button
          onClick={handleLogoClick}
          className="transition-all duration-300 hover:scale-105 active:scale-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-50 rounded-lg p-1"
          aria-label={t('app.logo_alt')}
        >
          <img
            src="/logo (3).png"
            alt={t('app.logo_alt')}
            className="w-36 h-16 object-contain 
                       filter drop-shadow-[0_4px_8px_rgba(180,83,9,0.25)] 
                       hover:drop-shadow-[0_6px_12px_rgba(180,83,9,0.35)] 
                       transition-all duration-300"
          />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
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