
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
            className={`fixed top-16 bottom-0 z-50 flex flex-col bg-gradient-to-b from-amber-50 to-amber-100 shadow-lg overflow-y-auto overflow-x-hidden ${
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
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => !isLargeScreen && onClose()}
                    className={({ isActive }) =>
                      `flex items-center text-amber-800 rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-amber-200/50 hover:shadow-sm transition-all duration-200 ${
                        isActive ? 'bg-amber-200 font-semibold text-amber-900 shadow-sm' : ''
                      }`
                    }
                    title={item.label}
                  >
                    <item.icon
                      size={isLargeScreen && !isExpanded ? 18 : isSmallScreen ? 16 : 20}
                      className="text-amber-600 min-w-[20px]"
                    />
                    <span
                      className={`${
                        isLargeScreen && !isExpanded ? 'hidden' : 'block m-1 font-medium text-xs sm:text-sm'
                      } truncate text-amber-900`}
                    >
                      {item.label}
                    </span>
                    {count > 0 && (
                      <span
                        className={`ml-auto text-xs font-bold px-1 py-0.5 rounded-full shadow-sm ${
                          isLargeScreen && !isExpanded
                            ? 'w-2 h-2 bg-red-500'
                            : 'bg-red-500 text-white min-w-[16px] sm:min-w-[18px] text-center'
                        }`}
                      >
                        {isLargeScreen && !isExpanded ? '' : count > 9 ? '9+' : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-1 sm:p-2 border-t border-amber-200 bg-amber-100/80 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-amber-900 text-xs sm:text-sm font-medium p-1 sm:p-2 rounded-lg hover:bg-amber-200/50 transition-all">
                <UserCircle2 size={isSmallScreen ? 16 : 18} className="text-amber-600 min-w-[18px]" />
                <span className={`${isLargeScreen && !isExpanded ? 'hidden' : 'block truncate'}`}>
                  {user?.name || t('header.guest')}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-amber-900 text-xs sm:text-sm font-medium p-1 sm:p-2 rounded-lg hover:bg-amber-200/50 transition-all"
                aria-label={t('header.logout')}
              >
                <LogOut size={isSmallScreen ? 16 : 18} className="text-amber-600 min-w-[18px]" />
                <span className={`${isLargeScreen && !isExpanded ? 'hidden' : 'block truncate'}`}>
                  {t('header.logout')}
                </span>
              </button>
            </div>
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
