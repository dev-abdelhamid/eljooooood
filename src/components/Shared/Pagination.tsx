import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../UI/Button';
import { motion } from 'framer-motion';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  if (totalPages <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex justify-center items-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={t('pagination.previous')}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-gray-700 text-sm font-semibold">
        {t('pagination.page', { current: currentPage, total: totalPages })}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm shadow-sm"
        aria-label={t('pagination.next')}
      >
        {t('pagination.next')}
      </Button>
    </motion.div>
  );
};

export default Pagination;