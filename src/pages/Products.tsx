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
import { Package, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit: string;
  unitEn?: string;
  description?: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
}

const translations = {
  ar: {
    manage: 'إدارة المنتجات',
    add: 'إضافة منتج',
    addFirst: 'إضافة أول منتج',
    noProducts: 'لا توجد منتجات',
    noMatch: 'لا توجد منتجات مطابقة',
    empty: 'لا توجد منتجات متاحة',
    searchPlaceholder: 'ابحث عن المنتجات...',
    name: 'اسم المنتج (عربي)',
    nameEn: 'اسم المنتج (إنجليزي)',
    code: 'كود المنتج',
    department: 'القسم',
    price: 'السعر',
    unit: 'الوحدة',
    description: 'الوصف',
    noDepartment: 'لا يوجد قسم',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل اسم المنتج بالإنجليزية',
    codePlaceholder: 'أدخل كود المنتج',
    selectDepartment: 'اختر القسم',
    pricePlaceholder: 'أدخل السعر',
    unitPlaceholder: 'اختر الوحدة',
    descriptionPlaceholder: 'أدخل الوصف',
    edit: 'تعديل المنتج',
    saveError: 'خطأ في حفظ المنتج',
    delete: 'حذف',
    deleteConfirm: 'هل أنت متأكد من حذف هذا المنتج؟',
    deleteError: 'خطأ في الحذف',
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    units: {
      kilo: 'كيلو',
      piece: 'قطعة',
      pack: 'علبة',
      tray: 'صينية',
    },
  },
  en: {
    manage: 'Manage Products',
    add: 'Add Product',
    addFirst: 'Add First Product',
    noProducts: 'No Products Found',
    noMatch: 'No Matching Products',
    empty: 'No Products Available',
    searchPlaceholder: 'Search products...',
    name: 'Product Name (Arabic)',
    nameEn: 'Product Name (English)',
    code: 'Product Code',
    department: 'Department',
    price: 'Price',
    unit: 'Unit',
    description: 'Description',
    noDepartment: 'No Department',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter product name in English',
    codePlaceholder: 'Enter product code',
    selectDepartment: 'Select department',
    pricePlaceholder: 'Enter price',
    unitPlaceholder: 'Select unit',
    descriptionPlaceholder: 'Enter description',
    edit: 'Edit Product',
    saveError: 'Error saving product',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this product?',
    deleteError: 'Error deleting product',
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    units: {
      kilo: 'Kilo',
      piece: 'Piece',
      pack: 'Pack',
      tray: 'Tray',
    },
  },
};

export function Products() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: 'قطعة',
    unitEn: 'Piece',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t.unauthorized);
        setLoading(false);
        toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching products with params:', { filterDepartment, searchTerm, isRtl });
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, limit: 100, isRtl }).catch((err) => {
            console.error('Products API error:', err);
            throw err;
          }),
          departmentAPI.getAll({ isRtl }).catch((err) => {
            console.error('Departments API error:', err);
            throw err;
          }),
        ]);
        console.log('Products response:', productsResponse);
        console.log('Departments response:', departmentsResponse);

        const departmentsArray = Array.isArray(departmentsResponse.data) ? departmentsResponse.data : [];
        setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
        setDepartments(departmentsArray);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        console.error('Error details:', {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        });
        setError(err.response?.data?.message || t.fetchError);
        toast.error(err.response?.data?.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, filterDepartment, searchTerm, isRtl]);

  const filteredProducts = products.filter(
    (product) =>
      ((isRtl ? product.name : product.nameEn || product.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterDepartment === '' || product.department._id === filterDepartment)
  );

  const openModal = (product?: Product) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
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
        unitEn: product.unitEn || t.units[product.unit === 'كيلو' ? 'kilo' : product.unit === 'قطعة' ? 'piece' : product.unit === 'علبة' ? 'pack' : 'tray'],
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
        unit: 'قطعة',
        unitEn: 'Piece',
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
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: formData.code.trim(),
        department: formData.department,
        price: parseFloat(formData.price),
        unit: formData.unit,
        unitEn: formData.unitEn,
        description: formData.description.trim() || undefined,
      };
      console.log('Submitting product:', productData);
      if (editingProduct) {
        const updatedProduct = await productsAPI.update(editingProduct._id, productData);
        setProducts(
          products.map((p) =>
            p._id === editingProduct._id ? { ...updatedProduct, department: departments.find((d) => d._id === formData.department)! } : p
          )
        );
        toast.success(t.edit, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newProduct = await productsAPI.create(productData);
        setProducts([...products, { ...newProduct, department: departments.find((d) => d._id === formData.department)! }]);
        toast.success(t.add, { position: isRtl ? 'top-right' : 'top-left' });
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || t.saveError);
      toast.error(err.response?.data?.message || t.saveError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (confirm(t.deleteConfirm)) {
      try {
        await productsAPI.delete(id);
        setProducts(products.filter((p) => p._id !== id));
        toast.success(t.delete, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.response?.data?.message || t.deleteError);
        toast.error(err.response?.data?.message || t.deleteError, { position: isRtl ? 'top-right' : 'top-left' });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-100" dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <Package className="w-6 h-6 text-amber-600" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 shadow-md transition-transform transform hover:scale-105"
          >
            {t.add}
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
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5`} />
            <Input
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t.searchPlaceholder}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t.searchPlaceholder}
            />
          </div>
          <Select
            label={t.department}
            options={[{ value: '', label: t.selectDepartment }, ...(Array.isArray(departments) ? departments.map((d) => ({ value: d._id, label: isRtl ? d.name : d.nameEn || d.name })) : [])]}
            value={filterDepartment}
            onChange={setFilterDepartment}
            className="border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t.department}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <Card key={product._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4">
              <h3 className="font-medium text-gray-800">{isRtl ? product.name : product.nameEn || product.name}</h3>
              <p className="text-sm text-gray-500">{t.code}: {product.code}</p>
              <p className="text-sm text-blue-500">{isRtl ? product.department?.name : product.department?.nameEn || product.department?.name || t.noDepartment}</p>
              <p className="text-sm text-gray-500">{t.unit}: {isRtl ? product.unit : product.unitEn || t.units[product.unit === 'كيلو' ? 'kilo' : product.unit === 'قطعة' ? 'piece' : product.unit === 'علبة' ? 'pack' : 'tray']}</p>
              {product.description && <p className="text-xs text-gray-400 mt-1">{product.description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-semibold text-gray-800">{product.price} {t.currency}</span>
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(product)}
                      className="text-blue-500 hover:text-blue-700"
                      title={t.edit}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product._id)}
                      className="text-red-500 hover:text-red-700"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="p-6 text-center bg-white rounded-md shadow-sm">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-800">{t.noProducts}</h3>
          <p className="text-gray-500">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
          {user?.role === 'admin' && !searchTerm && !filterDepartment && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => openModal()}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
            >
              {t.addFirst}
            </Button>
          )}
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? t.edit : t.add}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={t.name}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t.namePlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.nameEn}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t.nameEnPlaceholder}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.code}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t.codePlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t.department}
              options={[{ value: '', label: t.selectDepartment }, ...(Array.isArray(departments) ? departments.map((d) => ({ value: d._id, label: isRtl ? d.name : d.nameEn || d.name })) : [])]}
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.price}
              type="number"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              placeholder={t.pricePlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t.unit}
              options={[
                { value: 'كيلو', label: t.units.kilo },
                { value: 'قطعة', label: t.units.piece },
                { value: 'علبة', label: t.units.pack },
                { value: 'صينية', label: t.units.tray },
              ]}
              value={formData.unit}
              onChange={(value) => {
                const unitEnMap: { [key: string]: string } = {
                  'كيلو': 'Kilo',
                  'قطعة': 'Piece',
                  'علبة': 'Pack',
                  'صينية': 'Tray',
                };
                setFormData({ ...formData, unit: value, unitEn: unitEnMap[value] });
              }}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.description}
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder={t.descriptionPlaceholder}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600">{error}</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
            >
              {editingProduct ? t.edit : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}