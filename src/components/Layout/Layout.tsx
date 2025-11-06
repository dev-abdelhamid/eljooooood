import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLanguage } from '../../contexts/LanguageContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isLoading, setIsLoading] = useState(true);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 360);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= 1024;
      const small = window.innerWidth < 360;
      setIsLargeScreen(large);
      setIsSmallScreen(small);
      setSidebarExpanded(large);
      setSidebarOpen(large);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onMenuToggle = () => {
    if (isLargeScreen) {
      setSidebarExpanded(!sidebarExpanded);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };


  const sidebarWidth = isLargeScreen
    ? sidebarExpanded
      ? 240
      : 64
    : isSmallScreen
    ? 'min(160px, 65vw)'
    : 'min(200px, 70vw)';

  const contentStyle = isLargeScreen
    ? isRtl
      ? { marginRight: sidebarWidth, transition: 'margin-right 300ms ease-in-out' }
      : { marginLeft: sidebarWidth, transition: 'margin-left 300ms ease-in-out' }
    : { margin: 0, width: '100%' };

  return (
    <div className="min-h-screen bg-amber-50">
      <Header onMenuToggle={onMenuToggle} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          isExpanded={sidebarExpanded}
          onToggleExpand={() => setSidebarExpanded(!sidebarExpanded)}
          onClose={() => setSidebarOpen(false)}
          isLargeScreen={isLargeScreen}
          isSmallScreen={isSmallScreen}
        />
        <main
          className="flex-1 overflow-y-auto p-2 sm:p-2 lg:p-4 transition-all duration-300"
          style={contentStyle}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;