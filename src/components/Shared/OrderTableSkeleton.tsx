import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../UI/Table';
import { useLanguage } from '../../contexts/LanguageContext';

// واجهة المكون
interface OrderTableSkeletonProps {
  isRtl?: boolean;
}

// مكون Skeleton للجدول
const OrderTableSkeleton: React.FC<OrderTableSkeletonProps> = ({ isRtl = false }) => {
  // عدد الأعمدة والصفوف
  const columnsCount = 7; // يتطابق مع عدد الأعمدة في OrderTable في الصفحة المقدمة
  const rowsCount = 5; // عدد الصفوف المعروضة أثناء التحميل

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto bg-white shadow-lg rounded-lg border border-gray-100"
    >
      <Table className="w-full">
        <TableHeader>
          <TableRow className={isRtl ? 'flex-row-reverse' : ''}>
            {Array(columnsCount)
              .fill(0)
              .map((_, index) => (
                <TableHead key={index} className="px-4 py-3">
                  <Skeleton width={80} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(rowsCount)
            .fill(0)
            .map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                {Array(columnsCount)
                  .fill(0)
                  .map((_, cellIndex) => (
                    <TableCell key={cellIndex} className="px-4 py-3">
                      <Skeleton width={100} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                    </TableCell>
                  ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </motion.div>
  );
};

export default OrderTableSkeleton;
