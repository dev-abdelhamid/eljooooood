import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { id: string; name: string; nameEn?: string; displayName: string };
  price: number;
  unit: string;
  unitEn?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  displayUnit: string;
}

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  displayName: string;
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
    unitEn: 'الوحدة (إنجليزي)',
    description: 'الوصف',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل اسم المنتج بالإنجليزية',
    codePlaceholder: 'أدخل كود المنتج',
    departmentPlaceholder: 'اختر القسم',
    pricePlaceholder: 'أدخل السعر',
    unitPlaceholder: 'اختر الوحدة',
    unitEnPlaceholder: 'أدخل الوحدة بالإنجليزية',
    descriptionPlaceholder: 'أدخل الوصف',
    edit: 'تعديل المنتج',
    update: 'تحديث',
    saveError: 'خطأ في حفظ المنتج',
    delete: 'حذف',
    deleteConfirm: 'هل أنت متأكد من حذف هذا المنتج؟',
    deleteError: 'خطأ في الحذف',
    deleted: 'تم الحذف بنجاح',
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    active: 'نشط',
    inactive: 'غير نشط',
    status: 'الحالة',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    cancel: 'إلغاء',
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
    unitEn: 'Unit (English)',
    description: 'Description',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter product name in English',
    codePlaceholder: 'Enter product code',
    departmentPlaceholder: 'Select department',
    pricePlaceholder: 'Enter price',
    unitPlaceholder: 'Select unit',
    unitEnPlaceholder: 'Enter unit in English',
    descriptionPlaceholder: 'Enter description',
    edit: 'Edit Product',
    update: 'Update',
    saveError: 'Error saving product',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this product?',
    deleteError: 'Error deleting',
    deleted: 'Deleted successfully',
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    active: 'Active',
    inactive: 'Inactive',
    status: 'Status',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    cancel: 'Cancel',
  },
};

const unitOptions = [
  { value: 'كيلو', label: 'كيلو', labelEn: 'Kilo' },
  { value: 'قطعة', label: 'قطعة', labelEn: 'Piece' },
  { value: 'علبة', label: 'علبة', labelEn: 'Pack' },
  { value: 'صينية', label: 'صينية', labelEn: 'Tray' },
];

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
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
    unitEn: '',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t.unauthorized);
        toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log(`[${new Date().toISOString()}] Fetching products with params:`, { searchTerm, department: selectedDepartment, isRtl });
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ search: searchTerm, department: selectedDepartment, isRtl }),
          departmentAPI.getAll({ isRtl }),
        ]);
        console.log(`[${new Date().toISOString()}] Products response:`, productsResponse);
        console.log(`[${new Date().toISOString()}] Departments response:`, departmentsResponse);

        const productsData = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data || [];
        const departmentsData = Array.isArray(departmentsResponse.data) ? departmentsResponse.data : departmentsResponse.data || [];

        setProducts(productsData.map((prod: any) => ({
          id: prod._id,
          name: prod.name,
          nameEn: prod.nameEn,
          code: prod.code,
          department: {
            id: prod.department._id,
            name: prod.department.name,
            nameEn: prod.department.nameEn,
            displayName: prod.department.displayName || (isRtl ? prod.department.name : prod.department.nameEn || prod.department.name),
          },
          price: prod.price,
          unit: prod.unit,
          unitEn: prod.unitEn,
          description: prod.description,
          isActive: prod.isActive,
          createdAt: prod.createdAt,
          updatedAt: prod.updatedAt,
          displayName: prod.displayName || (isRtl ? prod.name : prod.nameEn || prod.name),
          displayUnit: prod.displayUnit || (isRtl ? prod.unit : prod.unitEn || prod.unit),
        })));

        setDepartments(departmentsData.map((dept: any) => ({
          id: dept._id,
          name: dept.name,
          nameEn: dept.nameEn,
          code: dept.code,
          displayName: dept.displayName || (isRtl ? dept.name : dept.nameEn || dept.name),
        })));

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t.fetchError);
        toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, isRtl, searchTerm, selectedDepartment]);

  const filteredProducts = products.filter(
    (product) =>
      product.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase())
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
        department: product.department.id,
        price: product.price.toString(),
        unit: product.unit,
        unitEn: product.unitEn || '',
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        department: '',
        price: '',
        unit: '',
        unitEn: '',
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
        unitEn: formData.unitEn.trim() || undefined,
        description: formData.description.trim() || undefined,
      };
      console.log(`[${new Date().toISOString()}] Submitting product:`, productData);
      if (editingProduct) {
        const updatedProduct = await productsAPI.update(editingProduct.id, productData);
        setProducts(
          products.map((p) => (p.id === editingProduct.id ? {
            ...p,
            ...updatedProduct,
            id: updatedProduct._id,
            department: {
              id: updatedProduct.department._id,
              name: updatedProduct.department.name,
              nameEn: updatedProduct.department.nameEn,
              displayName: updatedProduct.department.displayName || (isRtl ? updatedProduct.department.name : updatedProduct.department.nameEn || updatedProduct.department.name),
            },
            createdAt: updatedProduct.createdAt,
            updatedAt: updatedProduct.updatedAt,
            displayName: updatedProduct.displayName || (isRtl ? updatedProduct.name : updatedProduct.nameEn || updatedProduct.name),
            displayUnit: updatedProduct.displayUnit || (isRtl ? updatedProduct.unit : updatedProduct.unitEn || updatedProduct.unit),
          } : p))
        );
        toast.success(t.update, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newProduct = await productsAPI.create(productData);
        setProducts([...products, {
          ...newProduct,
          id: newProduct._id,
          department: {
            id: newProduct.department._id,
            name: newProduct.department.name,
            nameEn: newProduct.department.nameEn,
            displayName: newProduct.department.displayName || (isRtl ? newProduct.department.name : newProduct.department.nameEn || newProduct.department.name),
          },
          createdAt: newProduct.createdAt,
          updatedAt: newProduct.updatedAt,
          displayName: newProduct.displayName || (isRtl ? newProduct.name : newProduct.nameEn || newProduct.name),
          displayUnit: newProduct.displayUnit || (isRtl ? newProduct.unit : newProduct.unitEn || newProduct.unit),
        }]);
        toast.success(t.add, { position: isRtl ? 'top-right' : 'top-left' });
      }
      closeModal();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Submit error:`, err);
      setError(err.message || t.saveError);
      toast.error(err.message || t.saveError, { position: isRtl ? 'top-right' : 'top-left' });
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
        setProducts(products.filter((p) => p.id !== id));
        toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Delete error:`, err);
        setError(err.message || t.deleteError);
        toast.error(err.message || t.deleteError, { position: isRtl ? 'top-right' : 'top-left' });
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
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-500" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
          >
            {t.add}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <Card className="p-4 mb-6 bg-white rounded-md shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              placeholder={t.searchPlaceholder}
              className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
              aria-label={t.searchPlaceholder}
            />
          </div>
          <Select
            label={t.department}
            value={selectedDepartment}
            onChange={(value) => setSelectedDepartment(value)}
            options={[
              { value: '', label: isRtl ? 'جميع الأقسام' : 'All Departments' },
              ...departments.map((dept) => ({
                value: dept.id,
                label: dept.displayName,
              })),
            ]}
            placeholder={t.departmentPlaceholder}
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-md shadow-sm">
            <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800">{t.noProducts}</h3>
            <p className="text-gray-500">{searchTerm || selectedDepartment ? t.noMatch : t.empty}</p>
            {user?.role === 'admin' && !searchTerm && !selectedDepartment && (
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
        ) : (
          filteredProducts.map((product) => (
            <Card key={product.id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <h3 className="font-medium text-gray-800">{product.displayName}</h3>
                <p className="text-sm text-gray-500">{t.code}: {product.code}</p>
                <p className="text-sm text-gray-500">{t.department}: {product.department.displayName}</p>
                <p className="text-sm text-gray-500">{t.price}: {product.price}</p>
                <p className="text-sm text-gray-500">{t.unit}: {product.displayUnit}</p>
                {product.description && <p className="text-xs text-gray-400 mt-1">{product.description}</p>}
                <p className="text-sm text-blue-500">
                  {t.status}: {product.isActive ? t.active : t.inactive}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t.createdAt}: {new Date(product.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t.updatedAt}: {new Date(product.updatedAt).toLocaleString()}
                </p>
                {user?.role === 'admin' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openModal(product)}
                      className="text-blue-500 hover:text-blue-700"
                      title={t.edit}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-500 hover:text-red-700"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? t.edit : t.add}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              options={departments.map((dept) => ({
                value: dept.id,
                label: dept.displayName,
              }))}
              placeholder={t.departmentPlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.price}
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              placeholder={t.pricePlaceholder}
              type="number"
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t.unit}
              value={formData.unit}
              onChange={(value) => setFormData({ ...formData, unit: value, unitEn: unitOptions.find((opt) => opt.value === value)?.labelEn || '' })}
              options={unitOptions.map((opt) => ({
                value: opt.value,
                label: isRtl ? opt.label : opt.labelEn,
              }))}
              placeholder={t.unitPlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.unitEn}
              value={formData.unitEn}
              onChange={(value) => setFormData({ ...formData, unitEn: value })}
              placeholder={t.unitEnPlaceholder}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t.descriptionPlaceholder}
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
              {editingProduct ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}