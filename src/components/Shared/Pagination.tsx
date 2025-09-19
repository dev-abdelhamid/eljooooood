import React, { useCallback } from 'react';
import { Button } from '../UI/Button';
import { motion } from 'framer-motion';

// ترجمات ثابتة
const translations = {
  ar: {
    navigation: 'تصفح الصفحات',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة {current} من {total}',
  },
  en: {
    navigation: 'Page navigation',
    previous: 'Previous',
    next: 'Next',
    page: 'Page {current} of {total}',
  },
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  isRtl: boolean;
  handlePageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, isRtl, handlePageChange }) => {
  const t = translations[isRtl ? 'ar' : 'en'];

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

  if (totalPages <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex justify-center items-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}
      role="navigation"
      aria-label={t.navigation}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={t.previous}
      >
        {t.previous}
      </Button>
      <span className="text-gray-700 text-sm font-semibold">
        {t.page.replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={t.next}
      >
        {t.next}
      </Button>
    </motion.div>
  );
};

export default Pagination;