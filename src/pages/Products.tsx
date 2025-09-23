
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit: 'كيلو' | 'قطعة' | 'علبة' | 'صينية';
  unitEn?: 'Kilo' | 'Piece' | 'Pack' | 'Tray';
  description?: string;
  image: string;
  displayName: string;
  displayUnit: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
}

const unitOptions = [
  { value: 'كيلو', label: 'كيلو', valueEn: 'Kilo' },
  { value: 'قطعة', label: 'قطعة', valueEn: 'Piece' },
  { value: 'علبة', label: 'علبة', valueEn: 'Pack' },
  { value: 'صينية', label: 'صينية', valueEn: 'Tray' },
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: 'قطعة' as Product['unit'],
    unitEn: 'Piece' as Product['unitEn'],
    description: '',
    image: 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('products.unauthorized'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching products with params:', { department: filterDepartment, search: searchTerm, page: currentPage });
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, page: currentPage, limit: 12 }),
          departmentAPI.getAll({ limit: 100 }),
        ]);
        console.log('Products response:', productsResponse);
        console.log('Departments response:', departmentsResponse);

        setProducts(productsResponse.data);
        setTotalPages(productsResponse.totalPages);
        setDepartments(departmentsResponse.data);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t('products.fetchError'));
      } finally {
        setLoading(false);
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
        unit: product.unit,
        unitEn: product.unitEn || unitOptions.find((opt) => opt.value === product.unit)?.valueEn || 'Piece',
        description: product.description || '',
        image: product.image,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        department: departments[0]?._id || '',
        price: '',
        unit: 'قطعة',
        unitEn: 'Piece',
        description: '',
        image: 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg',
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
        unit: formData.unit,
        unitEn: formData.unitEn || undefined,
        description: formData.description || undefined,
        image: formData.image,
      };
      console.log('Submitting product:', productData);
      if (editingProduct) {
        const updatedProduct = await productsAPI.update(editingProduct._id, productData);
        setProducts(
          products.map((p) =>
            p._id === editingProduct._id ? updatedProduct : p
          )
        );
      } else {
        const newProduct = await productsAPI.create(productData);
        setProducts([...products, newProduct]);
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || t('products.saveError'));
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
        setError(err.message || t('products.deleteError'));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
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
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {t('products.manage')}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 shadow-md transition-transform transform hover:scale-105"
          >
            {t('products.add')}
          </Button>
        )}
      </motion.div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <Card className="p-4 mb-6 bg-white rounded-md shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t('products.searchPlaceholder')}
              className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
              aria-label={t('products.searchPlaceholder')}
            />
          </div>
          <Select
            label={t('products.department')}
            options={[{ value: '', label: t('products.allDepartments') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
            value={filterDepartment}
            onChange={setFilterDepartment}
            className="border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t('products.department')}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-md shadow-sm">
            <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800">{t('products.noProducts')}</h3>
            <p className="text-gray-500">{searchTerm || filterDepartment ? t('products.noMatch') : t('products.empty')}</p>
            {user?.role === 'admin' && !searchTerm && !filterDepartment && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openModal()}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
              >
                {t('products.addFirst')}
              </Button>
            )}
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <img
                  src={product.image}
                  alt={product.displayName}
                  className="w-full h-32 object-cover rounded-md mb-3"
                />
                <h3 className="font-medium text-gray-800">{product.displayName}</h3>
                <p className="text-sm text-gray-500">{t('products.code')}: {product.code}</p>
                <p className="text-sm text-blue-500">
                  {t('products.department')}: {language === 'ar' ? product.department.name : (product.department.nameEn || product.department.name)}
                </p>
                <p className="text-sm text-gray-500">
                  {t('products.unit')}: {product.displayUnit}
                </p>
                {product.description && <p className="text-xs text-gray-400 mt-1">{product.description}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-semibold text-gray-800">{product.price} {t('products.currency')}</span>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(product)}
                        className="text-blue-500 hover:text-blue-700"
                        title={t('products.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product._id)}
                        className="text-red-500 hover:text-red-700"
                        title={t('products.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
          >
            {t('products.previous')}
          </Button>
          <span className="text-gray-600">
            {t('products.page')} {currentPage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            icon={ChevronRight}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
          >
            {t('products.next')}
          </Button>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? t('products.edit') : t('products.add')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={t('products.name')}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t('products.namePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.nameEn')}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t('products.nameEnPlaceholder')}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.code')}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t('products.codePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('products.department')}
              options={[{ value: '', label: t('products.selectDepartment') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.price')}
              type="number"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              placeholder="0.00"
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('products.unit')}
              options={unitOptions.map((opt) => ({
                value: opt.value,
                label: language === 'ar' ? opt.label : opt.valueEn,
              }))}
              value={formData.unit}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  unit: value as Product['unit'],
                  unitEn: unitOptions.find((opt) => opt.value === value)?.valueEn || 'Piece',
                })
              }
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.image')}
              value={formData.image}
              onChange={(value) => setFormData({ ...formData, image: value })}
              placeholder={t('products.imagePlaceholder')}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('products.descriptionPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
          </div>
          {error && (
            <div className="p-2 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2">
              {editingProduct ? t('products.update') : t('products.add')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
