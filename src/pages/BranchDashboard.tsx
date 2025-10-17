import React, { useState, useMemo } from 'react';
import { StatsCard } from '../components/Dashboard/StatsCard';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { ShoppingCart, TrendingUp, Package, RotateCcw, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stats {
  totalOrders: number;
  activeProducts: number;
  totalSales: number;
  returns: number;
  pendingOrders: number;
  completedTasks: number;
  inProgressTasks: number;
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
export const BranchDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  language: string;
}> = ({ stats, tasks, isRtl, t, language }) => {
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '' });
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => filter.status === 'all' || task.status === filter.status)
      .filter(task => task.productName.toLowerCase().includes(filter.search.toLowerCase()))
      .slice(0, 5);
  }, [tasks, filter]);

  const topProducts = useMemo(() => {
    const groups: { [key: string]: number } = {};
    tasks.forEach(t => {
      if (!groups[t.productName]) groups[t.productName] = 0;
      groups[t.productName] += t.quantity;
    });
    const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxQty = entries.length > 0 ? entries[0][1] : 1;
    return { entries, maxQty };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t('orders.total')} value={stats.totalOrders.toString()} icon={ShoppingCart} color="blue" aria-label={t('orders.total')} />
        <StatsCard title={t('sales.daily')} value={`${stats.dailySales.toLocaleString(language, { style: 'currency', currency: 'SAR' })}`} icon={TrendingUp} color="green" aria-label={t('sales.daily')} />
        <StatsCard title={t('inventory.remaining')} value={stats.activeProducts.toString()} icon={Package} color="yellow" aria-label={t('inventory.remaining')} />
        <StatsCard title={t('returns')} value={stats.returns.toString()} icon={RotateCcw} color="red" aria-label={t('returns')} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow overflow-y-auto max-h-96">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">{t('orders.new')}</h3>
            <div className="flex items-center space-x-2">
              <select
                value={filter.status}
                onChange={e => setFilter({ ...filter, status: e.target.value })}
                className="border rounded-md p-1 text-sm"
              >
                <option value="all">{t('common.all')}</option>
                <option value="pending">{t('orders.item_pending')}</option>
                <option value="in_progress">{t('orders.item_in_progress')}</option>
                <option value="completed">{t('orders.item_completed')}</option>
              </select>
              <Input
                value={filter.search}
                onChange={e => setFilter({ ...filter, search: e.target.value })}
                placeholder={t('common.search')}
                className="w-40"
              />
            </div>
          </div>
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('orders.no_tasks')}</p>
            ) : (
              <AnimatePresence>
                {filteredTasks.map(task => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-800">{t('orders.order_number', { number: task.orderNumber })}</h4>
                      <span className={`bg-${task.status === 'completed' ? 'green' : 'amber'}-200 text-${task.status === 'completed' ? 'green' : 'amber'}-800 px-2 py-1 rounded text-sm`}>
                        {t(`orders.item_${task.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{`${task.quantity} ${t(`units.${task.unit || 'unit'}`)} ${task.productName}`}</p>
                    <p className="text-xs text-gray-500">{t('common.created_at')}: {task.createdAt}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </Card>
        <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart3 className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-blue-600`} />
            {t('reports.top_products')}
          </h3>
          {topProducts.entries.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('reports.no_data')}</p>
          ) : (
            <>
              <div className="flex items-end h-32 space-x-2 mb-4">
                {topProducts.entries.map(([name, qty]) => (
                  <div key={name} className="flex-1 flex flex-col items-center">
                    <motion.div
                      className="bg-blue-500 w-full rounded-t"
                      initial={{ height: 0 }}
                      animate={{ height: `${(qty / topProducts.maxQty) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                    <span className="text-xs text-gray-600 mt-1 text-center">{name}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {topProducts.entries.map(([name, qty]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span>{qty} {t('units.unit')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
export default BranchDashboard;