import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Box,
  ShoppingBag,
  RefreshCcw,
  BarChart2,
  Store,
  ChefHat,
  Settings2,
  Warehouse,
  TrendingUp,
  Users2,
  ListTodo,
  UserCircle2,
  LogOut,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  isLargeScreen: boolean;
  isSmallScreen: boolean;
}

export function Sidebar({
  isOpen,
  isExpanded,
  onToggleExpand,
  onClose,
  isLargeScreen,
  isSmallScreen,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { unreadByPath } = useNotifications();
  const isRtl = language === 'ar';

  // ✅ عرض اسم المستخدم حسب اللغة
  const displayName = user 
    ? (isRtl ? user.name : (user.nameEn || user.name)) 
    : (t('header.guest') || 'Guest');

  // ✅ ترجمة الأدوار حسب اللغة
  const roleTranslations = {
    ar: {
      admin: 'مدير',
      branch: 'فرع',
      chef: 'شيف',
      production: 'إنتاج'
    },
    en: {
      admin: 'Admin',
      branch: 'Branch',
      chef: 'Chef',
      production: 'Production'
    }
  };
  
  const userRoleLabel = user?.role ? roleTranslations[language === 'ar' ? 'ar' : 'en'][user.role] : '';

  const navItems = React.useMemo(() => {
    if (!user) return [];

    const baseItems = [
      { path: '/dashboard', icon: Home, label: t('dashboard') },
    ];

    const adminItems = [
      { path: '/products', icon: Box, label: t('products.manage') },
      { path: '/branches', icon: Store, label: t('branches.manage') },
      { path: '/chefs', icon: ChefHat, label: t('chefs.manage') },
      { path: '/departments', icon: Users2, label: t('departments') },
      { path: '/orders', icon: ShoppingBag, label: t('orders') },
      { path: '/returns', icon: RefreshCcw, label: t('returns') },
      { path: '/sales', icon: TrendingUp, label: t('sales') },
      { path: '/reports', icon: BarChart2, label: t('reports') },
      { path: '/profile', icon: Settings2, label: t('settings') },
    ];

    const branchItems = [
      { path: '/orders/new', icon: ShoppingBag, label: t('orders.create') },
      { path: '/branch-orders', icon: ShoppingBag, label: t('orders.review') },
      { path: '/branch-sales/new', icon: ListTodo, label: t('sales.create') },
      { path: '/branch-sales', icon: TrendingUp, label: t('sales.review') },
      { path: '/branch-returns', icon: RefreshCcw, label: t('returns.review') },
      { path: '/branch-inventory', icon: Warehouse, label: t('inventory') },
      { path: '/profile', icon: Settings2, label: t('settings') },
    ];

    const chefItems = [
      { path: '/production-tasks', icon: ListTodo, label: t('productionTasks') },
      { path: '/profile', icon: Settings2, label: t('settings') },
    ];

    const productionItems = [
      { path: '/products', icon: Box, label: t('products.manage') },
      { path: '/departments', icon: Users2, label: t('departments') },
      { path: '/orders', icon: ShoppingBag, label: t('orders') },
      { path: '/returns', icon: RefreshCcw, label: t('returns') },
      { path: '/reports', icon: BarChart2, label: t('reports') },
      { path: '/profile', icon: Settings2, label: t('settings') },
    ];

    let roleItems = [];
    switch (user.role) {
      case 'admin':
        roleItems = adminItems;
        break;
      case 'branch':
        roleItems = branchItems;
        break;
      case 'chef':
        roleItems = chefItems;
        break;
      case 'production':
        roleItems = productionItems;
        break;
    }

    return [...baseItems, ...roleItems];
  }, [user, t]);

  const sidebarVariants = {
    open: { x: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
    closed: { x: isRtl ? '100%' : '-100%', opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
  };

  const expandVariants = {
    expanded: { width: '240px', transition: { duration: 0.3, ease: 'easeInOut' } },
    collapsed: { width: '64px', transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  // ✅ دالة لعرض الإشعار في حالة التصغير
  const renderNotificationBadge = (count: number, isCollapsed: boolean) => {
    if (count === 0) return null;
    
    if (isCollapsed) {
      return (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border border-white shadow-sm flex items-center justify-center z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.2 }}
        >
          <span className="text-[10px] text-white font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        </motion.div>
      );
    }

    return (
      <motion.span
        className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm min-w-[20px] text-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
      >
        {count > 99 ? '99+' : count}
      </motion.span>
    );
  };

  return (
    <AnimatePresence>
      {(isOpen || isLargeScreen) && (
        <>
          {!isLargeScreen && isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={onClose}
              aria-hidden="true"
            />
          )}
          <motion.aside
            variants={isLargeScreen ? expandVariants : sidebarVariants}
            initial={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'closed'}
            animate={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'open'}
            exit={isLargeScreen ? undefined : 'closed'}
            className={`fixed top-16 bottom-0 z-50 flex flex-col bg-amber-100/50 shadow-lg overflow-y-auto overflow-x-hidden ${
              isRtl ? 'right-0 border-r border-amber-200' : 'left-0 border-l border-amber-200'
            }`}
            style={{
              width: isLargeScreen ? (isExpanded ? '240px' : '64px') : isSmallScreen ? 'min(160px, 65vw)' : 'min(200px, 70vw)',
            }}
          >
            {!isLargeScreen && (
              <div className="flex justify-end p-1 border-b border-amber-200">
                <button
                  onClick={onClose}
                  aria-label={t('sidebar.close')}
                  className="p-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-700 transition shadow-sm"
                >
                  <XCircle size={16} />
                </button>
              </div>
            )}
            
            <nav className="flex flex-col flex-grow p-1 sm:p-2 space-y-1 scrollbar-thin scrollbar-w-1 scrollbar-thumb-amber-400/80 scrollbar-track-amber-100/50 hover:scrollbar-thumb-amber-400">
              {navItems.map((item) => {
                const count = unreadByPath[item.path] || 0;
                const isCollapsed = isLargeScreen && !isExpanded;
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => !isLargeScreen && onClose()}
                    className={({ isActive: active }) => // ✅ إصلاح isActive
                      `relative flex ${isCollapsed ? 'justify-center' : 'items-center'} text-amber-800 rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-amber-200/50 hover:shadow-sm transition-all duration-200 ${
                        active ? 'bg-amber-200 font-semibold text-amber-900 shadow-sm' : ''
                      } ${isCollapsed ? 'py-3' : ''}`
                    }
                    title={isCollapsed ? `${item.label} (${count > 0 ? count : 0} notifications)` : item.label}
                  >
                    {({ isActive: active }) => ( // ✅ استخدام render prop صحيح
                      <>
                        {/* ✅ Container للأيقونة والإشعار */}
                        <motion.div 
                          className={`relative flex ${isCollapsed ? 'justify-center items-center w-full' : ''}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: isCollapsed ? 1.1 : 1 }}
                        >
                          <item.icon
                            size={isCollapsed ? 20 : (isSmallScreen ? 16 : 20)}
                            className={`text-amber-600 ${isCollapsed ? 'mx-auto' : 'min-w-[20px]'} transition-colors ${
                              active ? 'text-amber-800' : ''
                            }`}
                          />
                          
                          {/* ✅ إشعار محسن */}
                        </motion.div>
                        
                        {/* النص - مخفي في التصغير */}
                        <motion.span
                          className={`${
                            isCollapsed ? 'hidden' : 'block m-1 font-medium text-xs sm:text-sm'
                          } truncate text-amber-900`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={isCollapsed ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {item.label}
                        </motion.span>
                        
                                                  {renderNotificationBadge(count, isCollapsed)}

                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            
            {/* ✅ الفوتر المحسن - معلومات المستخدم */}
            <motion.div 
              className="p-1 sm:p-2 border-t border-amber-200 bg-amber-50/80 flex flex-col gap-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* معلومات المستخدم - مُحسنة للتصغير */}
              <div className="flex flex-col gap-2 p-2 sm:p-3 rounded-lg bg-white/60 backdrop-blur-sm border border-amber-100/30">
                <div className={`flex ${isLargeScreen && !isExpanded ? 'justify-center' : 'items-center justify-between'}`}>
                  <div className={`flex items-center gap-2 ${isLargeScreen && !isExpanded ? 'justify-center w-full' : ''}`}>
                    <UserCircle2 
                      size={isLargeScreen && !isExpanded ? 20 : (isSmallScreen ? 16 : 18)} 
                      className="text-amber-600 flex-shrink-0 transition-all" 
                    />
                    <motion.span 
                      className={`${
                        isLargeScreen && !isExpanded ? 'hidden' : 'block truncate font-semibold text-amber-900 text-xs sm:text-sm'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={isLargeScreen && !isExpanded ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                    >
                      {displayName}
                    </motion.span>
                  </div>
                  
                  {/* Badge للدور - مخفي في التصغير */}
                  {userRoleLabel && isLargeScreen && isExpanded && (
                    <motion.span 
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        user?.role === 'admin' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : user?.role === 'branch' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : user?.role === 'chef'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      {userRoleLabel}
                    </motion.span>
                  )}
                </div>
              </div>

              {/* ✅ زر تسجيل الخروج - مُحسن للتصغير */}
              <motion.button
                onClick={logout}
                className={`flex ${isLargeScreen && !isExpanded ? 'justify-center' : 'items-center justify-center'} gap-2 p-2 sm:p-2.5 rounded-lg bg-gradient-to-r from-red-50/80 to-red-100/80 
                           text-red-700 hover:from-red-100/80 hover:to-red-200/80 hover:text-red-800 
                           transition-all duration-200 border border-red-200/30 shadow-sm 
                           hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                           font-medium text-xs sm:text-sm ${isLargeScreen && !isExpanded ? 'py-3' : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                aria-label={t('header.logout')}
              >
                <LogOut 
                  size={isLargeScreen && !isExpanded ? 20 : (isSmallScreen ? 16 : 18)} 
                  className="text-red-500 flex-shrink-0 transition-all" 
                />
                <motion.span 
                  className={`${
                    isLargeScreen && !isExpanded ? 'hidden' : 'block truncate'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isLargeScreen && !isExpanded ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                >
                  {t('header.logout')}
                </motion.span>
              </motion.button>
            </motion.div>

            {isLargeScreen && (
              <button
                onClick={onToggleExpand}
                aria-label={isExpanded ? t('sidebar.collapse') : t('sidebar.expand')}
                className={`absolute top-1/2 transform -translate-y-1/2 p-1 bg-amber-100/80 hover:bg-amber-200 text-amber-700 rounded-full shadow-sm transition-all duration-200 opacity-50 hover:opacity-100 ${
                  isRtl ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
                }`}
              >
                {isExpanded ? (
                  <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                ) : (
                  <ChevronLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                )}
              </button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}