import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';


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

const CustomInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <motion.div
        initial={{ opacity: value ? 0 : 1 }}
        animate={{ opacity: value ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'}  flex items-center justify-center align-center  top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2  flex items-center justify-center align-center transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          className="flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

const CustomDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group" onClick={(e) => e.stopPropagation()}>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-300 z-20 max-h-48 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <motion.div
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
                whileHover={{ backgroundColor: '#fef3c7' }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function Products() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
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
    if (!user || !['admin', 'production'].includes(user.role)) {
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
        toast.error(err.response?.data?.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, user, filterDepartment, searchTerm]);

  const openModal = (product?: Product) => {
    if (!user || !['admin', 'production'].includes(user.role)) {
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
    try {
      const productData = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        department: formData.department,
        price: parseFloat(formData.price),
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

  const openDeleteModal = (id: string) => {
    setDeletingProductId(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingProductId(null);
  };

  const confirmDelete = async () => {
    if (!deletingProductId) return;
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      return;
    }
    try {
      await productsAPI.delete(deletingProductId);
      setProducts(products.filter((p) => p._id !== deletingProductId));
      toast.success(isRtl ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully');
      closeDeleteModal();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'));
      toast.error(err.response?.data?.message || (isRtl ? 'خطأ في حذف المنتج' : 'Error deleting product'));
    }
  };

  return (
    <div className="mx-auto px-4 py-6 min-h-screen overflow-y-auto scrollbar-none" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isRtl ? 'إدارة المنتجات' : 'Manage Products'}</h1>
            <p className="text-gray-600 text-xs">
              {isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}
            </p>
          </div>
        </div>
        {['admin', 'production'].includes(user?.role ?? '') && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
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
            <CustomDropdown
              value={filterDepartment}
              onChange={setFilterDepartment}
              options={[
                { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                ...departments.map((d) => ({
                  value: d._id,
                  label: isRtl ? d.name : (d.nameEn || d.name),
                })),
              ]}
              ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
            />
          </div>
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد المنتجات: ${products.length}` : `Products Count: ${products.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none">
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
            {['admin', 'production'].includes(user?.role ?? '') && !searchTerm && !filterDepartment && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none">
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
                {['admin', 'production'].includes(user?.role ?? '') && (
                  <div className="mt-3 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openModal(product)}
                      className="p-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={isRtl ? 'تعديل' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(product._id)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-5" onClick={(e) => e.stopPropagation()}>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'القسم' : 'Department'}
                  </label>
                  <CustomDropdown
                    value={formData.department}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    options={[
                      { value: '', label: isRtl ? 'اختر القسم' : 'Select Department' },
                      ...departments.map((d) => ({
                        value: d._id,
                        label: isRtl ? d.name : (d.nameEn || d.name),
                      })),
                    ]}
                    ariaLabel={isRtl ? 'القسم' : 'Department'}
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الوحدة' : 'Unit'}
                  </label>
                  <CustomDropdown
                    value={formData.unit}
                    onChange={(value) => setFormData({ ...formData, unit: value })}
                    options={unitOptions.map((opt) => ({
                      value: opt.value,
                      label: isRtl ? opt.labelAr : opt.labelEn,
                    }))}
                    ariaLabel={isRtl ? 'الوحدة' : 'Unit'}
                  />
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

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{isRtl ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
            <p className="text-xs text-gray-600 mb-4">{isRtl ? 'هل أنت متأكد من حذف هذا المنتج؟' : 'Are you sure you want to delete this product?'}</p>
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-xs">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors"
                aria-label={isRtl ? 'إلغاء' : 'Cancel'}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors"
                aria-label={isRtl ? 'حذف' : 'Delete'}
              >
                {isRtl ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}