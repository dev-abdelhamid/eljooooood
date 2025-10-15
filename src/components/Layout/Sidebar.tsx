import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Box, ShoppingBag, RefreshCcw, BarChart2, Store, ChefHat,
  Settings2, Warehouse, TrendingUp, Users2, ListTodo, UserCircle2,
  LogOut, XCircle, ChevronLeft, ChevronRight, Bell, Mail, Phone
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
  const { unreadByPath, totalUnread } = useNotifications();
  const isRtl = language === 'ar';

  // عرض الاسم الصحيح حسب اللغة
  const displayName = user 
    ? (isRtl ? user.name : (user.nameEn || user.name)) 
    : (t('header.guest') || 'Guest');

  const navItems = React.useMemo(() => {
    if (!user) return [];
    const baseItems = [
      { path: '/dashboard', icon: Home, label: t('dashboard'), notifications: unreadByPath['/dashboard'] || 0 },
    ];
    
    // إضافة إشعار عام في الأعلى
    const notificationItem = totalUnread > 0 ? [{
      path: '/notifications', 
      icon: Bell, 
      label: t('notifications') || 'Notifications',
      notifications: totalUnread
    }] : [];

    const adminItems = [
      ...notificationItem,
      { path: '/products', icon: Box, label: t('products.manage'), notifications: unreadByPath['/products'] || 0 },
      { path: '/branches', icon: Store, label: t('branches.manage'), notifications: unreadByPath['/branches'] || 0 },
      { path: '/chefs', icon: ChefHat, label: t('chefs.manage'), notifications: unreadByPath['/chefs'] || 0 },
      { path: '/departments', icon: Users2, label: t('departments'), notifications: unreadByPath['/departments'] || 0 },
      { path: '/orders', icon: ShoppingBag, label: t('orders'), notifications: unreadByPath['/orders'] || 0 },
      { path: '/returns', icon: RefreshCcw, label: t('returns'), notifications: unreadByPath['/returns'] || 0 },
      { path: '/sales', icon: TrendingUp, label: t('sales'), notifications: unreadByPath['/sales'] || 0 },
      { path: '/reports', icon: BarChart2, label: t('reports'), notifications: unreadByPath['/reports'] || 0 },
      { path: '/profile', icon: Settings2, label: t('settings'), notifications: 0 },
    ];

    const branchItems = [
      ...notificationItem,
      { path: '/orders/new', icon: ShoppingBag, label: t('orders.create'), notifications: unreadByPath['/orders/new'] || 0 },
      { path: '/branch-orders', icon: ShoppingBag, label: t('orders.review'), notifications: unreadByPath['/branch-orders'] || 0 },
      { path: '/branch-sales/new', icon: ListTodo, label: t('sales.create'), notifications: unreadByPath['/branch-sales/new'] || 0 },
      { path: '/branch-sales', icon: TrendingUp, label: t('sales.review'), notifications: unreadByPath['/branch-sales'] || 0 },
      { path: '/branch-returns', icon: RefreshCcw, label: t('returns.review'), notifications: unreadByPath['/branch-returns'] || 0 },
      { path: '/branch-inventory', icon: Warehouse, label: t('inventory'), notifications: unreadByPath['/branch-inventory'] || 0 },
      { path: '/profile', icon: Settings2, label: t('settings'), notifications: 0 },
    ];

    const chefItems = [
      ...notificationItem,
      { path: '/production-tasks', icon: ListTodo, label: t('productionTasks'), notifications: unreadByPath['/production-tasks'] || 0 },
      { path: '/profile', icon: Settings2, label: t('settings'), notifications: 0 },
    ];

    const productionItems = [
      ...notificationItem,
      { path: '/products', icon: Box, label: t('products.manage'), notifications: unreadByPath['/products'] || 0 },
      { path: '/departments', icon: Users2, label: t('departments'), notifications: unreadByPath['/departments'] || 0 },
      { path: '/orders', icon: ShoppingBag, label: t('orders'), notifications: unreadByPath['/orders'] || 0 },
      { path: '/returns', icon: RefreshCcw, label: t('returns'), notifications: unreadByPath['/returns'] || 0 },
      { path: '/reports', icon: BarChart2, label: t('reports'), notifications: unreadByPath['/reports'] || 0 },
      { path: '/profile', icon: Settings2, label: t('settings'), notifications: 0 },
    ];

    let roleItems = [];
    switch (user.role) {
      case 'admin': roleItems = adminItems; break;
      case 'branch': roleItems = branchItems; break;
      case 'chef': roleItems = chefItems; break;
      case 'production': roleItems = productionItems; break;
    }
    return [...baseItems, ...roleItems];
  }, [user, t, unreadByPath, totalUnread]);

  const sidebarVariants = {
    open: { x: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
    closed: { x: isRtl ? '100%' : '-100%', opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } },
  };

  const expandVariants = {
    expanded: { width: '260px', transition: { duration: 0.3, ease: 'easeInOut' } },
    collapsed: { width: '72px', transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  return (
    <AnimatePresence>
      {(isOpen || isLargeScreen) && (
        <>
          {/* Overlay بـ Z-index عالي جداً */}
          {!isLargeScreen && isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm"
              onClick={onClose}
              style={{ pointerEvents: 'auto' }}
              aria-hidden="true"
            />
          )}
          
          {/* Sidebar بـ Z-index أعلى */}
          <motion.aside
            variants={isLargeScreen ? expandVariants : sidebarVariants}
            initial={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'closed'}
            animate={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'open'}
            exit={isLargeScreen ? undefined : 'closed'}
            className={`fixed top-16 bottom-0 z-[10000] flex flex-col bg-gradient-to-b from-amber-50 via-amber-50 to-amber-100 shadow-2xl overflow-hidden border-r border-amber-200/50 ${
              isRtl ? 'right-0 rounded-l-xl' : 'left-0 rounded-r-xl'
            }`}
            style={{
              width: isLargeScreen ? (isExpanded ? '260px' : '72px') : isSmallScreen ? 'min(280px, 85vw)' : 'min(300px, 80vw)',
              boxShadow: isRtl 
                ? '-10px 0 40px -5px rgba(0, 0, 0, 0.15)' 
                : '10px 0 40px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            {/* Header مع زر الإغلاق المحسن */}
            {!isLargeScreen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 border-b border-amber-200/50 bg-white/95 backdrop-blur-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold text-sm">
                      {displayName[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-amber-800 truncate max-w-[140px]">
                    {displayName}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-full bg-amber-100/80 hover:bg-amber-200/80 text-amber-700 hover:text-amber-800 transition-all duration-200 shadow-sm border border-amber-300/30"
                >
                  <XCircle size={18} />
                </motion.button>
              </motion.div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-300/50 scrollbar-track-transparent">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => !isLargeScreen && onClose()}
                  className={({ isActive }) =>
                    `group relative flex items-center p-2.5 rounded-xl transition-all duration-300 cursor-pointer overflow-hidden ${
                      isActive 
                        ? 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 font-semibold shadow-sm border border-amber-300/30' 
                        : 'text-amber-700 hover:bg-amber-50/80 hover:text-amber-900 hover:shadow-sm'
                    }`
                  }
                >
                  <item.icon 
                    size={isLargeScreen && !isExpanded ? 20 : 18}
                    className={`min-w-[20px] transition-colors ${isExpanded || !isLargeScreen ? 'mr-3' : ''}`}
                  />
                  
                  <motion.span 
                    className={`${
                      isLargeScreen && !isExpanded ? 'hidden' : 'block flex-1 font-medium text-sm truncate'
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isLargeScreen && !isExpanded ? { opacity: 0 } : { opacity: 1, x: 0 }}
                  >
                    {item.label}
                  </motion.span>

                  {/* إشعارات محسنة */}
                  {item.notifications > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`ml-2 flex items-center justify-center min-w-[20px] h-5 rounded-full shadow-lg ${
                        isLargeScreen && !isExpanded 
                          ? 'w-2 h-2 bg-red-500' 
                          : 'bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold'
                      }`}
                    >
                      {isLargeScreen && !isExpanded ? '' : item.notifications > 99 ? '99+' : item.notifications}
                    </motion.div>
                  )}

                 
                </NavLink>
              ))}
            </nav>

            {/* User Info Section محسن */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 border-t border-amber-200/50 bg-white/90 backdrop-blur-sm space-y-2"
            >
              {/* معلومات المستخدم */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle2 size={16} className="text-amber-600" />
                    <span className={`${
                      isLargeScreen && !isExpanded ? 'hidden' : 'block text-sm font-semibold text-amber-900 truncate max-w-[140px]'
                    }`}>
                      {displayName}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                
                {/* الإيميل والهاتف في حالة التوسع */}
                {isLargeScreen && isExpanded && user && (
                  <div className="space-y-1 pt-1 border-t border-amber-100/50">
                    {user.email && (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <Mail size={12} className="text-amber-500" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <Phone size={12} className="text-amber-500" />
                        <span className="truncate">{user.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 hover:from-red-100 hover:to-red-200 transition-all duration-200 border border-red-200/30 shadow-sm"
              >
                <LogOut size={16} className="text-red-500" />
                <span className={`${
                  isLargeScreen && !isExpanded ? 'hidden' : 'block text-sm font-medium'
                }`}>
                  {t('header.logout')}
                </span>
              </motion.button>
            </motion.div>

            {/* زر التوسيع/التصغير المحسن */}
            {isLargeScreen && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleExpand}
                className={`absolute top-1/2 -translate-y-1/2 p-2.5 bg-white/90 hover:bg-white text-amber-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-amber-200/30 backdrop-blur-sm ${
                  isRtl ? 'left-0 -ml-2' : 'right-0 -mr-2'
                }`}
                style={{ zIndex: 10001 }}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isExpanded ? (
                    <ChevronRight size={16} className={isRtl ? 'rotate-180' : ''} />
                  ) : (
                    <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                  )}
                </motion.div>
              </motion.button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}