import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';
import { debounce } from 'lodash';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit?: string;
  unitEn?: string;
  description?: string;
  image?: string;
  displayName: string;
  displayUnit: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
}

// Unit mapping for frontend
const unitOptions = [
  { value: 'كيلو', valueEn: 'Kilo', labelAr: 'كيلو', labelEn: 'Kilo' },
  { value: 'قطعة', valueEn: 'Piece', labelAr: 'قطعة', labelEn: 'Piece' },
  { value: 'علبة', valueEn: 'Pack', labelAr: 'علبة', labelEn: 'Pack' },
  { value: 'صينية', valueEn: 'Tray', labelAr: 'صينية', labelEn: 'Tray' },
  { value: '', valueEn: '', labelAr: 'غير محدد', labelEn: 'None' },
];

export function Products() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
    description: '',
  });

  // Debounce للبحث
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
      setCurrentPage(1);
      setSearchLoading(false);
    }, 300),
    []
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('products.unauthorized'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching products with params:', { department: filterDepartment, search: searchTerm, page: currentPage, limit: 12 });
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, page: currentPage, limit: 12 }),
          departmentAPI.getAll({ limit: 100 }),
        ]);

        const productsWithDisplay = productsResponse.data.map((product: Product) => ({
          ...product,
          displayName: language === 'ar' ? product.name : (product.nameEn || product.name),
          displayUnit: language === 'ar' ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
        }));
        setProducts(productsWithDisplay);
        setTotalPages(productsResponse.totalPages);
        setDepartments(departmentsResponse.data);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.message || t('products.fetchError'));
      } finally {
        setLoading(false);
        setSearchLoading(false);
      }
    };
    fetchData();
  }, [t, user, filterDepartment, searchTerm, currentPage, language]);

  const filteredProducts = products.filter(
    (product) =>
      (product.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterDepartment === '' || product.department._id === filterDepartment)
  );

  const openModal = (product?: Product) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('products.unauthorized'));
      return;
    }
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        nameEn: product.nameEn || '',
        code: product.code,
        department: product.department._id,
        price: product.price.toString(),
        unit: product.unit || '',
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        department: departments[0]?._id || '',
        price: '',
        unit: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        department: formData.department,
        price: parseFloat(formData.price),
        unit: formData.unit || undefined,
        description: formData.description || undefined,
      };
      console.log('Submitting product:', productData);
      if (editingProduct) {
        const updatedProduct = await productsAPI.update(editingProduct._id, productData);
        setProducts(
          products.map((p) =>
            p._id === editingProduct._id
              ? {
                  ...updatedProduct,
                  displayName: language === 'ar' ? updatedProduct.name : (updatedProduct.nameEn || updatedProduct.name),
                  displayUnit: language === 'ar' ? (updatedProduct.unit || 'غير محدد') : (updatedProduct.unitEn || updatedProduct.unit || 'N/A'),
                }
              : p
          )
        );
      } else {
        const newProduct = await productsAPI.create(productData);
        setProducts([
          ...products,
          {
            ...newProduct,
            displayName: language === 'ar' ? newProduct.name : (newProduct.nameEn || newProduct.name),
            displayUnit: language === 'ar' ? (newProduct.unit || 'غير محدد') : (newProduct.unitEn || newProduct.unit || 'N/A'),
          },
        ]);
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || t('products.saveError'));
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('products.unauthorized'));
      return;
    }
    if (confirm(t('products.deleteConfirm'))) {
      try {
        await productsAPI.delete(id);
        setProducts(products.filter((p) => p._id !== id));
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.response?.data?.message || t('products.deleteError'));
      }
    }
  };

  // Skeleton Loading Component
  const SkeletonCard = () => (
    <div className="p-4 bg-white rounded-xl shadow-sm animate-pulse">
      <div className="h-40 bg-gray-200 rounded-lg mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {t('products.manage')}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 py-3 shadow-md transition-transform transform hover:scale-105"
          >
            {t('products.add')}
          </Button>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </motion.div>
      )}

      <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              onChange={(value) => {
                setSearchLoading(true);
                debouncedSearch(value);
              }}
              placeholder={t('products.searchPlaceholder')}
              className="pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              aria-label={t('products.searchPlaceholder')}
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>
          <Select
            label={t('products.department')}
            options={[{ value: '', label: t('products.allDepartments') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
            value={filterDepartment}
            onChange={setFilterDepartment}
            className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            aria-label={t('products.department')}
          />
        </div>
      </Card>

      <AnimatePresence>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <Card className="p-8 text-center bg-white rounded-xl shadow-md col-span-full">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">{t('products.noProducts')}</h3>
              <p className="text-gray-500">{searchTerm || filterDepartment ? t('products.noMatch') : t('products.empty')}</p>
              {user?.role === 'admin' && !searchTerm && !filterDepartment && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => openModal()}
                  className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 py-3"
                >
                  {t('products.addFirst')}
                </Button>
              )}
            </Card>
          ) : (
            filteredProducts.map((product) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <div className="relative">
                    <img
                      src={product.image || 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg'}
                      alt={product.displayName}
                      className="w-full h-40 object-cover rounded-t-xl"
                    />
                    {user?.role === 'admin' && (
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          onClick={() => openModal(product)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                          title={t('products.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product._id)}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                          title={t('products.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{product.displayName}</h3>
                    <p className="text-sm text-gray-500">{t('products.code')}: {product.code}</p>
                    <p className="text-sm text-amber-600">
                      {t('products.department')}: {language === 'ar' ? product.department.name : (product.department.nameEn || product.department.name)}
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{product.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        {product.price} {t('products.currency')} / {product.displayUnit}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </AnimatePresence>

      <div className="flex justify-center mt-8 gap-4">
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors"
        >
          {t('previous')}
        </Button>
        <span className="self-center text-sm font-medium text-gray-700">
          {t('page')} {currentPage} / {totalPages}
        </span>
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors"
        >
          {t('next')}
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? t('products.edit') : t('products.add')}
        size="md"
        className="rounded-2xl shadow-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('products.name')}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t('products.namePlaceholder')}
              required
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <Input
              label={t('products.nameEn')}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t('products.nameEnPlaceholder')}
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <Input
              label={t('products.code')}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t('products.codePlaceholder')}
              required
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <Select
              label={t('products.department')}
              options={[{ value: '', label: t('products.selectDepartment') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              required
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <Input
              label={t('products.price')}
              type="number"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              placeholder="0.00"
              required
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <Select
              label={t('products.unit')}
              options={unitOptions.map((opt) => ({
                value: opt.value,
                label: language === 'ar' ? opt.labelAr : opt.labelEn,
              }))}
              value={formData.unit}
              onChange={(value) => setFormData({ ...formData, unit: value })}
              className="border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('products.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('products.descriptionPlaceholder')}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors resize-y"
              rows={4}
            />
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600 text-sm">{error}</span>
            </motion.div>
          )}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors"
            >
              {editingProduct ? t('products.update') : t('products.add')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}