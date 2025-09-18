import React, { memo } from 'react';
import { Button } from '../UI/Button';

interface Props {
  currentPage: number;
  totalPages: number;
  t: any;
  isRtl: boolean;
  handlePageChange: (page: number) => void;
}

const Pagination: React.FC<Props> = memo(({ currentPage, totalPages, t, isRtl, handlePageChange }) => (
  totalPages > 1 && (
    <div className={`flex justify-center items-center gap-2 mt-6 ${isRtl ? 'flex-row' : ''}`}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-xs"
        aria-label={t('pagination.previous')}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-gray-600 text-sm font-medium">
        {t('pagination.page', { current: currentPage, total: totalPages })}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1 text-xs"
        aria-label={t('pagination.next')}
      >
        {t('pagination.next')}
      </Button>
    </div>
  )
));

export default Pagination;