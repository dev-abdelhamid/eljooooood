import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { Input } from '../UI/Input';
import { Search, Upload } from 'lucide-react';
import { Branch } from '../../types/types';

interface FiltersProps {
  searchQuery: string;
  filterStatus: string;
  filterBranch: string;
  sortBy: string;
  branches: Branch[];
  setSearchQuery: (value: string) => void;
  setFilterStatus: (value: string) => void;
  setFilterBranch: (value: string) => void;
  setSortBy: (value: string) => void;
  exportToExcel: () => void;
  exportToPDF: () => void;
  filteredOrdersCount: number;
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

const Filters: React.FC<FiltersProps> = ({
  searchQuery,
  filterStatus,
  filterBranch,
  sortBy,
  branches,
  setSearchQuery,
  setFilterStatus,
  setFilterBranch,
  setSortBy,
  exportToExcel,
  exportToPDF,
  filteredOrdersCount,
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <Card className="p-4 mb-6 bg-white shadow-lg rounded-xl border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <label className="block text-sm font-semibold text-gray-800 mb-1">{t('common.search')}</label>
          <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
            <Search className={`w-5 h-5 text-gray-500 absolute ${isRtl ? 'right-3' : 'left-3'}`} />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target?.value || '')}
              placeholder={t('orders.search_placeholder')}
              className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 rounded-lg bg-transparent text-sm text-gray-900 border-0 focus:outline-none`}
              aria-label={t('common.search')}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">{t('orders.filter_by_status')}</label>
          <Select
            options={statusOptions.map((opt) => ({ ...opt, label: t(`orders.${opt.label}`) }))}
            value={filterStatus}
            onChange={setFilterStatus}
            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
            aria-label={t('orders.filter_by_status')}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">{t('orders.filter_by_branch')}</label>
          <Select
            options={[{ value: '', label: t('branches.all') }, ...branches.map((b) => ({ value: b._id, label: b.name }))]}
            value={filterBranch}
            onChange={setFilterBranch}
            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
            aria-label={t('orders.filter_by_branch')}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">{t('orders.sort_by')}</label>
          <Select
            options={sortOptions.map((opt) => ({ ...opt, label: t(`orders.${opt.label}`) }))}
            value={sortBy}
            onChange={setSortBy}
            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
            aria-label={t('orders.sort_by')}
          />
        </div>
      </div>
      <div className={`flex items-center gap-3 mt-4 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 rounded-lg text-sm shadow-md"
          aria-label={t('orders.export_excel')}
        >
          <Upload className="w-4 h-4 rotate-180" />
          {t('orders.export_excel')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportToPDF}
          className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200 rounded-lg text-sm shadow-md"
          aria-label={t('orders.export_pdf')}
        >
          <Upload className="w-4 h-4 rotate-180" />
          {t('orders.export_pdf')}
        </Button>
        <div className="text-sm text-gray-600 font-medium">
          {t('orders.orders_count', { count: filteredOrdersCount })}
        </div>
      </div>
    </Card>
  );
};

export default Filters;