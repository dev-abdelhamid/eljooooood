import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn'; // افتراض وجود دالة مساعدة لدمج كلاسات Tailwind

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <div className={cn('w-full overflow-x-auto', className)} dir={isRtl ? 'rtl' : 'ltr'}>
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className }) => {
  return (
    <thead className={cn('bg-gray-50 border-b border-gray-200', className)}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<TableBodyProps> = ({ children, className }) => {
  return (
    <tbody className={cn('divide-y divide-gray-200', className)}>
      {children}
    </tbody>
  );
};

export const TableRow: React.FC<TableRowProps> = ({ children, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <motion.tr
      className={cn('transition-colors', isRtl ? 'flex-row-reverse' : '', className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.tr>
  );
};

export const TableHead: React.FC<TableHeadProps> = ({ children, className }) => {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left',
        isRtl ? 'text-right' : 'text-left',
        className
      )}
      scope="col"
    >
      {children}
    </th>
  );
};

export const TableCell: React.FC<TableCellProps> = ({ children, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-gray-900 whitespace-nowrap',
        isRtl ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </td>
  );
};