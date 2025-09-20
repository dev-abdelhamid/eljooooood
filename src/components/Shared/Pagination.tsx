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

  if (totalPages <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex justify-center items-center gap-2 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}
      role="navigation"
      aria-label={paginationText.navigation}
    >
      <Button
        variant="secondary"
        size="xs"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-3 py-1 text-xs shadow-sm"
        aria-label={paginationText.previous}
      >
        {paginationText.previous}
      </Button>
      <span className="text-gray-700 text-xs font-medium">
        {paginationText.page}
      </span>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-3 py-1 text-xs shadow-sm"
        aria-label={paginationText.next}
      >
        {paginationText.next}
      </Button>
    </motion.div>
  );
};

export default Pagination;