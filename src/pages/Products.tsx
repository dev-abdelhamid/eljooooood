import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X } from 'lucide-react';
import { toast } from 'react-toastify';
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

interface Toast {
  message: string;
  type: 'success' | 'error';
}

const unitOptions = [
  { value: 'كيلو', valueEn: 'Kilo', labelAr: 'كيلو', labelEn: 'Kilo' },
  { value: 'قطعة', valueEn: 'Piece', labelAr: 'قطعة', labelEn: 'Piece' },
  { value: 'علبة', valueEn: 'Pack', labelAr: 'علبة', labelEn: 'Pack' },
  { value: 'صينية', valueEn: 'Tray', labelAr: 'صينية', labelEn: 'Tray' },
  { value: '', valueEn: '', labelAr: 'غير محدد', labelEn: 'None' },
];

export function Products() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState({ products: false, departments: false });
  const [toastState, setToastState] = useState<Toast | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
    description: '',
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  useEffect(() => {
    if (!user || !['admin'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      setLoading({ products: false, departments: false });
      return;
    }

    const fetchData = async () => {
      try {
        setLoading({ products: true, departments: true });
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm }).finally(() =>
            setLoading((prev) => ({ ...prev, products: false }))
          ),
          departmentAPI.getAll({ limit: 100 }).finally(() => setLoading((prev) => ({ ...prev, departments: false }))),
        ]);

        const productsWithDisplay = productsResponse.data.map((product: Product) => ({
          ...product,
          displayName: isRtl ? product.name : (product.nameEn || product.name),
          displayUnit: isRtl ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
        }));
        setProducts(productsWithDisplay);
        setDepartments(departmentsResponse.data);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
      }
    };
    fetchData();
  }, [isRtl, user, filterDepartment, searchTerm]);

  useEffect(() => {
    if (toastState) {
      toast[toastState.type](toastState.message, { autoClose: 3000 });
      setTimeout(() => setToastState(null), 3000);
    }
  }, [toastState]);

  const openModal = (product?: Product) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
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
      if (editingProduct) {
        const updatedProduct = await productsAPI.update(editingProduct._id, productData);
        setProducts(
          products.map((p) =>
            p._id === editingProduct._id
              ? {
                  ...updatedProduct,
                  displayName: isRtl ? updatedProduct.name : (updatedProduct.nameEn || updatedProduct.name),
                  displayUnit: isRtl ? (updatedProduct.unit || 'غير محدد') : (updatedProduct.unitEn || updatedProduct.unit || 'N/A'),
                }
              : p
          )
        );
        setToastState({ message: isRtl ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully', type: 'success' });
      } else {
        const newProduct = await productsAPI.create(productData);
        setProducts([
          ...products,
          {
            ...newProduct,
            displayName: isRtl ? newProduct.name : (newProduct.nameEn || newProduct.name),
            displayUnit: isRtl ? (newProduct.unit || 'غير محدد') : (newProduct.unitEn || newProduct.unit || 'N/A'),
          },
        ]);
        setToastState({ message: isRtl ? 'تم إنشاء المنتج بنجاح' : 'Product created successfully', type: 'success' });
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || (isRtl ? 'خطأ في حفظ المنتج' : 'Error saving product'));
      setToastState({ message: err.response?.data?.message || (isRtl ? 'خطأ في حفظ المنتج' : 'Error saving product'), type: 'error' });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      return;
    }
    if (confirm(isRtl ? 'هل أنت متأكد من حذف المنتج؟' : 'Are you sure you want to delete this product?')) {
      try {
        await productsAPI.delete(id);
        setProducts(products.filter((p) => p._id !== id));
        setToastState({ message: isRtl ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully', type: 'success' });
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'));
        setToastState({ message: err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'), type: 'error' });
      }
    }
  };

  if (loading.departments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-8 min-h-screen h-screen overflow-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {toastState && (
        <div
          className={`fixed top-4 ${isRtl ? 'right-4' : 'left-4'} z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
            toastState.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{toastState.message}</span>
            <button
              onClick={() => setToastState(null)}
              aria-label={isRtl ? 'إغلاق' : 'Close'}
              className="hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {isRtl ? 'إدارة المنتجات' : 'Manage Products'}
        </h1>
        <p className="text-gray-600 mt-2 text-sm">
          {isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="p-6 bg-white rounded-2xl shadow-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={isRtl ? 'ابحث عن المنتجات...' : 'Search products...'}
                onChange={(e) => debouncedSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                aria-label={isRtl ? 'ابحث عن المنتجات' : 'Search products'}
              />
            </div>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
              aria-label={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
            >
              <option value="">{isRtl ? 'كل الأقسام' : 'All Departments'}</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {isRtl ? d.name : (d.nameEn || d.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {isRtl ? `عدد المنتجات: ${products.length}` : `Products Count: ${products.length}`}
          </div>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-sm transition-colors flex items-center justify-center gap-2"
            aria-label={isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          </button>
        )}

        {loading.products ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="p-5 bg-white rounded-xl shadow-sm">
                <div className="space-y-3 animate-pulse">
                  <div className="h-40 bg-gray-200 rounded-t-xl"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl shadow-md">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            {user?.role === 'admin' && !searchTerm && !filterDepartment && (
              <button
                onClick={() => openModal()}
                className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-sm transition-colors"
                aria-label={isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              >
                {isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product._id}
                className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200"
              >
                <div className="space-y-3">
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
                          title={isRtl ? 'تعديل' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product._id)}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                          title={isRtl ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-gray-900 text-base truncate">
                      {product.displayName}
                    </h3>
                    <p className="text-xs text-gray-500">{product.code}</p>
                  </div>
                  <p className="text-sm text-amber-600">
                    {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                  </p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                  </p>
                  {product.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{product.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingProduct ? (isRtl ? 'تعديل المنتج' : 'Edit Product') : (isRtl ? 'إضافة منتج جديد' : 'Add New Product')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'اسم المنتج' : 'Product Name'}
                  </label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isRtl ? 'أدخل اسم المنتج' : 'Enter product name'}
                    required
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'الاسم بالإنجليزية' : 'English Name'}
                  </label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={isRtl ? 'أدخل الاسم بالإنجليزية' : 'Enter English name'}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'رمز المنتج' : 'Product Code'}
                  </label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={isRtl ? 'أدخل رمز المنتج' : 'Enter product code'}
                    required
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'القسم' : 'Department'}
                  </label>
                  <select
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  >
                    <option value="">{isRtl ? 'اختر القسم' : 'Select Department'}</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {isRtl ? d.name : (d.nameEn || d.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'السعر' : 'Price'}
                  </label>
                  <input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'الوحدة' : 'Unit'}
                  </label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isRtl ? opt.labelAr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isRtl ? 'أدخل وصف المنتج...' : 'Enter product description...'}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y text-sm"
                  rows={4}
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors text-sm"
                  aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors text-sm"
                  aria-label={editingProduct ? (isRtl ? 'تحديث المنتج' : 'Update Product') : (isRtl ? 'إضافة المنتج' : 'Add Product')}
                >
                  {editingProduct ? (isRtl ? 'تحديث المنتج' : 'Update Product') : (isRtl ? 'إضافة المنتج' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}