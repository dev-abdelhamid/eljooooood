import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Box, ShoppingBag, RefreshCcw, BarChart2, Store, ChefHat,
  Settings2, Warehouse, TrendingUp, Users2, ListTodo, UserCircle2,
  LogOut, XCircle, ChevronLeft, ChevronRight, Crown
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

  // نفس المنطق المستخدم في Users component
  const getDisplayName = (userData: any) => {
    return isRtl ? userData.name : (userData.nameEn || userData.name);
  };

  const getRoleDisplay = (role: string) => {
    const roleTranslations = isRtl ? {
      admin: 'مدير النظام',
      branch: 'فرع',
      chef: 'شيف',
      production: 'إنتاج'
    } : {
      admin: 'System Admin',
      branch: 'Branch',
      chef: 'Chef',
      production: 'Production'
    };
    return roleTranslations[role as keyof typeof roleTranslations] || role;
  };

  const userDisplayInfo = React.useMemo(() => {
    if (!user) return null;
    
    return {
      displayName: getDisplayName(user),
      displayRole: getRoleDisplay(user.role),
      avatarInitial: getDisplayName(user)[0]?.toUpperCase() || 'U',
      roleColor: {
        admin: 'from-purple-600 via-pink-600 to-purple-700',
        branch: 'from-emerald-500 via-green-500 to-emerald-600',
        chef: 'from-orange-500 via-red-500 to-orange-600',
        production: 'from-blue-500 via-indigo-500 to-blue-600'
      }[user.role] || 'from-gray-500 to-gray-600'
    };
  }, [user, isRtl]);

  const navItems = React.useMemo(() => {
    if (!user) return [];

    const baseItems = [
      { path: '/dashboard', icon: Home, label: t('dashboard') || 'Dashboard' },
    ];

    const roleItems = {
      admin: [
        { path: '/products', icon: Box, label: t('products.manage') || 'Products' },
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
        { path: '/products', icon: Box, label: t('products.manage') || 'Products' },
        { path: '/departments', icon: Users2, label: t('departments') || 'Departments' },
        { path: '/orders', icon: ShoppingBag, label: t('orders') || 'Orders' },
        { path: '/returns', icon: RefreshCcw, label: t('returns') || 'Returns' },
        { path: '/reports', icon: BarChart2, label: t('reports') || 'Reports' },
      ]
    };

    return [
      ...baseItems, 
      ...(roleItems[user.role as keyof typeof roleItems] || []),
      { path: '/profile', icon: Settings2, label: t('settings') || 'Settings' }
    ];
  }, [user, t]);

  const sidebarVariants = {
    open: { 
      x: 0, 
      opacity: 1, 
      transition: { duration: 0.4, ease: "easeOut" } 
    },
    closed: { 
      x: isRtl ? '100%' : '-100%', 
      opacity: 0, 
      transition: { duration: 0.3, ease: "easeIn" } 
    },
  };

  const expandVariants = {
    expanded: { width: '280px', transition: { duration: 0.3 } },
    collapsed: { width: '72px', transition: { duration: 0.3 } },
  };

  if (!userDisplayInfo) return null;

  return (
    <AnimatePresence mode="wait">
      {(isOpen || isLargeScreen) && (
        <>
          {/* Overlay محسن */}
          {!isLargeScreen && isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm ${
                isRtl ? 'rounded-r-3xl' : 'rounded-l-3xl'
              }`}
              onClick={onClose}
            />
          )}

          {/* الـ Sidebar */}
          <motion.aside
            variants={isLargeScreen ? expandVariants : sidebarVariants}
            initial={isLargeScreen ? (isExpanded ? "expanded" : "collapsed") : "closed"}
            animate={isLargeScreen ? (isExpanded ? "expanded" : "collapsed") : "open"}
            exit="closed"
            className={`
              fixed top-16 bottom-0 z-50 flex flex-col
              bg-gradient-to-b from-white via-amber-50/90 to-amber-100/80
              border-r-2 border-amber-200/60 dark:border-amber-800/50
              shadow-2xl rounded-r-2xl ${isRtl ? 'right-0 rounded-r-none rounded-l-2xl border-r-0 border-l-2' : 'left-0'}
              overflow-hidden
            `}
            style={{
              width: isLargeScreen 
                ? (isExpanded ? '280px' : '72px') 
                : isSmallScreen ? 'min(240px, 80vw)' : '280px',
              boxShadow: isRtl 
                ? '-20px 0 60px -10px rgba(0,0,0,0.1)' 
                : '20px 0 60px -10px rgba(0,0,0,0.1)'
            }}
          >
            {/* Header مع زر الإغلاق */}
            {!isLargeScreen && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-4 border-b border-amber-200/50 bg-white/80 backdrop-blur-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${userDisplayInfo.roleColor} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    {userDisplayInfo.avatarInitial}
                  </div>
                  <span className="text-sm font-semibold text-amber-800 truncate max-w-[120px]">
                    {userDisplayInfo.displayName}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 transition-all duration-200 shadow-sm"
                >
                  <XCircle size={18} />
                </motion.button>
              </motion.div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-400/60 scrollbar-track-amber-100/30">
              {navItems.map((item, index) => {
                const count = unreadByPath[item.path] || 0;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => !isLargeScreen && onClose()}
                    className={({ isActive }) =>
                      `group relative flex items-center p-3 rounded-xl transition-all duration-300 cursor-pointer
                      ${isActive 
                        ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-800 border border-amber-300/50 shadow-md font-semibold' 
                        : 'text-gray-700 hover:bg-amber-100/50 hover:text-amber-800 hover:shadow-sm border border-transparent'
                      }`
                    }
                  >
                    <item.icon 
                      size={isLargeScreen && !isExpanded ? 20 : 18}
                      className={`min-w-6 ${isExpanded || !isLargeScreen ? 'mr-3' : ''} transition-colors group-hover:text-amber-600`}
                    />
                    
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={isLargeScreen && !isExpanded ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                      className={`${
                        isLargeScreen && !isExpanded ? 'hidden' : 'block'
                      } text-sm font-medium truncate flex-1`}
                    >
                      {item.label}
                    </motion.span>

                    {count > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg"
                      >
                        {count > 99 ? '99+' : count}
                      </motion.span>
                    )}

                    {/* Active indicator */}
                    <motion.div 
                      className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 opacity-0"
                      animate={{ opacity: isLargeScreen && !isExpanded ? 0 : 1 }}
                    />
                  </NavLink>
                );
              })}
            </nav>

            {/* User Info Footer */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-t border-amber-200/50 bg-gradient-to-t from-amber-50/80 to-transparent"
            >
              <div className="space-y-3">
                {/* User Profile */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/70 backdrop-blur-sm border border-amber-200/30 shadow-sm"
                >
                  <div className={`w-10 h-10 rounded-full ${userDisplayInfo.roleColor} flex items-center justify-center text-white font-bold shadow-lg`}>
                    {userDisplayInfo.avatarInitial}
                  </div>
                  
                  <div className={`${isLargeScreen && !isExpanded ? 'hidden' : 'flex-1 min-w-0'} space-y-1`}>
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {userDisplayInfo.displayName}
                    </p>
                    <p className="text-xs text-amber-600 font-medium capitalize truncate">
                      {userDisplayInfo.displayRole}
                    </p>
                  </div>
                  
                  {user?.role === 'admin' && (
                    <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  )}
                </motion.div>

                {/* Logout Button */}
                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: '#fee2e2' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={logout}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50/80 border border-red-200/50 
                             text-red-700 hover:bg-red-100/80 hover:text-red-800 transition-all duration-200 shadow-sm
                             text-sm font-medium"
                >
                  <LogOut size={16} className="text-red-500" />
                  <span className={`${isLargeScreen && !isExpanded ? 'hidden' : 'block'}`}>
                    {t('header.logout') || 'Logout'}
                  </span>
                </motion.button>
              </div>
            </motion.div>

            {/* Expand/Collapse Button */}
            {isLargeScreen && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleExpand}
                className={`
                  absolute top-1/2 -translate-y-1/2 p-2 rounded-full
                  bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg
                  border border-amber-400/50 hover:shadow-xl transition-all duration-300
                  ${isRtl ? 'left-0 -ml-3' : 'right-0 -mr-3'}
                `}
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