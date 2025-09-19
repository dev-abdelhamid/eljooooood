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
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
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
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-sm shadow-sm"
        aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
      >
        {isRtl ? 'السابق' : 'Previous'}
      </Button>
      {getPageNumbers().map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => handlePageChange(page)}
          className={`${
            page === currentPage
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          } rounded-lg px-3 py-1.5 text-sm shadow-sm`}
          aria-label={isRtl ? `الصفحة ${page}` : `Page ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </Button>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-sm shadow-sm"
        aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
      >
        {isRtl ? 'التالي' : 'Next'}
      </Button>
      <span className="text-gray-700 text-sm font-semibold">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
    </motion.div>
  );
};

export default Pagination;