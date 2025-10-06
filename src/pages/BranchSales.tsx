// src/pages/SalesReport.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI, inventoryAPI, productsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { AlertCircle, DollarSign } from 'lucide-react';

interface Sale {
  _id: string;
  saleNumber: string;
  branch: { _id: string; name: string; nameEn: string; displayName: string };
  items: Array<{
    product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string; department: { name: string; nameEn: string; displayName: string } | undefined };
    quantity: number;
    unitPrice: number;
    productName: string;
    productNameEn: string;
    displayName: string;
    displayUnit: string;
  }>;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  returns: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ product: string; productName: string; productNameEn: string; quantity: number; reason: string }>;
    reason: string;
    createdAt: string;
  }>;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
}

interface InventoryItem {
  _id: string;
  product: { _id: string; name: string; nameEn: string };
  currentStock: number;
  branch: { _id: string };
}

interface Product {
  _id: string;
  name: string;
  nameEn: string;
  price: number;
}

export const SalesReport: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.role || !['branch', 'admin'].includes(user.role)) {
      console.error('fetchData - Unauthorized access:', { user });
      setError(t('errors.unauthorized_access'));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      if (user.role === 'branch' && user.branchId) {
        params.branch = user.branchId;
      } else if (filterBranch) {
        params.branch = filterBranch;
      }
      if (filterProduct) {
        params.product = filterProduct;
      }

      const [salesResponse, branchesResponse, inventoryResponse, productsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getAll({ branch: user.role === 'branch' ? user.branchId : filterBranch }),
        productsAPI.getAll(),
      ]);

      setSales(salesResponse.sales || []);
      setBranches(branchesResponse.branches || []);
      setInventory(inventoryResponse || []);
      setProducts(productsResponse || []);

      // Reset filters if invalid
      if (filterBranch && !branchesResponse.branches.find((b: Branch) => b._id === filterBranch)) {
        setFilterBranch('');
      }
      if (filterProduct && !productsResponse.find((p: Product) => p._id === filterProduct)) {
        setFilterProduct('');
      }

      setError('');
    } catch (err: any) {
      console.error('fetchData - Error:', err.message, err.stack);
      setError(err.message || t('errors.fetch_sales'));
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterBranch, filterProduct, user, isRtl, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-teal-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          {t('salesReport.title')}
        </h1>
        <p className="text-gray-600 mt-2">{t('salesReport.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-40"
            aria-label={t('salesReport.startDate')}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-40"
            aria-label={t('salesReport.endDate')}
          />
          {user?.role === 'admin' && (
            <Select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              options={[
                { value: '', label: t('branches.select_branch') },
                ...branches.map((branch) => ({
                  value: branch._id,
                  label: isRtl ? branch.name : branch.nameEn || branch.name,
                })),
              ]}
              className="w-full sm:w-40"
              aria-label={t('salesReport.selectBranch')}
            />
          )}
          <Select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            options={[
              { value: '', label: t('products.select_product') },
              ...products.map((product) => ({
                value: product._id,
                label: isRtl ? product.name : product.nameEn || product.name,
              })),
            ]}
            className="w-full sm:w-40"
            aria-label={t('salesReport.selectProduct')}
          />
        </div>
      </Card>

      <div className="space-y-4">
        {sales.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-xl shadow-md">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('salesReport.noSales')}</p>
          </Card>
        ) : (
          sales.map((sale) => (
            <Card
              key={sale._id}
              className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{sale.branch.displayName}</h3>
                  <p className="text-sm text-gray-600">{t('salesReport.date')}: {sale.createdAt}</p>
                  <p className="text-sm text-gray-600">{t('salesReport.total')}: {sale.totalAmount}</p>
                  {sale.notes && <p className="text-sm text-gray-500">{t('salesReport.notes')}: {sale.notes}</p>}
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">{t('salesReport.items')}:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {sale.items.map((item, index) => (
                        <li key={index}>
                          {item.displayName} - {t('salesReport.quantity')}: {item.quantity}, {t('salesReport.unitPrice')}: {item.unitPrice}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesReport;