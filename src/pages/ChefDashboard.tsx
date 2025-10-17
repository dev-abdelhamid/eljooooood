import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle, Clock, AlertCircle, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  approvedOrders: number;
  inProductionOrders: number;
  completedOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalSales: number;
  completedTasks: number;
  inProgressTasks: number;
  activeProducts: number;
  returns: number;
  pendingReview: number;
  averageOrderValue: number;
  dailySales: number;
  topBranchPerformance: number;
}

interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  branchName: string;
  createdAt: string;
}

interface FilterState {
  status: string;
  search: string;
}

const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <div className={`p-2 bg-${color}-100 rounded-lg border border-${color}-200 cursor-pointer hover:bg-${color}-200 transition-colors`} aria-label={ariaLabel}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 text-${color}-700`} />
        <div>
          <p className="text-xs text-gray-700">{title}</p>
          <p className="text-sm font-medium text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
);

const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = ({ stats, tasks, isRtl, t, language, handleStartTask, handleCompleteTask }) => {
  const { t: translate, language: lang } = useLanguage();
  const isRtlLocal = lang === 'ar';
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '' });

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter.status === 'all' || task.status === filter.status)
      .filter((task) => task.productName.toLowerCase().includes(filter.search.toLowerCase()) || task.orderNumber.toLowerCase().includes(filter.search.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [tasks, filter]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <StatsCard
          title={isRtlLocal ? 'إجمالي الطلبات' : 'Total Orders'}
          value={stats.totalOrders.toString()}
          icon={ShoppingCart}
          color="blue"
          ariaLabel={isRtlLocal ? 'إجمالي الطلبات' : 'Total Orders'}
        />
        <StatsCard
          title={isRtlLocal ? 'المهام المكتملة' : 'Completed Tasks'}
          value={stats.completedTasks.toString()}
          icon={CheckCircle}
          color="green"
          ariaLabel={isRtlLocal ? 'المهام المكتملة' : 'Completed Tasks'}
        />
        <StatsCard
          title={isRtlLocal ? 'المهام قيد التنفيذ' : 'In Progress Tasks'}
          value={stats.inProgressTasks.toString()}
          icon={Clock}
          color="yellow"
          ariaLabel={isRtlLocal ? 'المهام قيد التنفيذ' : 'In Progress Tasks'}
        />
        <StatsCard
          title={isRtlLocal ? 'الطلبات المعلقة' : 'Pending Orders'}
          value={stats.pendingOrders.toString()}
          icon={AlertCircle}
          color="red"
          ariaLabel={isRtlLocal ? 'الطلبات المعلقة' : 'Pending Orders'}
        />
      </div>
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-2 gap-2">
          <h3 className="text-base font-semibold text-gray-800 flex items-center">
            <ChefHat className={`w-4 h-4 ${isRtlLocal ? 'ml-1.5' : 'mr-1.5'} text-amber-600`} />
            {isRtlLocal ? 'أحدث الطلبات قيد الإنتاج' : 'Latest In Production'}
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full sm:w-32 p-1.5 rounded-md border border-gray-300 text-xs focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="all">{isRtlLocal ? 'الكل' : 'All'}</option>
              <option value="pending">{isRtlLocal ? 'معلق' : 'Pending'}</option>
              <option value="assigned">{isRtlLocal ? 'معين' : 'Assigned'}</option>
              <option value="in_progress">{isRtlLocal ? 'قيد التنفيذ' : 'In Progress'}</option>
              <option value="completed">{isRtlLocal ? 'مكتمل' : 'Completed'}</option>
            </select>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={isRtlLocal ? 'البحث' : 'Search'}
              className="w-full sm:w-32 p-1.5 rounded-md border border-gray-300 text-xs focus:ring-2 focus:ring-blue-400 bg-white"
            />
          </div>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-80">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-xs">{isRtlLocal ? 'لا توجد مهام' : 'No tasks available'}</p>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="border border-amber-200 rounded-lg p-2 bg-amber-50 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-xs text-gray-800 truncate">
                      {isRtlLocal ? `طلب رقم ${task.orderNumber}` : `Order #${task.orderNumber}`}
                    </h4>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        task.status === 'pending' || task.status === 'assigned'
                          ? 'bg-amber-100 text-amber-800'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {isRtlLocal
                        ? task.status === 'pending'
                          ? 'معلق'
                          : task.status === 'assigned'
                          ? 'معين'
                          : task.status === 'in_progress'
                          ? 'قيد التنفيذ'
                          : 'مكتمل'
                        : translate(`orders.item_${task.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1 truncate">{`${task.quantity} ${task.productName}`}</p>
                  <p className="text-xs text-gray-500 mb-2">{isRtlLocal ? `تم التعيين في: ${task.createdAt}` : `Assigned at: ${task.createdAt}`}</p>
                  <div className="flex items-center gap-2">
                    {(task.status === 'pending' || task.status === 'assigned') && (
                      <button
                        onClick={() => handleStartTask(task.id, task.orderId)}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                        aria-label={isRtlLocal ? 'بدء التنفيذ' : 'Start Production'}
                      >
                        {isRtlLocal ? 'بدء' : 'Start'}
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.orderId)}
                        className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                        aria-label={isRtlLocal ? 'إكمال التنفيذ' : 'Complete Production'}
                      >
                        {isRtlLocal ? 'إكمال' : 'Complete'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ChefDashboard;