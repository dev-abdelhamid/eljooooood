import React, { useCallback } from 'react';
import { Button } from '../UI/Button';
import { motion } from 'framer-motion';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  isRtl: boolean;
  handlePageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, isRtl, handlePageChange }) => {
  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage, handlePageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, handlePageChange]);

  const getPageNumbers = useCallback(() => {
    const maxPagesToShow = 5;
    const pages: (number | string)[] = [];
    const startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex justify-center items-center gap-2 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}
      role="navigation"
      aria-label={isRtl ? 'التنقل بين الصفحات' : 'Pagination navigation'}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
      >
        {isRtl ? 'السابق' : 'Previous'}
      </Button>
      {getPageNumbers().map((page, index) => (
        <Button
          key={index}
          variant={page === currentPage ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => typeof page === 'number' && handlePageChange(page)}
          disabled={typeof page !== 'number'}
          className={`${
            page === currentPage
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          } rounded-lg px-3 py-2 text-sm shadow-sm ${typeof page !== 'number' ? 'cursor-default' : ''}`}
          aria-label={typeof page === 'number' ? (isRtl ? `الصفحة ${page}` : `Page ${page}`) : isRtl ? '...' : '...'}
        >
          {page}
        </Button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
      >
        {isRtl ? 'التالي' : 'Next'}
      </Button>
    </motion.div>
  );
};

export default Pagination;