import React, { useCallback, useMemo } from 'react';
import { Input } from '../../components/UI/Input';
import { Select } from '../../components/UI/Select';
import { Search } from 'lucide-react';

interface Props {
  t: (key: string, options?: any) => string;
  isRtl: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  ordersCount: number;
}

const Filters: React.FC<Props> = ({
  t,
  isRtl,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy,
  ordersCount,
}) => {
  const statusOptions = useMemo(
    () => [
      { value: '', label: t('orders.all_statuses') },
      { value: 'pending', label: t('orders.pending') },
      { value: 'approved', label: t('orders.approved') },
      { value: 'in_production', label: t('orders.in_production') },
      { value: 'completed', label: t('orders.completed') },
      { value: 'in_transit', label: t('orders.in_transit') },
      { value: 'delivered', label: t('orders.delivered') },
      { value: 'cancelled', label: t('orders.cancelled') },
    ],
    [t]
  );

  const sortOptions = useMemo(
    () => [
      { value: 'date', label: t('orders.sort_by_date') },
      { value: 'total', label: t('orders.sort_by_total') },
      { value: 'priority', label: t('orders.sort_by_priority') },
    ],
    [t]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  return (
    <div className={`mb-6 flex flex-col sm:flex-row gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <div className="flex-1 relative">
        <Search className="absolute top-2.5 left-3 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('orders.search_placeholder')}
          className={`w-full rounded-md border-gray-200 focus:ring-amber-500 pl-10 ${isRtl ? 'pr-3 text-right' : 'pl-3'}`}
          aria-label={t('orders.search_placeholder')}
        />
      </div>
      <div className="flex gap-4">
        <Select
          options={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          className="w-40 rounded-md border-gray-200 focus:ring-amber-500"
          aria-label={t('orders.filter_status')}
        />
        <Select
          options={sortOptions}
          value={sortBy}
          onChange={setSortBy}
          className="w-40 rounded-md border-gray-200 focus:ring-amber-500"
          aria-label={t('orders.sort_by')}
        />
      </div>
      <div className="text-sm text-gray-500">
        {t('orders.orders_count', { count: ordersCount })}
      </div>
    </div>
  );
};

export default Filters;