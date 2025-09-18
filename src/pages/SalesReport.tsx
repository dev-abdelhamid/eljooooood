import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {  branchesAPI, inventoryAPI, returnsAPI } from '../services/api';
import salesAPI from '../services/salesAPI';

import { Card } from '../components/UI/Card';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { AlertCircle, DollarSign, PlusCircle, MinusCircle, Trash2, Calendar } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Sale {
  _id: string;
  orderNumber: string;
  branch: { _id: string; name: string };
  items: Array<{ product: string; productName: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ product: string; quantity: number; reason: string }>;
    reason: string;
    createdAt: string;
  }>;
}

interface Branch {
  _id: string;
  name: string;
}

interface InventoryItem {
  _id: string;
  product: { _id: string; name: string; price: number; department?: { _id: string; name: string } };
  currentStock: number;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface SalesAnalytics {
  branchSales: Array<{ branchId: string; branchName: string; totalSales: number }>;
  productSales: Array<{ productId: string; productName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ departmentId: string; departmentName: string; totalRevenue: number }>;
}

export const SalesReport: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({ branchSales: [], productSales: [], departmentSales: [] });
  const [filterBranch, setFilterBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');

  const fetchData = useCallback(async () => {
    if (!user?.role || !['branch', 'admin'].includes(user.role)) {
      setError(t('errors.unauthorized_access'));
      toast.error(t('errors.unauthorized_access'));
      setLoading(false);
      return;
    }

    if (user.role === 'branch' && !user.branchId && !selectedBranch) {
      setError(t('errors.no_branch_assigned'));
      toast.error(t('errors.no_branch_assigned'));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { page: 1, limit: 100 };
      if (user.role === 'branch') {
        params.branch = user.branchId || selectedBranch;
      } else if (filterBranch) {
        params.branch = filterBranch;
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [salesResponse, branchesResponse, inventoryResponse, returnsResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getInventory({ branch: user.branchId || selectedBranch, lowStock: false }),
        returnsAPI.getAll(params),
        user.role === 'admin' ? salesAPI.getAnalytics(params) : Promise.resolve({ branchSales: [], productSales: [], departmentSales: [] }),
      ]);

      const returnsMap = new Map<string, Sale['returns']>();
      if (Array.isArray(returnsResponse.returns)) {
        returnsResponse.returns.forEach((ret: any) => {
          const orderId = ret.order?._id || ret.order;
          if (!returnsMap.has(orderId)) returnsMap.set(orderId, []);
          returnsMap.get(orderId)!.push({
            _id: ret._id,
            returnNumber: ret.returnNumber,
            status: ret.status,
            items: Array.isArray(ret.items)
              ? ret.items.map((item: any) => ({
                  product: item.product?._id || item.product,
                  quantity: item.quantity,
                  reason: item.reason,
                }))
              : [],
            reason: ret.reason,
            createdAt: new Date(ret.createdAt).toLocaleDateString(t('locale'), {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          });
        });
      }

      setSales(
        salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.orderNumber,
          branch: sale.branch || { _id: 'unknown', name: t('branches.unknown') },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                product: item.product?._id || item.productId,
                productName: item.product?.name || item.productName || t('products.unknown'),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: new Date(sale.createdAt).toLocaleDateString(t('locale'), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          notes: sale.notes,
          returns: returnsMap.get(sale._id) || [],
        }))
      );

      setBranches(
        Array.isArray(branchesResponse.branches)
          ? branchesResponse.branches.map((branch: any) => ({
              _id: branch._id,
              name: branch.name,
            }))
          : []
      );

      setInventory(
        Array.isArray(inventoryResponse)
          ? inventoryResponse
              .filter((item: any) => item.currentStock > 0 && item.product?._id && item.product?.name)
              .map((item: any) => ({
                _id: item._id,
                product: {
                  _id: item.product?._id || 'unknown',
                  name: item.product?.name || t('products.unknown'),
                  price: item.product?.price || 0,
                  department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                },
                currentStock: item.currentStock || 0,
              }))
          : []
      );

      setAnalytics({
        branchSales: analyticsResponse.branchSales || [],
        productSales: analyticsResponse.productSales || [],
        departmentSales: analyticsResponse.departmentSales || [],
      });

      setError('');
    } catch (err: any) {
      setError(err.message || t('errors.fetch_sales'));
      toast.error(err.message || t('errors.fetch_sales'));
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [filterBranch, startDate, endDate, selectedBranch, user, t]);

  const addToCart = (product: InventoryItem) => {
    if (product.currentStock < 1) {
      setError(t('errors.insufficient_stock'));
      toast.error(t('errors.insufficient_stock'));
      return;
    }
    setCart((prev) => {
      const existingItem = prev.find((item) => item.productId === product.product._id);
      if (existingItem) {
        if (existingItem.quantity >= product.currentStock) {
          setError(t('errors.exceeds_max_quantity'));
          toast.error(t('errors.exceeds_max_quantity'));
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.product._id,
          productName: product.product.name,
          quantity: 1,
          unitPrice: product.product.price,
        },
      ];
    });
    setError('');
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    const inventoryItem = inventory.find((item) => item.product._id === productId);
    if (!inventoryItem || quantity < 1 || quantity > inventoryItem.currentStock) {
      setError(quantity < 1 ? t('errors.invalid_quantity') : t('errors.exceeds_max_quantity'));
      toast.error(quantity < 1 ? t('errors.invalid_quantity') : t('errors.exceeds_max_quantity'));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
    setError('');
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setError('');
  };

  const handleAddSale = async () => {
    if (user?.role === 'branch' && !user.branchId && !selectedBranch) {
      setError(t('errors.no_branch_assigned'));
      toast.error(t('errors.no_branch_assigned'));
      return;
    }

    if (cart.length === 0) {
      setError(t('errors.empty_cart'));
      toast.error(t('errors.empty_cart'));
      return;
    }

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: user?.role === 'branch' ? user.branchId || selectedBranch : selectedBranch,
        notes,
      };

      await salesAPI.create(payload);
      toast.success(t('salesReport.sale_success'));
      setCart([]);
      setNotes('');
      setSelectedBranch(user?.role === 'branch' && user?.branchId ? user.branchId : '');
      await fetchData();
    } catch (err: any) {
      setError(err.message || t('errors.create_sale_failed'));
      toast.error(err.message || t('errors.create_sale_failed'));
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Chart data for analytics
  const branchSalesChartData = {
    labels: analytics.branchSales.map((b) => b.branchName),
    datasets: [
      {
        label: t('salesReport.branchSales'),
        data: analytics.branchSales.map((b) => b.totalSales),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const productSalesChartData = {
    labels: analytics.productSales.map((p) => p.productName),
    datasets: [
      {
        label: t('salesReport.productSales'),
        data: analytics.productSales.map((p) => p.totalRevenue),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  const departmentSalesChartData = {
    labels: analytics.departmentSales.map((d) => d.departmentName),
    datasets: [
      {
        label: t('salesReport.departmentSales'),
        data: analytics.departmentSales.map((d) => d.totalRevenue),
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50" dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          {t('salesReport.title')}
        </h1>
        <p className="text-gray-600">{t('salesReport.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      {user?.role === 'admin' && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{t('salesReport.filters')}</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filterBranch}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterBranch(e.target.value)}
              options={[{ value: '', label: t('branches.all_branches') }, ...branches.map((branch) => ({
                value: branch._id,
                label: branch.name,
              }))]}
              placeholder={t('branches.select_branch')}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
              placeholder={t('salesReport.startDate')}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
              placeholder={t('salesReport.endDate')}
              className="w-full sm:w-40"
            />
          </div>
        </Card>
      )}

      {user?.role === 'branch' && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/4">
            <h2 className="text-xl font-semibold mb-4">{t('salesReport.availableProducts')}</h2>
            {user.role === 'branch' && !user.branchId && (
              <Select
                value={selectedBranch}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBranch(e.target.value)}
                options={branches.map((branch) => ({
                  value: branch._id,
                  label: branch.name,
                }))}
                placeholder={t('branches.select_branch')}
                className="w-full sm:w-48 mb-4"
                required
              />
            )}
            {inventory.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-600">{t('salesReport.noProducts')}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.map((product) => (
                  <Card key={product._id} className="p-5">
                    <h3 className="font-semibold">{product.product.name}</h3>
                    <p className="text-sm text-gray-600">
                      {t('salesReport.department')}: {product.product.department?.name || t('departments.unknown')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('salesReport.availableStock')}: {product.currentStock} {t('units.kg')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('salesReport.unitPrice')}: {product.product.price} {t('currency')}
                    </p>
                    <Button
                      onClick={() => addToCart(product)}
                      disabled={product.currentStock < 1}
                      className="mt-3 flex items-center gap-2"
                    >
                      <PlusCircle className="w-5 h-5" />
                      {t('salesReport.addToCart')}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="lg:w-1/4">
            <Card className="p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">{t('salesReport.cart')}</h2>
              {cart.length === 0 ? (
                <p className="text-gray-600">{t('salesReport.emptyCart')}</p>
              ) : (
                <>
                  <ul className="space-y-3 mb-4">
                    {cart.map((item) => (
                      <li key={item.productId} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} {t('units.kg')} × {item.unitPrice} {t('currency')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            size="sm"
                            variant="outline"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </Button>
                          <span>{item.quantity}</span>
                          <Button
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            size="sm"
                            variant="outline"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => removeFromCart(item.productId)}
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-lg font-semibold">
                    {t('salesReport.total')}: {cartTotal.toFixed(2)} {t('currency')}
                  </p>
                  <Input
                    type="textarea"
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    placeholder={t('salesReport.notes')}
                    className="w-full mt-4"
                  />
                  <Button
                    onClick={handleAddSale}
                    disabled={cart.length === 0 || (user?.role === 'branch' && !user.branchId && !selectedBranch)}
                    className="w-full mt-4"
                  >
                    {t('salesReport.submitSale')}
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t('salesReport.analytics')}</h2>
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">{t('salesReport.branchSales')}</h3>
            <Bar
              data={branchSalesChartData}
              options={{
                responsive: true,
                plugins: { legend: { position: 'top' }, title: { display: true, text: t('salesReport.branchSales') } },
              }}
            />
          </Card>
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">{t('salesReport.productSales')}</h3>
            <Bar
              data={productSalesChartData}
              options={{
                responsive: true,
                plugins: { legend: { position: 'top' }, title: { display: true, text: t('salesReport.productSales') } },
              }}
            />
          </Card>
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">{t('salesReport.departmentSales')}</h3>
            <Bar
              data={departmentSalesChartData}
              options={{
                responsive: true,
                plugins: { legend: { position: 'top' }, title: { display: true, text: t('salesReport.departmentSales') } },
              }}
            />
          </Card>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t('salesReport.previousSales')}</h2>
        {loading ? (
          <LoadingSpinner size="lg" />
        ) : sales.length === 0 ? (
          <Card className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('salesReport.noSales')}</p>
          </Card>
        ) : (
          sales.map((sale) => (
            <Card key={sale._id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{sale.orderNumber} - {sale.branch.name}</h3>
                  <p className="text-sm text-gray-600">{t('salesReport.date')}: {sale.createdAt}</p>
                  <p className="text-sm text-gray-600">
                    {t('salesReport.total')}: {sale.totalAmount} {t('currency')}
                  </p>
                  {sale.notes && <p className="text-sm text-gray-500">{t('salesReport.notes')}: {sale.notes}</p>}
                  <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
                    {sale.items.map((item, index) => (
                      <li key={index}>
                        {item.productName} - {t('salesReport.quantity')}: {item.quantity} {t('units.kg')},{' '}
                        {t('salesReport.unitPrice')}: {item.unitPrice} {t('currency')}
                      </li>
                    ))}
                  </ul>
                  {sale.returns && sale.returns.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700">{t('salesReport.returns')}:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {sale.returns.map((ret, index) => (
                          <li key={index}>
                            {t('salesReport.return')} #{ret.returnNumber} ({t(`returns.status.${ret.status}`)}) -{' '}
                            {t('salesReport.reason')}: {ret.reason}
                            <ul className="list-circle list-inside ml-4">
                              {ret.items.map((item, i) => (
                                <li key={i}>
                                  {t('salesReport.quantity')}: {item.quantity} {t('units.kg')},{' '}
                                  {t('salesReport.reason')}: {item.reason}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
