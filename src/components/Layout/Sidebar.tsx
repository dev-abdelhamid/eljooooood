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
  Crown,
  MapPin,
  Package,
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

  // جلب اسم المستخدم باللغة الصحيحة
  const displayUserInfo = React.useMemo(() => {
    if (!user) return null;
    
    // تمرير السياق للـ virtual
    const userWithContext = {
      ...user,
      name: user.name,
      nameEn: user.nameEn,
      role: user.role,
      getOptions: () => ({ isRtl })
    };
    
    return {
      displayName: userWithContext.displayName || user.name,
      displayRole: userWithContext.displayRole || user.role,
      avatarInitial: (user.name || 'U')[0].toUpperCase(),
      roleColor: {
        admin: 'from-purple-500 to-pink-500',
        branch: 'from-green-500 to-emerald-500',
        chef: 'from-orange-500 to-red-500',
        production: 'from-blue-500 to-indigo-500'
      }[user.role] || 'from-gray-500 to-gray-600'
    };
  }, [user, isRtl]);

  const navItems = React.useMemo(() => {
    if (!user) return [];

    const baseItems = [
      { path: '/dashboard', icon: Home, label: t('dashboard') || 'Dashboard' },
    ];

    const roleConfig = {
      admin: [
        { path: '/products', icon: Package, label: t('products.manage') || 'Products' },
        { path: '/branches', icon: Store, label: t('branches.manage') || 'Branches' },
        { path: '/chefs', icon: ChefHat, label: t('chefs.manage') || 'Chefs' },
        { path: '/departments', icon: Users2, label: t('departments') || 'Departments' },
        { path: '/orders', icon: ShoppingBag, label: t('orders') || 'Orders' },
        { path: '/returns', icon: RefreshCcw, label: t('returns') || 'Returns' },
        { path: '/sales', icon: TrendingUp, label: t('sales') || 'Sales' },
        { path: '/reports', icon: BarChart2, label: t('reports') || 'Reports' },
      ],
      branch: [
        { path: '/orders/new', icon: ShoppingBag, label: t('orders.create') || 'New Order' },
        { path: '/branch-orders', icon: ShoppingBag, label: t('orders.review') || 'Orders' },
        { path: '/branch-sales/new', icon: ListTodo, label: t('sales.create') || 'New Sale' },
        { path: '/branch-sales', icon: TrendingUp, label: t('sales.review') || 'Sales' },
        { path: '/branch-returns', icon: RefreshCcw, label: t('returns.review') || 'Returns' },
        { path: '/branch-inventory', icon: Warehouse, label: t('inventory') || 'Inventory' },
      ],
      chef: [
        { path: '/production-tasks', icon: ListTodo, label: t('productionTasks') || 'Tasks' },
      ],
      production: [
        { path: '/products', icon: Package, label: t('products.manage') || 'Products' },
        { path: '/departments', icon: Users2, label: t('departments') || 'Departments' },
        { path: '/orders', icon: ShoppingBag, label: t('orders') || 'Orders' },
        { path: '/returns', icon: RefreshCcw, label: t('returns') || 'Returns' },
        { path: '/reports', icon: BarChart2, label: t('reports') || 'Reports' },
      ]
    };

    return [...baseItems, ...(roleConfig[user.role as keyof typeof roleConfig] || []), 
            { path: '/profile', icon: Settings2, label: t('settings') || 'Settings' }];
  }, [user, t]);

  const sidebarVariants = {
    open: { 
      x: 0, 
      opacity: 1, 
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } 
    },
    closed: { 
      x: isRtl ? '100%' : '-100%', 
      opacity: 0, 
      transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } 
    },
  };

  const expandVariants = {
    expanded: { width: '280px', transition: { duration: 0.3, ease: 'easeInOut' } },
    collapsed: { width: '72px', transition: { duration: 0.3, ease: 'easeInOut' } },
  };

  if (!displayUserInfo) return null;

  return (
    <AnimatePresence mode="wait">
      {(isOpen || isLargeScreen) && (
        <>
          {/* الخلفية المظللة */}
          {!isLargeScreen && isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-40"
              onClick={onClose}
              style={{ 
                background: isRtl 
                  ? 'linear-gradient(to left, rgba(0,0,0,0.6), rgba(0,0,0,0.3))' 
                  : 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.3))'
              }}
            />
          )}

          {/* الـ Sidebar الرئيسي */}
          <motion.aside
            variants={isLargeScreen ? expandVariants : sidebarVariants}
            initial={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'closed'}
            animate={isLargeScreen ? (isExpanded ? 'expanded' : 'collapsed') : 'open'}
            exit="closed"
            className={`
              fixed top-16 bottom-0 z-50 flex flex-col
              bg-gradient-to-br from-white/95 via-amber-50/90 to-amber-100/80
              dark:from-gray-900/95 dark:via-gray-800/90 dark:to-gray-700/80
              backdrop-blur-xl shadow-2xl border border-amber-200/50 dark:border-gray-700/50
              overflow-y-auto overflow-x-hidden
              ${isRtl ? 'right-0 rounded-l-2xl' : 'left-0 rounded-r-2xl'}
            `}
            style={{
              width: isLargeScreen 
                ? (isExpanded ? '280px' : '72px') 
                : isSmallScreen ? 'min(200px, 75vw)' : 'min(240px, 80vw)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* زر الإغلاق المحسن */}
            {!isLargeScreen && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex justify-end p-3 border-b border-amber-200/50 bg-gradient-to-r from-transparent via-white/80 to-amber-50/80 dark:bg-gray-800/50"
              >
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/10 
                             border border-red-200/50 dark:border-red-800/50
                             text-red-600 hover:text-red-500 hover:bg-red-500/20
                             backdrop-blur-sm shadow-lg transition-all duration-200"
                  aria-label={t('sidebar.close') || 'Close sidebar'}
                >
                  <XCircle size={20} />
                </motion.button>
              </motion.div>
            )}

            {/* Navigation */}
            <nav className="flex flex-col flex-grow p-2 space-y-2 scrollbar-thin 
                            scrollbar-thumb-amber-400/60 scrollbar-track-amber-100/30
                            hover:scrollbar-thumb-amber-500/80">
              {navItems.map((item, index) => {
                const count = unreadByPath[item.path] || 0;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => !isLargeScreen && onClose()}
                    className={({ isActive }) =>
                      `group flex items-center rounded-xl p-3 cursor-pointer
                       bg-gradient-to-r from-transparent to-amber-50/50 dark:to-gray-700/50
                       hover:from-amber-100/70 hover:to-amber-200/70 dark:hover:from-gray-700/50
                       hover:shadow-md hover:border-amber-300/50 dark:hover:border-gray-600/50
                       transition-all duration-300 relative overflow-hidden
                       ${isActive 
                         ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 shadow-lg border border-amber-300/70 dark:from-amber-500/30 dark:border-amber-400/50 font-semibold' 
                         : 'border border-transparent'
                       }`
                    }
                  >
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileHover={{ scale: 1.1 }}
                      className="min-w-[24px] mr-3"
                    >
                      <item.icon 
                        size={isExpanded || !isLargeScreen ? 20 : 18}
                        className={`text-amber-600 group-hover:text-amber-700 
                                   ${isActive ? 'text-amber-500' : ''}`}
                      />
                    </motion.div>
                    
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={isExpanded || !isLargeScreen ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                      className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate flex-1"
                    >
                      {item.label}
                    </motion.span>

                    {count > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-2 bg-gradient-to-r from-red-500 to-pink-600 text-white 
                                   rounded-full w-6 h-6 flex items-center justify-center
                                   shadow-lg border border-red-300/50 text-xs font-bold"
                      >
                        {count > 99 ? '99+' : count}
                      </motion.div>
                    )}

                    {/* خط تفاعلي */}
                    <motion.div 
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      initial={{ height: 0 }}
                      whileHover={{ height: '2px' }}
                    />
                  </NavLink>
                );
              })}
            </nav>

            {/* معلومات المستخدم المحسنة */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-t border-amber-200/50 bg-gradient-to-b from-amber-50/80 to-transparent 
                         dark:from-gray-800/50 backdrop-blur-sm"
            >
              <div className="space-y-3">
                {/* Avatar */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br 
                             from-white/80 via-amber-50/80 to-amber-100/60
                             dark:from-gray-800/80 dark:via-gray-700/80 dark:to-gray-600/60
                             border border-amber-200/50 shadow-sm"
                >
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${displayUserInfo.roleColor}
                                   flex items-center justify-center text-white font-bold text-sm
                                   shadow-lg border-2 border-white/20`}>
                    {displayUserInfo.avatarInitial}
                  </div>
                  
                  <div className={`${isExpanded || !isLargeScreen ? 'block' : 'hidden'} flex-1 min-w-0`}>
                    <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {displayUserInfo.displayName}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium capitalize truncate">
                      {displayUserInfo.displayRole}
                    </p>
                  </div>
                  
                  {user.role === 'admin' && (
                    <Crown className="w-4 h-4 text-yellow-500 ml-auto" />
                  )}
                </motion.div>

                {/* زر تسجيل الخروج */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: '#fee2e2' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={logout}
                  className="w-full flex items-center gap-3 p-3 rounded-xl
                             bg-gradient-to-r from-red-50/80 to-red-100/60 dark:from-red-900/20 dark:to-red-800/20
                             border border-red-200/50 dark:border-red-800/50
                             text-red-700 dark:text-red-300 hover:bg-red-100/90 dark:hover:bg-red-900/30
                             hover:shadow-md transition-all duration-200 text-sm font-medium"
                >
                  <LogOut size={18} className="text-red-500" />
                  <span className={`${isExpanded || !isLargeScreen ? 'block' : 'hidden'}`}>
                    {t('header.logout') || 'Logout'}
                  </span>
                </motion.button>
              </div>
            </motion.div>

            {/* زر التوسيع/التصغير */}
            {isLargeScreen && (
              <motion.button
                whileHover={{ scale: 1.1, rotate: isExpanded ? 180 : 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleExpand}
                className={`
                  absolute top-1/2 -translate-y-1/2 p-2
                  bg-gradient-to-br from-amber-500/90 to-amber-600/90
                  hover:from-amber-600/95 hover:to-amber-700/95
                  text-white rounded-full shadow-lg border border-amber-400/50
                  transition-all duration-300 z-10
                  ${isRtl ? 'left-0 -ml-2' : 'right-0 -mr-2'}
                `}
                aria-label={isExpanded ? (t('sidebar.collapse') || 'Collapse') : (t('sidebar.expand') || 'Expand')}
              >
                {isExpanded ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                )}
              </motion.button>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}