import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X, ChevronDown } from 'lucide-react';
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
  image?: string;
  displayName: string;
  displayUnit: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
}

const unitOptions = [
  { value: 'كيلو', valueEn: 'Kilo', labelAr: 'كيلو', labelEn: 'Kilo' },
  { value: 'قطعة', valueEn: 'Piece', labelAr: 'قطعة', labelEn: 'Piece' },
  { value: 'علبة', valueEn: 'Pack', labelAr: 'علبة', labelEn: 'Pack' },
  { value: 'صينية', valueEn: 'Tray', labelAr: 'صينية', labelEn: 'Tray' },
];

export function Products() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  useEffect(() => {
    if (!user || !['admin'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, limit: 0 }),
          departmentAPI.getAll({ limit: 100 }),
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
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, user, filterDepartment, searchTerm]);

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
        unit: product.unit || 'كيلو',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        department: departments[0]?._id || '',
        price: '',
        unit: 'كيلو',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setError('');
  };

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(isRtl ? 'اسم المنتج مطلوب' : 'Product name is required');
      return;
    }
    if (!formData.code.trim()) {
      setError(isRtl ? 'رمز المنتج مطلوب' : 'Product code is required');
      return;
    }
    if (!formData.department) {
      setError(isRtl ? 'القسم مطلوب' : 'Department is required');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError(isRtl ? 'السعر يجب أن يكون رقم إيجابي' : 'Price must be a positive number');
      return;
    }
    try {
      const productData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: formData.code.trim(),
        department: formData.department,
        price: priceNum,
        unit: formData.unit || undefined,
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
        toast.success(isRtl ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
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
        toast.success(isRtl ? 'تم إنشاء المنتج بنجاح' : 'Product created successfully');
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || (isRtl ? 'خطأ في حفظ المنتج' : 'Error saving product'));
      toast.error(err.response?.data?.message || (isRtl ? 'خطأ في حفظ المنتج' : 'Error saving product'));
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
        toast.success(isRtl ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully');
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'));
        toast.error(err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'));
      }
    }
  };

  const CustomInput = ({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; ariaLabel: string }) => (
    <div className="relative group">
      <Search className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500 ${isRtl ? 'right-3' : 'left-3'}`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs placeholder-gray-400 ${isRtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => {
            setSearchInput('');
            setSearchTerm('');
          }}
          className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors ${isRtl ? 'left-3' : 'right-3'}`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const CustomSelect = ({ value, onChange, children, ariaLabel }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; ariaLabel: string }) => (
    <div className="relative group">
      <select
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm appearance-none text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      >
        {children}
      </select>
      <ChevronDown className={`absolute top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors ${isRtl ? 'left-3' : 'right-3'}`} />
    </div>
  );

  return (
    <div className="mx-auto px-4 py-6 min-h-screen overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isRtl ? 'إدارة المنتجات' : 'Manage Products'}</h1>
            <p className="text-gray-600 text-xs">
              {isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}
            </p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => openModal()}
            className="w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            aria-label={isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          >
            <Plus className="w-3.5 h-3.5" />
            {isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs">{error}</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomInput
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                debouncedSearch(e.target.value);
              }}
              placeholder={isRtl ? 'ابحث عن المنتجات...' : 'Search products...'}
              ariaLabel={isRtl ? 'ابحث عن المنتجات' : 'Search products'}
            />
            <CustomSelect
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
            >
              <option value="">{isRtl ? 'كل الأقسام' : 'All Departments'}</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {isRtl ? d.name : (d.nameEn || d.name)}
                </option>
              ))}
            </CustomSelect>
          </div>
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد المنتجات: ${products.length}` : `Products Count: ${products.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl shadow-sm">
            <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-xs">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            {user?.role === 'admin' && !searchTerm && !filterDepartment && (
              <button
                onClick={() => openModal()}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                aria-label={isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              >
                {isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((product) => (
              <div
                key={product._id}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {product.displayName}
                    </h3>
                    <p className="text-xs text-gray-500">{product.code}</p>
                  </div>
                  <p className="text-xs text-amber-600">
                    {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                  </p>
                  <p className="font-semibold text-gray-900 text-xs">
                    {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                  </p>
                </div>
                {user?.role === 'admin' && (
                  <div className="mt-3 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openModal(product)}
                      className="p-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={isRtl ? 'تعديل' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product._id)}
                      className="p-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={isRtl ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {editingProduct ? (isRtl ? 'تعديل المنتج' : 'Edit Product') : (isRtl ? 'إضافة منتج جديد' : 'Add New Product')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'اسم المنتج' : 'Product Name'}
                  </label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isRtl ? 'أدخل اسم المنتج' : 'Enter product name'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الاسم بالإنجليزية' : 'English Name'}
                  </label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={isRtl ? 'أدخل الاسم بالإنجليزية' : 'Enter English name'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'رمز المنتج' : 'Product Code'}
                  </label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={isRtl ? 'أدخل رمز المنتج' : 'Enter product code'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'القسم' : 'Department'}
                  </label>
                  <div className="relative group">
                    <select
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm appearance-none text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
                    >
                      <option value="">{isRtl ? 'اختر القسم' : 'Select Department'}</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {isRtl ? d.name : (d.nameEn || d.name)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className={`absolute top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors ${isRtl ? 'left-3' : 'right-3'}`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="price" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'السعر' : 'Price'}
                  </label>
                  <input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الوحدة' : 'Unit'}
                  </label>
                  <div className="relative group">
                    <select
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm appearance-none text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
                    >
                      {unitOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {isRtl ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className={`absolute top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors ${isRtl ? 'left-3' : 'right-3'}`}
                    />
                  </div>
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors"
                  aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
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