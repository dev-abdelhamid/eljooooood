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
    }, 300), // Reduced debounce time for faster response
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
        toast.error(err.response?.data?.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
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
  }) => (
    <div className="relative group">
      <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500`} />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setSearchInput(e.target.value);
          onChange(e);
        }}
        placeholder={placeholder}
        className="w-full px-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm placeholder-gray-400"
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            setSearchInput('');
            setSearchTerm('');
          }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );

  const CustomSelect = ({
    value,
    onChange,
    children,
    ariaLabel,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: React.ReactNode;
    ariaLabel: string;
  }) => (
    <div className="relative group">
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg appearance-none text-sm text-gray-700 hover:scale-[1.02] transform"
        aria-label={ariaLabel}
      >
        {children}
      </select>
      <ChevronDown
        className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-5 h-5 transition-colors`}
      />
    </div>
  );

  return (
    <div className="mx-auto px-4 py-8 min-h-screen overflow-y-auto scrollbar-thin" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <Package className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isRtl ? 'إدارة المنتجات' : 'Manage Products'}</h1>
            <p className="text-gray-600 text-sm">
              {isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}
            </p>
          </div>
        </motion.div>
        {user?.role === 'admin' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            onClick={() => openModal()}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            aria-label={isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          >
            <Plus className="w-5 h-5" />
            {isRtl ? 'إضافة منتج جديد' : 'Add New Product'}
          </motion.button>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </motion.div>
      )}

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </motion.div>
        <div className="text-center text-sm text-gray-600">
          {isRtl ? `عدد المنتجات: ${products.length}` : `Products Count: ${products.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="p-5 bg-white rounded-xl shadow-md">
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-8 text-center bg-white rounded-xl shadow-lg"
          >
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            {user?.role === 'admin' && !searchTerm && !filterDepartment && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openModal()}
                className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-all duration-300"
                aria-label={isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              >
                {isRtl ? 'إضافة أول منتج' : 'Add First Product'}
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence>
              {products.map((product, index) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="p-5 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between border border-gray-100 hover:border-amber-200"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                        {product.displayName}
                      </h3>
                      <p className="text-sm text-gray-500">{product.code}</p>
                    </div>
                    <p className="text-sm text-amber-600">
                      {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                    </p>
                    <p className="font-semibold text-gray-900 text-sm">
                      {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openModal(product)}
                        className="p-2 w-9 h-9 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={isRtl ? 'تعديل' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => deleteProduct(product._id)}
                        className="p-2 w-9 h-9 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={isRtl ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-2xl max-w-full w-[95vw] sm:max-w-lg p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {editingProduct ? (isRtl ? 'تعديل المنتج' : 'Edit Product') : (isRtl ? 'إضافة منتج جديد' : 'Add New Product')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                      {isRtl ? 'القسم' : 'Department'}
                    </label>
                    <div className="relative group">
                      <select
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg appearance-none text-sm text-gray-700 hover:scale-[1.02] transform"
                      >
                        <option value="">{isRtl ? 'اختر القسم' : 'Select Department'}</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {isRtl ? d.name : (d.nameEn || d.name)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-5 h-5 transition-colors`}
                      />
                    </div>
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                      {isRtl ? 'الوحدة' : 'Unit'}
                    </label>
                    <div className="relative group">
                      <select
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg appearance-none text-sm text-gray-700 hover:scale-[1.02] transform"
                      >
                        {unitOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {isRtl ? opt.labelAr : opt.labelEn}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-5 h-5 transition-colors`}
                      />
                    </div>
                  </div>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-600 text-sm">{error}</span>
                  </motion.div>
                )}
                <div className="flex justify-end gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-all duration-300"
                    aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-all duration-300"
                    aria-label={editingProduct ? (isRtl ? 'تحديث المنتج' : 'Update Product') : (isRtl ? 'إضافة المنتج' : 'Add Product')}
                  >
                    {editingProduct ? (isRtl ? 'تحديث المنتج' : 'Update Product') : (isRtl ? 'إضافة المنتج' : 'Add Product')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}