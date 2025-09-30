import React from 'react';
import { Select } from '../../components/UI/Select';
import { Input } from '../../components/UI/Input';
import { Search, RefreshCw } from 'lucide-react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Branch, OrderStatus } from '../../types/types';

interface OrdersFiltersProps {
  isRtl: boolean;
  searchQuery: string;
  filterStatus: string;
  filterBranch: string;
  sortBy: 'date' | 'totalAmount' | 'priority';
  sortOrder: 'asc' | 'desc';
  branches: Branch[];
  dispatch: React.Dispatch<any>;
}

const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'in_transit', label: 'in_transit' },
  { value: 'delivered', label: 'delivered' },
  { value: 'cancelled', label: 'cancelled' },
];

const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalAmount', label: 'sort_total_amount' },
  { value: 'priority', label: 'sort_priority' },
];

const OrdersFilters: React.FC<OrdersFiltersProps> = ({
  isRtl,
  searchQuery,
  filterStatus,
  filterBranch,
  sortBy,
  sortOrder,
  branches,
  dispatch,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
  };

  const handleResetFilters = () => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    dispatch({ type: 'SET_FILTER_STATUS', payload: '' });
    dispatch({ type: 'SET_FILTER_BRANCH', payload: '' });
    dispatch({ type: 'SET_SORT', by: 'date', order: 'desc' });
  };

  return (
    <Card className="p-3 mt-6 bg-white shadow-md rounded-xl border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'بحث' : 'Search'}</label>
          <div className="relative">
            <Search className={`w-4 h-4 text-gray-500 absolute top-2 ${isRtl ? 'left-2' : 'right-2'}`} />
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
              className={`w-full ${isRtl ? 'pl-8' : 'pr-8'} rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200`}
              dir={isRtl ? 'rtl' : 'ltr'}
              lang={isRtl ? 'ar' : 'en'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}</label>
          <Select
            options={statusOptions.map(opt => ({
              value: opt.value,
              label: isRtl
                ? {
                    '': 'كل الحالات',
                    pending: 'قيد الانتظار',
                    approved: 'تم الموافقة',
                    in_production: 'في الإنتاج',
                    completed: 'مكتمل',
                    in_transit: 'في النقل',
                    delivered: 'تم التسليم',
                    cancelled: 'ملغى',
                  }[opt.value]
                : opt.label,
            }))}
            value={filterStatus}
            onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
            className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الفرع' : 'Filter by Branch'}</label>
          <Select
            options={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...branches.map(b => ({ value: b._id, label: b.displayName }))]}
            value={filterBranch}
            onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
            className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
          <Select
            options={sortOptions.map(opt => ({
              value: opt.value,
              label: isRtl
                ? { date: 'التاريخ', totalAmount: 'إجمالي المبلغ', priority: 'الأولوية' }[opt.value]
                : opt.label,
            }))}
            value={sortBy}
            onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: sortOrder })}
            className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="secondary"
          onClick={handleResetFilters}
          className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
        >
          <RefreshCw className="w-4 h-4" />
          {isRtl ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
        </Button>
      </div>
    </Card>
  );
};

export default OrdersFilters;