import React, { useCallback, useMemo } from 'react';
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

  const paginationText = useMemo(() => ({
    previous: isRtl ? 'السابق' : 'Previous',
    next: isRtl ? 'التالي' : 'Next',
    page: isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`,
    navigation: isRtl ? 'تصفح الصفحات' : 'Page navigation',
  }), [isRtl, currentPage, totalPages]);

  // Generate page numbers to display
  const getPageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-wrap justify-center items-center gap-2 mt-8 ${isRtl ? 'flex-row-reverse' : ''}`}
      role="navigation"
      aria-label={paginationText.navigation}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className={`disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all duration-200 ${
          isRtl ? 'ml-2' : 'mr-2'
        }`}
        aria-label={paginationText.previous}
      >
        {isRtl ? '›' : '‹'}
      </Button>

      {getPageNumbers.map((page, index) => (
        <Button
          key={`${page}-${index}`}
          variant={page === currentPage ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => typeof page === 'number' && handlePageChange(page)}
          disabled={typeof page !== 'number'}
          className={`${
            page === currentPage
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all duration-200 ${
            typeof page !== 'number' ? 'cursor-default' : ''
          }`}
          aria-label={typeof page === 'number' ? `${paginationText.page} ${page}` : undefined}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {isRtl && typeof page === 'number' ? (page) : page}
        </Button>
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className={`disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all duration-200 ${
          isRtl ? 'mr-2' : 'ml-2'
        }`}
        aria-label={paginationText.next}
      >
        {isRtl ? '‹' : '›'}
      </Button>

      <span className="text-sm text-gray-600 font-medium mx-3">
        {paginationText.page}
      </span>
    </motion.div>
  );
};

export default Pagination;