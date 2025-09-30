import React from 'react';
import { Button } from '../../components/UI/Button';

interface OrdersPaginationProps {
  isRtl: boolean;
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
}

const OrdersPagination: React.FC<OrdersPaginationProps> = ({ isRtl, currentPage, totalPages, handlePageChange }) => {
  return (
    <div className={`flex justify-between items-center mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <Button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 bg-amber-600 text-white rounded-full disabled:opacity-50"
      >
        {isRtl ? 'السابق' : 'Previous'}
      </Button>
      <span className="text-sm text-gray-600">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
      <Button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 bg-amber-600 text-white rounded-full disabled:opacity-50"
      >
        {isRtl ? 'التالي' : 'Next'}
      </Button>
    </div>
  );
};

export default OrdersPagination;