import React from 'react';
import { Button } from '../../components/UI/Button';
import { ShoppingCart, Download } from 'lucide-react';

interface OrdersHeaderProps {
  isRtl: boolean;
  ordersLength: number;
  exportToExcel: () => void;
  exportToPDF: () => void;
}

const OrdersHeader: React.FC<OrdersHeaderProps> = ({ isRtl, ordersLength, exportToExcel, exportToPDF }) => {
  return (
    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <div className="w-full sm:w-auto text-center sm:text-start">
        <h1 className="text-xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
          <ShoppingCart className="w-5 h-5 text-amber-700" />
          {isRtl ? 'الطلبات' : 'Orders'}
        </h1>
        <p className="text-xs text-gray-600 mt-1">{isRtl ? 'إدارة طلبات الإنتاج' : 'Manage production orders'}</p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
        <Button
          variant={ordersLength > 0 ? 'primary' : 'secondary'}
          onClick={ordersLength > 0 ? exportToExcel : undefined}
          className={`flex items-center gap-1 ${ordersLength > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300`}
          disabled={ordersLength === 0}
        >
          <Download className="w-4 h-4" />
          {isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
        </Button>
        <Button
          variant={ordersLength > 0 ? 'primary' : 'secondary'}
          onClick={ordersLength > 0 ? exportToPDF : undefined}
          className={`flex items-center gap-1 ${ordersLength > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300`}
          disabled={ordersLength === 0}
        >
          <Download className="w-4 h-4" />
          {isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
        </Button>
      </div>
    </div>
  );
};

export default OrdersHeader;