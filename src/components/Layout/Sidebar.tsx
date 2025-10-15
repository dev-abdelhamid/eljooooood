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
  User as UserIcon,
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

  // عرض الاسم الصحيح حسب اللغة (نفس منطق Users component)
  const displayName = user 
    ? (isRtl ? user.name : (user.nameEn || user.name)) 
    : (t('header.guest') || 'Guest');

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
              className="fixed inset-0 bg-black/50 z-[999] backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
            />
          )}
          <motion.aside
            variants={isLargeScreen ? expandVariants : sidebarVariants}
            initial={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'closed'}
            animate={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'open'}
            exit={isLargeScreen ? undefined : 'closed'}
            className={`fixed top-16 bottom-0 z-[1000] flex flex-col bg-gradient-to-b from-amber-50 to-amber-100 shadow-xl overflow-y-auto overflow-x-hidden ${
              isRtl ? 'right-0 border-r border-amber-200' : 'left-0 border-l border-amber-200'
            }`}
            style={{
              width: isLargeScreen ? (isExpanded ? '240px' : '64px') : isSmallScreen ? 'min(160px, 65vw)' : 'min(200px, 70vw)',
            }}
          >
            {/* زر الإغلاق الهادئ والإبداعي */}
            {!isLargeScreen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end p-2 border-b border-amber-200 bg-amber-50/90 backdrop-blur-sm"
              >
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: '#fde68a' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  aria-label={t('sidebar.close')}
                  className="relative p-2 rounded-full bg-amber-200 text-amber-700 transition-all duration-300 shadow-sm hover:shadow-md border border-amber-300/50"
                >
                  <motion.div
                    animate={{ rotate: isOpen ? 0 : 90 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <XCircle size={18} />
                  </motion.div>
                  {/* تأثير الضوء الهادئ */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-amber-300/20"
                    animate={{ scale: 1.2, opacity: [0, 0.3, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </motion.button>
              </motion.div>
            )}

            {/* Navigation - محسن بهدوء */}
            <nav className="flex flex-col flex-grow p-1 sm:p-2 space-y-1 scrollbar-thin scrollbar-w-1 scrollbar-thumb-amber-400/80 scrollbar-track-amber-100/50 hover:scrollbar-thumb-amber-400">
              {navItems.map((item) => {
                const count = unreadByPath[item.path] || 0;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => !isLargeScreen && onClose()}
                    className={({ isActive }) =>
                      `group relative flex items-center text-amber-800 rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-amber-200/60 hover:shadow-sm transition-all duration-300 ${
                        isActive ? 'bg-amber-200/80 font-semibold text-amber-900 shadow-md border border-amber-300/30' : ''
                      }`
                    }
                    title={item.label}
                  >
                    <item.icon
                      size={isLargeScreen && !isExpanded ? 18 : isSmallScreen ? 16 : 20}
                      className="text-amber-600 min-w-[20px] group-hover:text-amber-700 transition-colors"
                    />
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      whileHover={{ x: 2 }}
                      className={`${
                        isLargeScreen && !isExpanded ? 'hidden' : 'block m-1 font-medium text-xs sm:text-sm'
                      } truncate text-amber-900 transition-transform`}
                    >
                      {item.label}
                    </motion.span>
                    {count > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`ml-auto text-xs font-bold px-1 py-0.5 rounded-full shadow-sm ${
                          isLargeScreen && !isExpanded
                            ? 'w-2 h-2 bg-red-500'
                            : 'bg-gradient-to-r from-red-500 to-pink-500 text-white min-w-[16px] sm:min-w-[18px] text-center'
                        }`}
                      >
                        {isLargeScreen && !isExpanded ? '' : count > 9 ? '9+' : count}
                      </motion.span>
                    )}
                    {/* خط سفلي هادئ عند الـ hover */}
                    <motion.div 
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 opacity-0"
                      whileHover={{ opacity: 1, height: '1px' }}
                      transition={{ duration: 0.2 }}
                    />
                  </NavLink>
                );
              })}
            </nav>

            {/* User Info - محسن مع الاسم الصحيح */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-1 sm:p-2 border-t border-amber-200 bg-amber-100/80 flex flex-col gap-1"
            >
              {/* User Profile مع الاسم الصحيح */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-2 text-amber-900 text-xs sm:text-sm font-medium p-1 sm:p-2 rounded-lg hover:bg-amber-200/60 transition-all duration-200 cursor-default"
              >
                <UserCircle2 
                  size={isSmallScreen ? 16 : 18} 
                  className="text-amber-600 min-w-[18px] transition-colors hover:text-amber-700" 
                />
                <motion.span 
                  className={`${isLargeScreen && !isExpanded ? 'hidden' : 'block truncate font-semibold'}`}
                  title={displayName}
                  whileHover={{ x: 2 }}
                >
                  {displayName}
                </motion.span>
              </motion.div>

              {/* Logout Button الهادئ */}
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: '#fee2e2' }}
                whileTap={{ scale: 0.98 }}
                onClick={logout}
                className="group flex items-center gap-2 text-amber-900 text-xs sm:text-sm font-medium p-1 sm:p-2 rounded-lg hover:bg-red-50/80 transition-all duration-200 relative overflow-hidden"
                aria-label={t('header.logout')}
              >
                <LogOut 
                  size={isSmallScreen ? 16 : 18} 
                  className="text-red-500 min-w-[18px] group-hover:scale-110 transition-transform" 
                />
                <motion.span 
                  className={`${isLargeScreen && !isExpanded ? 'hidden' : 'block truncate'}`}
                  whileHover={{ x: 2 }}
                >
                  {t('header.logout')}
                </motion.span>
                {/* تأثير موجة هادئة */}
                <motion.div
                  className="absolute inset-0 bg-red-100/50"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ originX: isRtl ? 1 : 0 }}
                />
              </motion.button>
            </motion.div>

            {/* زر التوسيع/التصغير الهادئ والإبداعي */}
            {isLargeScreen && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleExpand}
                aria-label={isExpanded ? t('sidebar.collapse') : t('sidebar.expand')}
                className={`absolute top-1/2 transform -translate-y-1/2 p-2 bg-amber-100/90 hover:bg-amber-200/90 text-amber-700 rounded-full shadow-sm hover:shadow-md transition-all duration-300 border border-amber-300/30 backdrop-blur-sm ${
                  isRtl ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
                }`}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {isExpanded ? (
                    <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                  ) : (
                    <ChevronLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                  )}
                </motion.div>
                {/* حلقة ضوء هادئة */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-amber-400/20"
                  animate={{ scale: [1, 1.2, 1], opacity: [0, 0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}