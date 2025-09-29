import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomDropdown } from '../components/UI/CustomDropdown';

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

const translations = {
  ar: {
    manage: 'إدارة المنتجات',
    add: 'إضافة منتج جديد',
    addFirst: 'إضافة أول منتج',
    empty: 'لا توجد منتجات متاحة',
    noMatch: 'لا توجد منتجات مطابقة',
    searchPlaceholder: 'ابحث عن المنتجات...',
    filterDepartment: 'تصفية حسب القسم',
    allDepartments: 'كل الأقسام',
    name: 'اسم المنتج',
    nameEn: 'الاسم بالإنجليزية',
    code: 'رمز المنتج',
    department: 'القسم',
    price: 'السعر',
    unit: 'الوحدة',
    edit: 'تعديل',
    delete: 'حذف',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل الاسم بالإنجليزية',
    codePlaceholder: 'أدخل رمز المنتج',
    pricePlaceholder: 'أدخل السعر',
    unitPlaceholder: 'اختر الوحدة',
    departmentPlaceholder: 'اختر القسم',
    update: 'تحديث المنتج',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    invalidUnit: 'الوحدة غير صالحة، اختر من القائمة',
    invalidPrice: 'السعر يجب أن يكون رقمًا إيجابيًا',
    unauthorized: 'غير مصرح',
    fetchError: 'خطأ في جلب البيانات',
    saveError: 'خطأ في حفظ المنتج',
    deleteError: 'خطأ في حذف المنتج',
    added: 'تم إنشاء المنتج بنجاح',
    updated: 'تم تحديث المنتج بنجاح',
    deleted: 'تم حذف المنتج بنجاح',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا المنتج؟',
    cancel: 'إلغاء',
  },
  en: {
    manage: 'Manage Products',
    add: 'Add New Product',
    addFirst: 'Add First Product',
    empty: 'No products available',
    noMatch: 'No matching products',
    searchPlaceholder: 'Search products...',
    filterDepartment: 'Filter by department',
    allDepartments: 'All Departments',
    name: 'Product Name',
    nameEn: 'English Name',
    code: 'Product Code',
    department: 'Department',
    price: 'Price',
    unit: 'Unit',
    edit: 'Edit',
    delete: 'Delete',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter English name',
    codePlaceholder: 'Enter product code',
    pricePlaceholder: 'Enter price',
    unitPlaceholder: 'Select Unit',
    departmentPlaceholder: 'Select Department',
    update: 'Update Product',
    requiredFields: 'Please fill all required fields',
    invalidUnit: 'Invalid unit, please select from the list',
    invalidPrice: 'Price must be a positive number',
    unauthorized: 'Unauthorized',
    fetchError: 'Error fetching data',
    saveError: 'Error saving product',
    deleteError: 'Error deleting product',
    added: 'Product created successfully',
    updated: 'Product updated successfully',
    deleted: 'Product deleted successfully',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this product?',
    cancel: 'Cancel',
  },
};

const unitOptions = [
  { value: 'كيلو', valueEn: 'Kilo', labelAr: 'كيلو', labelEn: 'Kilo' },
  { value: 'قطعة', valueEn: 'Piece', labelAr: 'قطعة', labelEn: 'Piece' },
  { value: 'علبة', valueEn: 'Pack', labelAr: 'علبة', labelEn: 'Pack' },
  { value: 'صينية', valueEn: 'Tray', labelAr: 'صينية', labelEn: 'Tray' },
];

const CustomInput = React.memo(
  ({
    value,
    onChange,
    placeholder,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
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
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-600 dark:text-gray-500 dark:group-focus-within:text-amber-400`}
        >
          <Search className="w-5 h-5" />
        </motion.div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3'} py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`}
          aria-label={ariaLabel}
        />
        <motion.div
          initial={{ opacity: value ? 1 : 0 }}
          animate={{ opacity: value ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:text-amber-400 transition-colors`}
        >
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
            className="flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    );
  }
);

export function Products() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
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
        setError(err.response?.data?.message || t.fetchError);
        toast.error(err.response?.data?.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, user, filterDepartment, searchTerm, t]);

  const openModal = (product?: Product) => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
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
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setError('');
    setFormErrors({});
  };

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.requiredFields;
    if (!formData.code) errors.code = t.requiredFields;
    if (!formData.department) errors.department = t.requiredFields;
    if (!formData.price) {
      errors.price = t.requiredFields;
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      errors.price = t.invalidPrice;
    }
    if (formData.unit && !unitOptions.some((opt) => opt.value === formData.unit)) {
      errors.unit = t.invalidUnit;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      return;
    }
    try {
      const productData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn?.trim() || undefined,
        code: formData.code.trim(),
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
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
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
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      const errorMessage = err.response?.data?.message || t.saveError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
    }
  };

  const openDeleteModal = (id: string) => {
    setDeletingProductId(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingProductId(null);
    setError('');
  };

  const confirmDelete = async () => {
    if (!deletingProductId) return;
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      return;
    }
    try {
      await productsAPI.delete(deletingProductId);
      setProducts(products.filter((p) => p._id !== deletingProductId));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      closeDeleteModal();
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
    }
  };

  return (
    <div
      className="mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 bg-gray-50 dark:bg-gray-900"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-4 shadow-sm bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl"
      >
        <div className="flex items-center flex-col sm:flex-row gap-3">
          <Package className="w-8 h-8 text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/50 p-2 rounded-full" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{t.manage}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}</p>
          </div>
        </div>
        {['admin', 'production'].includes(user?.role ?? '') && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            aria-label={t.add}
          >
            <Plus className="w-5 h-5" />
            {t.add}
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomInput
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                debouncedSearch(value);
              }}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
            <CustomDropdown
              value={filterDepartment}
              onChange={setFilterDepartment}
              options={[
                { value: '', label: t.allDepartments },
                ...departments.map((d) => ({
                  value: d._id,
                  label: isRtl ? d.name : (d.nameEn || d.name),
                })),
              ]}
              ariaLabel={t.filterDepartment}
            />
          </div>
        </div>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {isRtl ? `عدد المنتجات: ${products.length}` : `Products Count: ${products.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 sm:p-8 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Package className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
            {['admin', 'production'].includes(user?.role ?? '') && !searchTerm && !filterDepartment && (
              <button
                onClick={() => openModal()}
                className="mt-4 px-4 sm:px-6 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {products.map((product) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="p-5 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700 max-w-sm mx-auto group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 to-amber-200/50 dark:from-amber-900/50 dark:to-amber-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg truncate" style={{ whiteSpace: 'nowrap' }}>
                        {product.displayName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{product.code}</p>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                    </p>
                  </div>
                  {['admin', 'production'].includes(user?.role ?? '') && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(product);
                        }}
                        className="p-2 w-10 h-10 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        title={t.edit}
                        aria-label={t.edit}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(product._id);
                        }}
                        className="p-2 w-10 h-10 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        title={t.delete}
                        aria-label={t.delete}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-lg p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{editingProduct ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.name}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.name ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`}
                    aria-invalid={!!formErrors.name}
                    aria-describedby={formErrors.name ? 'name-error' : undefined}
                  />
                  {formErrors.name && <p id="name-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`}
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.code}</label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={t.codePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.code ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`}
                    aria-invalid={!!formErrors.code}
                    aria-describedby={formErrors.code ? 'code-error' : undefined}
                  />
                  {formErrors.code && <p id="code-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.code}</p>}
                </div>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.department}</label>
                  <CustomDropdown
                    value={formData.department}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    options={[
                      { value: '', label: t.departmentPlaceholder },
                      ...departments.map((d) => ({
                        value: d._id,
                        label: isRtl ? d.name : (d.nameEn || d.name),
                      })),
                    ]}
                    ariaLabel={t.department}
                    className={formErrors.department ? 'border-red-300 dark:border-red-700' : ''}
                  />
                  {formErrors.department && <p id="department-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.department}</p>}
                </div>
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.price}</label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder={t.pricePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.price ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600`}
                    aria-invalid={!!formErrors.price}
                    aria-describedby={formErrors.price ? 'price-error' : undefined}
                  />
                  {formErrors.price && <p id="price-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.price}</p>}
                </div>
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.unit}</label>
                  <CustomDropdown
                    value={formData.unit}
                    onChange={(value) => setFormData({ ...formData, unit: value })}
                    options={[
                      { value: '', label: t.unitPlaceholder },
                      ...unitOptions.map((opt) => ({
                        value: opt.value,
                        label: isRtl ? opt.labelAr : opt.labelEn,
                      })),
                    ]}
                    ariaLabel={t.unit}
                    className={formErrors.unit ? 'border-red-300 dark:border-red-700' : ''}
                  />
                  {formErrors.unit && <p id="unit-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.unit}</p>}
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 sm:px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-600"
                  aria-label={t.cancel}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-6 py-2.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                  aria-label={editingProduct ? t.update : t.add}
                >
                  {editingProduct ? t.update : t.add}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(esz) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.confirmDelete}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t.deleteWarning}</p>
            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                className="px-4 sm:px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-600"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 sm:px-6 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                aria-label={t.delete}
              >
                {t.delete}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
