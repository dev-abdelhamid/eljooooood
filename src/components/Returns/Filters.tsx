import React, { useCallback } from 'react';
import { State } from '../../types/types';
import { Search, X } from 'lucide-react';

interface FiltersProps {
  state: State;
  dispatch: React.Dispatch<any>;
  isRtl: boolean;
  branches: any[]; // Branches with displayName
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Filters: React.FC<FiltersProps> = ({ state, dispatch, isRtl, branches, onSearchChange }) => {
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch({ type: 'SET_FILTER_STATUS', payload: e.target.value });
    },
    [dispatch]
  );

  const handleBranchChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch({ type: 'SET_FILTER_BRANCH', payload: e.target.value });
    },
    [dispatch]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const [by, order] = e.target.value.split(':');
      dispatch({ type: 'SET_SORT', by, order });
    },
    [dispatch]
  );

  const handleResetFilters = useCallback(() => {
    dispatch({ type: 'SET_FILTER_STATUS', payload: '' });
    dispatch({ type: 'SET_FILTER_BRANCH', payload: '' });
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    dispatch({ type: 'SET_SORT', by: 'createdAt', order: 'desc' });
  }, [dispatch]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
            {isRtl ? 'البحث' : 'Search'}
          </label>
          <div className="relative">
            <Search className={`absolute top-3 ${isRtl ? 'right-3' : 'left-3'} h-4 w-4 text-gray-400`} />
            <input
              type="text"
              value={state.searchQuery}
              onChange={onSearchChange}
              placeholder={isRtl ? 'ابحث برقم المرتجع أو الطلب' : 'Search by return or order number'}
              className={`block w-full rounded-lg border-gray-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2.5 ${
                isRtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
              } transition-all duration-200 ease-in-out`}
            />
          </div>
        </div>
        <div>
          <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
            {isRtl ? 'الحالة' : 'Status'}
          </label>
          <select
            value={state.filterStatus}
            onChange={handleStatusChange}
            className={`block w-full rounded-lg border-gray-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2.5 ${
              isRtl ? 'text-right' : 'text-left'
            } transition-all duration-200 ease-in-out`}
          >
            <option value="">{isRtl ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="pending">{isRtl ? 'في انتظار الموافقة' : 'Pending'}</option>
            <option value="approved">{isRtl ? 'تمت الموافقة' : 'Approved'}</option>
            <option value="rejected">{isRtl ? 'مرفوض' : 'Rejected'}</option>
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
            {isRtl ? 'الفرع' : 'Branch'}
          </label>
          <select
            value={state.filterBranch}
            onChange={handleBranchChange}
            className={`block w-full rounded-lg border-gray-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2.5 ${
              isRtl ? 'text-right' : 'text-left'
            } transition-all duration-200 ease-in-out`}
          >
            <option value="">{isRtl ? 'جميع الفروع' : 'All Branches'}</option>
            {branches.length > 0 ? (
              branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name} {/* Backend returns displayName based on isRtl */}
                </option>
              ))
            ) : (
              <option disabled>{isRtl ? 'لا توجد فروع' : 'No branches available'}</option>
            )}
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
            {isRtl ? 'الترتيب' : 'Sort'}
          </label>
          <select
            value={`${state.sortBy}:${state.sortOrder}`}
            onChange={handleSortChange}
            className={`block w-full rounded-lg border-gray-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm py-2.5 ${
              isRtl ? 'text-right' : 'text-left'
            } transition-all duration-200 ease-in-out`}
          >
            <option value="createdAt:desc">{isRtl ? 'التاريخ (تنازلي)' : 'Date (Descending)'}</option>
            <option value="createdAt:asc">{isRtl ? 'التاريخ (تصاعدي)' : 'Date (Ascending)'}</option>
            <option value="totalAmount:desc">{isRtl ? 'الإجمالي (تنازلي)' : 'Total Amount (Descending)'}</option>
            <option value="totalAmount:asc">{isRtl ? 'الإجمالي (تصاعدي)' : 'Total Amount (Ascending)'}</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleResetFilters}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${
            isRtl ? 'flex-row-reverse' : ''
          }`}
        >
          <X className="w-4 h-4" />
          {isRtl ? 'إعادة تعيين' : 'Reset Filters'}
        </button>
      </div>
    </div>
  );
};

export default Filters;