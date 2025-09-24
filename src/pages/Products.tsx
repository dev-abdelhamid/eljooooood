import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const translations = {
  ar: {
    manage: 'لوحة إدارة المنتجات',
    addProducts: 'إدارة المنتجات وإضافتها أو تعديلها',
    add: 'إضافة منتج',
    addFirst: 'إضافة أول منتج',
    noProducts: 'لا توجد منتجات',
    noMatch: 'لا توجد منتجات مطابقة',
    empty: 'لا توجد منتجات متاحة',
    searchPlaceholder: 'ابحث عن منتج بالاسم أو الكود...',
    code: 'الكود',
    department: 'القسم',
    price: 'السعر',
    unit: 'الوحدة',
    edit: 'تعديل',
    delete: 'حذف',
    name: 'اسم المنتج (عربي)',
    nameEn: 'اسم المنتج (إنجليزي)',
    nameRequired: 'اسم المنتج مطلوب',
    nameEnRequired: 'اسم المنتج بالإنجليزية مطلوب',
    codeRequired: 'كود المنتج مطلوب',
    departmentRequired: 'القسم مطلوب',
    priceRequired: 'السعر مطلوب',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل اسم المنتج بالإنجليزية',
    codePlaceholder: 'أدخل كود المنتج',
    departmentPlaceholder: 'اختر القسم',
    pricePlaceholder: 'أدخل السعر',
    unitPlaceholder: 'اختر الوحدة',
    update: 'تحديث المنتج',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    codeExists: 'الكود مستخدم بالفعل',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    updateError: 'خطأ أثناء تحديث المنتج',
    createError: 'خطأ أثناء إنشاء المنتج',
    added: 'تم إضافة المنتج بنجاح',
    updated: 'تم تحديث المنتج بنجاح',
    deleteWarning: 'هل أنت متأكد من حذف هذا المنتج؟',
    deleteError: 'خطأ أثناء حذف المنتج',
    deleted: 'تم حذف المنتج بنجاح',
    productCount: 'عدد المنتجات',
    cancel: 'إلغاء',
  },
  en: {
    manage: 'Product Management Dashboard',
    addProducts: 'Manage, add, or edit products',
    add: 'Add Product',
    addFirst: 'Add First Product',
    noProducts: 'No Products Found',
    noMatch: 'No Matching Products',
    empty: 'No Products Available',
    searchPlaceholder: 'Search by product name or code...',
    code: 'Code',
    department: 'Department',
    price: 'Price',
    unit: 'Unit',
    edit: 'Edit',
    delete: 'Delete',
    name: 'Product Name (Arabic)',
    nameEn: 'Product Name (English)',
    nameRequired: 'Product name is required',
    nameEnRequired: 'Product name in English is required',
    codeRequired: 'Product code is required',
    departmentRequired: 'Department is required',
    priceRequired: 'Price is required',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter product name in English',
    codePlaceholder: 'Enter product code',
    departmentPlaceholder: 'Select Department',
    pricePlaceholder: 'Enter price',
    unitPlaceholder: 'Select Unit',
    update: 'Update Product',
    requiredFields: 'Please fill all required fields',
    codeExists: 'Code is already in use',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    updateError: 'Error updating product',
    createError: 'Error creating product',
    added: 'Product added successfully',
    updated: 'Product updated successfully',
    deleteWarning: 'Are you sure you want to delete this product?',
    deleteError: 'Error deleting product',
    deleted: 'Product deleted successfully',
    productCount: 'Products Count',
    cancel: 'Cancel',
  },
};

const ProductInput = ({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  required = false,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  type?: string;
  required?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
      aria-label={ariaLabel}
    />
  );
};

const ProductSearchInput = ({
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500`}
      >
        <Search />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
};

const ProductDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  required?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <motion.div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
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

const ProductCard = ({ product, onEdit, onDelete }: {
  product: Product;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between border border-gray-100 hover:border-amber-200"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-base truncate">{product.displayName}</h3>
          <Package className="w-6 h-6 text-amber-600" />
        </div>
        <p className="text-sm text-gray-500">{t.code}: {product.code}</p>
        <p className="text-sm text-amber-600">{t.department}: {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.price}: {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}</p>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <motion.button
          onClick={onEdit}
          className="p-2 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
          title={t.edit}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Edit2 className="w-5 h-5" />
        </motion.button>
        <motion.button
          onClick={onDelete}
          className="p-2 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
          title={t.delete}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Trash2 className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const ProductSkeletonCard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    className="p-5 bg-white rounded-xl shadow-sm border border-gray-100"
  >
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end gap-2">
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  </motion.div>
);

const ProductModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingProduct,
  error,
  departments,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: { name: string; nameEn: string; code: string; department: string; price: string; unit: string };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; nameEn: string; code: string; department: string; price: string; unit: string }>>;
  editingProduct: Product | null;
  error: string;
  departments: Department[];
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white rounded-xl shadow-2xl max-w-full w-[95vw] sm:max-w-md p-8"
      >
        <h3 className="text-xl font-bold text-gray-900 mb-6">{editingProduct ? t.edit : t.add}</h3>
        <form onSubmit={onSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">{t.name}</label>
              <ProductInput
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.namePlaceholder}
                ariaLabel={t.name}
                required
              />
            </div>
            <div>
              <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 mb-1.5">{t.nameEn}</label>
              <ProductInput
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder={t.nameEnPlaceholder}
                ariaLabel={t.nameEn}
              />
            </div>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">{t.code}</label>
              <ProductInput
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t.codePlaceholder}
                ariaLabel={t.code}
                required
              />
            </div>
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1.5">{t.department}</label>
              <ProductDropdown
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
                required
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1.5">{t.price}</label>
              <ProductInput
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder={t.pricePlaceholder}
                ariaLabel={t.price}
                required
              />
            </div>
            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1.5">{t.unit}</label>
              <ProductDropdown
                value={formData.unit}
                onChange={(value) => setFormData({ ...formData, unit: value })}
                options={unitOptions.map((opt) => ({
                  value: opt.value,
                  label: isRtl ? opt.labelAr : opt.labelEn,
                }))}
                ariaLabel={t.unit}
              />
            </div>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600 text-sm">{error}</span>
            </motion.div>
          )}
          <div className="flex justify-end gap-3">
            <motion.button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
              aria-label={t.cancel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t.cancel}
            </motion.button>
            <motion.button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
              aria-label={editingProduct ? t.update : t.add}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {editingProduct ? t.update : t.add}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export function Products() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const t = translations[isRtl ? 'ar' : 'en'];
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
      setSearchTerm(value.trim());
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const filteredProducts = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return products
      .filter((product) => {
        const name = (isRtl ? product.name : product.nameEn || product.name).toLowerCase();
        const code = product.code.toLowerCase();
        return (
          (filterDepartment ? product.department._id === filterDepartment : true) &&
          (name.startsWith(lowerSearchTerm) || code.startsWith(lowerSearchTerm) || name.includes(lowerSearchTerm))
        );
      })
      .sort((a, b) => {
        const aName = (isRtl ? a.name : a.nameEn || a.name).toLowerCase();
        const bName = (isRtl ? b.name : b.nameEn || b.name).toLowerCase();
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        if (aName.startsWith(lowerSearchTerm) && !bName.startsWith(lowerSearchTerm)) return -1;
        if (!aName.startsWith(lowerSearchTerm) && bName.startsWith(lowerSearchTerm)) return 1;
        if (aCode.startsWith(lowerSearchTerm) && !bCode.startsWith(lowerSearchTerm)) return -1;
        if (!aCode.startsWith(lowerSearchTerm) && bCode.startsWith(lowerSearchTerm)) return 1;
        return aName.localeCompare(bName);
      });
  }, [products, searchTerm, filterDepartment, isRtl]);

  const skeletonCount = useMemo(() => {
    return filteredProducts.length > 0 ? filteredProducts.length : 6;
  }, [filteredProducts]);

  useEffect(() => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
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
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.response?.data?.message || t.fetchError);
        toast.error(err.response?.data?.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, t, isRtl, filterDepartment, searchTerm]);

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

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.nameEn.trim()) errors.nameEn = t.nameEnRequired;
    if (!formData.code.trim()) errors.code = t.codeRequired;
    if (!formData.department) errors.department = t.departmentRequired;
    if (!formData.price.trim()) errors.price = t.priceRequired;
    return errors;
  }, [formData, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setError(t.requiredFields);
      toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      const productData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
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
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
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
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      closeModal();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Submit error:`, err);
      const errorMessage = err.response?.data?.message === 'Product code already exists' ? t.codeExists : (err.response?.data?.message || (editingProduct ? t.updateError : t.createError));
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const deleteProduct = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!window.confirm(t.deleteWarning)) return;
    try {
      await productsAPI.delete(id);
      setProducts(products.filter((p) => p._id !== id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      const errorMessage = err.response?.data?.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center"
      >
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-gray-600 text-sm">{t.addProducts}</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <motion.button
            onClick={() => openModal()}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-md"
            aria-label={t.add}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5" />
            {t.add}
          </motion.button>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </motion.div>
      )}

      {user?.role === 'admin' && (
        <div className={`lg:hidden fixed bottom-8 ${isRtl ? 'left-8' : 'right-8'} z-50`}>
          <motion.button
            onClick={() => openModal()}
            className="p-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-colors duration-200"
            aria-label={t.add}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>
      )}

      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
            <ProductDropdown
              value={filterDepartment}
              onChange={setFilterDepartment}
              options={[
                { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                ...departments.map((d) => ({
                  value: d._id,
                  label: isRtl ? d.name : (d.nameEn || d.name),
                })),
              ]}
              ariaLabel={t.department}
            />
          </div>
          <div className="mt-4 text-center text-sm text-gray-600 font-medium">
            {isRtl ? `${t.productCount}: ${filteredProducts.length}` : `${t.productCount}: ${filteredProducts.length}`}
          </div>
        </motion.div>

        <div className="overflow-y-auto max-h-[calc(100vh-14rem)] scrollbar-none">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {[...Array(skeletonCount)].map((_, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <ProductSkeletonCard />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
              {user?.role === 'admin' && !searchTerm && !filterDepartment && (
                <motion.button
                  onClick={() => openModal()}
                  className="mt-6 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                  aria-label={t.addFirst}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t.addFirst}
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
                  >
                    <ProductCard
                      product={product}
                      onEdit={(e) => openModal(product)}
                      onDelete={(e) => deleteProduct(product._id, e)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingProduct={editingProduct}
        error={error}
        departments={departments}
        t={t}
        isRtl={isRtl}
      />
    </div>
  );
}
