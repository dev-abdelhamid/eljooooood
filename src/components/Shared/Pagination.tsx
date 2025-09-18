import React, { useCallback } from 'react';
import { Button } from '../UI/Button';
import { motion } from 'framer-motion';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  handlePageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, t, isRtl, handlePageChange }) => {
  const handlePrevious = useCallback(() => {
    if (currentPage > 1) handlePageChange(currentPage - 1);
  }, [currentPage, handlePageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) handlePageChange(currentPage + 1);
  }, [currentPage, totalPages, handlePageChange]);

  if (totalPages <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex justify-center items-center gap-2 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}
      role="navigation"
      aria-label={t('pagination.navigation')}
    >
      <Button
        variant="secondary"
        size="xs"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-2 py-1 text-xs disabled:opacity-50"
        aria-label={t('pagination.previous')}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-xs font-semibold text-gray-700">
        {t('pagination.page', { current: currentPage, total: totalPages })}
      </span>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-2 py-1 text-xs disabled:opacity-50"
        aria-label={t('pagination.next')}
      >
        {t('pagination.next')}
      </Button>
    </motion.div>
  );
};

export default Pagination;