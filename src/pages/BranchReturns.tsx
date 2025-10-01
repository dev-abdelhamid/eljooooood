import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import debounce from 'lodash/debounce';
import './BranchReturns.css';

const BranchReturns = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [returns, setReturns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReturns = useCallback(async () => {
    try {
      const response = await axios.get('/api/returns', {
        params: { page, limit, status: statusFilter, lang: language },
      });
      setReturns(response.data.returns);
      setTotal(response.data.total);
    } catch (error) {
      toast.error(t('errors.fetchReturns'));
      console.error('Error fetching returns:', error);
    }
  }, [page, statusFilter, language, limit, t]);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        try {
          const response = await axios.get('/api/returns', {
            params: { page: 1, limit, status: statusFilter, search: query, lang: language },
          });
          setReturns(response.data.returns);
          setTotal(response.data.total);
        } catch (error) {
          toast.error(t('errors.fetchReturns'));
          console.error('Error searching returns:', error);
        }
      }, 500),
    [statusFilter, language, limit, t]
  );

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  useEffect(() => {
    const socket = io();
    socket.on('returnCreated', (data) => {
      if (data.branchId === 'userBranchId') {
        // استبدل 'userBranchId' بمعرف الفرع الفعلي للمستخدم
        setReturns((prev) => [data, ...prev.slice(0, limit - 1)]);
        toast.info(t('returns.newReturnCreated'));
      }
    });
    socket.on('returnStatusUpdated', (data) => {
      if (data.branchId === 'userBranchId') {
        setReturns((prev) =>
          prev.map((ret) => (ret._id === data.returnId ? { ...ret, status: data.status, items: data.items } : ret))
        );
        toast.info(t('returns.statusUpdated'));
      }
    });
    return () => socket.disconnect();
  }, [limit, t]);

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const exportToJSON = useCallback(() => {
    const json = JSON.stringify(returns, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'returns.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [returns]);

  const statusTranslations = useMemo(
    () => ({
      pending_approval: t('returns.status.pending'),
      approved: t('returns.status.approved'),
      rejected: t('returns.status.rejected'),
    }),
    [t]
  );

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'rtl' : 'ltr'}`}>
      <h1 className="text-2xl font-bold mb-4">{t('returns.title')}</h1>
      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder={t('returns.searchPlaceholder')}
          value={searchQuery}
          onChange={handleSearch}
          className="border p-2 rounded w-full sm:w-1/2"
        />
        <select
          value={statusFilter}
          onChange={handleStatusFilter}
          className="border p-2 rounded w-full sm:w-1/4"
        >
          <option value="">{t('returns.allStatuses')}</option>
          <option value="pending_approval">{t('returns.status.pending')}</option>
          <option value="approved">{t('returns.status.approved')}</option>
          <option value="rejected">{t('returns.status.rejected')}</option>
        </select>
        <button
          onClick={exportToJSON}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          {t('returns.exportJSON')}
        </button>
      </div>
      <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {returns.map((ret) => (
            <motion.div
              key={ret._id}
              className="border rounded-lg p-4 shadow hover:shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-lg font-semibold">{t('returns.returnNumber')}: {ret.returnNumber}</h2>
              <p>{t('returns.orderNumber')}: {ret.order?.orderNumber}</p>
              <p>{t('returns.branch')}: {ret.branchName}</p>
              <p>{t('returns.status')}: {statusTranslations[ret.status]}</p>
              <p>{t('returns.reason')}: {ret.reason}</p>
              <p>{t('returns.createdBy')}: {ret.createdByName}</p>
              <div className="mt-2">
                <h3 className="font-semibold">{t('returns.items')}</h3>
                <ul className="list-disc list-inside">
                  {ret.items.map((item, index) => (
                    <li key={index}>
                      {t('returns.product')}: {item.productName} ({item.quantity} {item.unit}) -{' '}
                      {t('returns.department')}: {item.departmentName} - {t('returns.reason')}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
          className="bg-gray-300 text-gray-700 p-2 rounded disabled:opacity-50"
        >
          {t('returns.previous')}
        </button>
        <span>
          {t('returns.page')} {page} {t('returns.of')} {Math.ceil(total / limit)}
        </span>
        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={page * limit >= total}
          className="bg-gray-300 text-gray-700 p-2 rounded disabled:opacity-50"
        >
          {t('returns.next')}
        </button>
      </div>
    </div>
  );
};

export default BranchReturns;