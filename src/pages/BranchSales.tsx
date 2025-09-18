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
  id: string;
  branch: { _id: string; name: string };
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>;
  total: number;
  date: string;
  notes?: string;
}

interface Branch {
  _id: string;
  name: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  quantity: number;
  branchId: string;
}

interface Product {
  _id: string;
  name: string;
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
      console.log('fetchData - API params:', params);

      const [salesResponse, branchesResponse, inventoryResponse, productsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getAll({ branch: user.role === 'branch' ? user.branchId : filterBranch }),
        productsAPI.getAll(),
      ]);

      console.log('fetchData - Responses:', { salesResponse, branchesResponse, inventoryResponse, productsResponse });

      if (!salesResponse || !Array.isArray(salesResponse.sales)) {
        console.error('fetchData - Invalid sales response:', salesResponse);
        setSales([]);
        setError(t('errors.invalid_sales_response'));
        setLoading(false);
        return;
      }

      setSales(
        salesResponse.sales.map((sale: any) => ({
          id: sale._id,
          branch: sale.branch || { _id: 'unknown', name: t('branches.unknown') },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                productId: item.product?._id || item.productId,
                productName: item.product?.name || item.productName || t('products.unknown'),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            : [],
          total: sale.totalAmount || (Array.isArray(sale.items) ? sale.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0) : 0),
          date: new Date(sale.createdAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          notes: sale.notes,
        }))
      );

      const branchesData = Array.isArray(branchesResponse.branches)
        ? branchesResponse.branches.map((branch: any) => ({
            _id: branch._id,
            name: branch.name,
          }))
        : [];
      setBranches(branchesData);

      setInventory(
        Array.isArray(inventoryResponse)
          ? inventoryResponse.map((item: any) => ({
              productId: item.productId || item.product?._id,
              productName: item.productName || item.product?.name || t('products.unknown'),
              quantity: item.quantity,
              branchId: item.branchId || item.branch?._id,
            }))
          : []
      );

      const productsData = Array.isArray(productsResponse)
        ? productsResponse.map((product: any) => ({
            _id: product._id,
            name: product.name,
            price: product.price,
          }))
        : [];
      setProducts(productsData);

      // إعادة تعيين filterBranch إذا كان غير صالح
      if (filterBranch && !branchesData.find((b) => b._id === filterBranch)) {
        console.warn('fetchData - Invalid filterBranch:', filterBranch);
        setFilterBranch('');
      }

      // إعادة تعيين filterProduct إذا كان غير صالح
      if (filterProduct && !productsData.find((p) => p._id === filterProduct)) {
        console.warn('fetchData - Invalid filterProduct:', filterProduct);
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target) {
                setStartDate(e.target.value);
              } else {
                console.warn('onChange - e.target is undefined:', e);
              }
            }}
            className="w-full sm:w-40"
            aria-label={t('salesReport.startDate')}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target) {
                setEndDate(e.target.value);
              } else {
                console.warn('onChange - e.target is undefined:', e);
              }
            }}
            className="w-full sm:w-40"
            aria-label={t('salesReport.endDate')}
          />
          {user?.role === 'admin' && (
            <Select
              value={filterBranch}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                if (e.target) {
                  setFilterBranch(e.target.value);
                } else {
                  console.warn('Select onChange - e.target is undefined:', e);
                }
              }}
              options={branches.map((branch) => ({
                value: branch._id,
                label: branch.name,
              }))}
              placeholder={t('branches.select_branch')}
              className="w-full sm:w-40"
              aria-label={t('salesReport.selectBranch')}
            />
          )}
          <Select
            value={filterProduct}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              if (e.target) {
                setFilterProduct(e.target.value);
              } else {
                console.warn('Select onChange - e.target is undefined:', e);
              }
            }}
            options={products.map((product) => ({
              value: product._id,
              label: product.name,
            }))}
            placeholder={t('products.select_product')}
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
              key={sale.id}
              className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{sale.branch.name}</h3>
                  <p className="text-sm text-gray-600">{t('salesReport.date')}: {sale.date}</p>
                  <p className="text-sm text-gray-600">{t('salesReport.total')}: {sale.total}</p>
                  {sale.notes && <p className="text-sm text-gray-500">{t('salesReport.notes')}: {sale.notes}</p>}
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">{t('salesReport.items')}:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {sale.items.map((item, index) => (
                        <li key={index}>
                          {item.productName} - {t('salesReport.quantity')}: {item.quantity}, {t('salesReport.unitPrice')}: {item.unitPrice}
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