import React from 'react';
import { Button } from '../../components/UI/Button';

interface PaginationProps {
  handlePageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  isRtl: boolean;
}

const Pagination: React.FC<PaginationProps> = ({ handlePageChange, currentPage, totalPages, isRtl }) => (
  <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row' : ''}`}>
    <Button
      variant="secondary"
      size="sm"
      onClick={() => handlePageChange(currentPage - 1)}
      disabled={currentPage === 1}
      className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 transition-colors"
      aria-label={isRtl ? 'الصفحة السابقة' : 'Previous Page'}
    >
      {isRtl ? 'السابق' : 'Previous'}
    </Button>
    <span className="text-sm text-gray-700 font-medium">
      {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
    </span>
    <Button
      variant="secondary"
      size="sm"
      onClick={() => handlePageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 transition-colors"
      aria-label={isRtl ? 'الصفحة التالية' : 'Next Page'}
    >
      {isRtl ? 'التالي' : 'Next'}
    </Button>
  </div>
);

export default Pagination;