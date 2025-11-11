import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X, ChevronDown, Upload, Image as ImageIcon } from 'lucide-react';
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
  status: 'Available' | 'Unavailable';
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
    status: 'الحالة',
    image: 'صورة المنتج',
    edit: 'تعديل',
    delete: 'حذف',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل الاسم بالإنجليزية',
    codePlaceholder: 'أدخل رمز المنتج',
    pricePlaceholder: 'أدخل السعر',
    unitPlaceholder: 'اختر الوحدة',
    departmentPlaceholder: 'اختر القسم',
    statusPlaceholder: 'اختر الحالة',
    imagePlaceholder: 'اختر صورة (اختياري)',
    update: 'تحديث المنتج',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    invalidUnit: 'الوحدة غير صالحة، اختر من القائمة',
    invalidStatus: 'الحالة غير صالحة، اختر من القائمة',
    invalidPrice: 'السعر يجب أن يكون رقمًا إيجابيًا',
    invalidImage: 'الصورة يجب أن تكون بصيغة JPG أو PNG',
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
    status: 'Status',
    image: 'Product Image',
    edit: 'Edit',
    delete: 'Delete',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter English name',
    codePlaceholder: 'Enter product code',
    pricePlaceholder: 'Enter price',
    unitPlaceholder: 'Select Unit',
    departmentPlaceholder: 'Select Department',
    statusPlaceholder: 'Select Status',
    imagePlaceholder: 'Choose image (optional)',
    update: 'Update Product',
    requiredFields: 'Please fill all required fields',
    invalidUnit: 'Invalid unit, please select from the list',
    invalidStatus: 'Invalid status, please select from the list',
    invalidPrice: 'Price must be a positive number',
    invalidImage: 'Image must be JPG or PNG',
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

const statusOptions = [
  { value: 'Available', labelAr: 'متوفر', labelEn: 'Available' },
  { value: 'Unavailable', labelAr: 'غير متوفر', labelEn: 'Unavailable' },
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} flex items-center justify-center align-center top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`}
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 flex items-center justify-center align-center transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
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

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized);
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
        toast.error(err.response?.data?.message || t.fetchError);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, user, filterDepartment, searchTerm, t]);

  const openModal = (product?: Product) => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized);
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
        status: product.status || 'Available',
        image: product.image || '',
      });
      setImagePreview(product.image || '');
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        department: departments[0]?._id || '',
        price: '',
        unit: '',
        status: 'Available',
        image: '',
      });
      setImagePreview('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setError('');
    setImagePreview('');
  };

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: '',
    status: 'Available' as 'Available' | 'Unavailable',
    image: '',
  });

  const [imagePreview, setImagePreview] = useState<string>('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError(t.invalidImage);
      toast.error(t.invalidImage);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setFormData({ ...formData, image: result });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview('');
    setFormData({ ...formData, image: '' });
    const input = document.getElementById('image-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.department || !formData.price) {
      setError(t.requiredFields);
      toast.error(t.requiredFields);
      return;
    }
    if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      setError(t.invalidPrice);
      toast.error(t.invalidPrice);
      return;
    }
    if (formData.unit && !unitOptions.some((opt) => opt.value === formData.unit)) {
      setError(t.invalidUnit);
      toast.error(t.invalidUnit);
      return;
    }
    if (!statusOptions.some((opt) => opt.value === formData.status)) {
      setError(t.invalidStatus);
      toast.error(t.invalidStatus);
      return;
    }

    try {
      const productData: any = {
        name: formData.name.trim(),
        nameEn: formData.nameEn?.trim() || undefined,
        code: formData.code.trim(),
        department: formData.department,
        price: parseFloat(formData.price),
        unit: formData.unit || undefined,
        status: formData.status,
        image: formData.image || undefined,
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
        toast.success(t.updated);
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
        toast.success(t.added);
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || t.saveError);
      toast.error(err.response?.data?.message || t.saveError);
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
      setError(t.unauthorized);
      toast.error(t.unauthorized);
      return;
    }
    try {
      await productsAPI.delete(deletingProductId);
      setProducts(products.filter((p) => p._id !== deletingProductId));
      toast.success(t.deleted);
      closeDeleteModal();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || t.deleteError);
      toast.error(err.response?.data?.message || t.deleteError);
    }
  };

  return (
    <div className="mx-auto px-4 py-6 min-h-screen overflow-y-auto scrollbar-none" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-gray-600 text-xs">{isRtl ? 'قم بإضافة المنتجات أو تعديلها أو حذفها' : 'Add, edit, or delete products'}</p>
          </div>
        </div>
        {['admin', 'production'].includes(user?.role ?? '') && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            aria-label={t.add}
          >
            <Plus className="w-3.5 h-3.5" />
            {t.add}
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
            <p className="text-gray-600 text-xs">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
            {['admin', 'production'].includes(user?.role ?? '') && !searchTerm && !filterDepartment && (
              <button
                onClick={() => openModal()}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none">
            {products.map((product) => (
              <div
                key={product._id}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
              >
                {/* Product Image */}
                <div className="mb-3 h-32 bg-gray-100 rounded-lg overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center bg-gray-50 ${product.image ? 'hidden' : ''}`}>
                    <ImageIcon className="w-10 h-10 text-gray-300" />
                  </div>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{product.displayName}</h3>
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
                      title={t.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(product._id)}
                      className="p-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={t.delete}
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{editingProduct ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">{t.name}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">{t.code}</label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={t.codePlaceholder}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-xs font-medium text-gray-700 mb-1">{t.department}</label>
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
                  />
                </div>
                <div>
                  <label htmlFor="price" className="block text-xs font-medium text-gray-700 mb-1">{t.price}</label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-xs font-medium text-gray-700 mb-1">{t.unit}</label>
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
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">{t.status}</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={(value) => setFormData({ ...formData, status: value as 'Available' | 'Unavailable' })}
                    options={statusOptions.map((opt) => ({
                      value: opt.value,
                      label: isRtl ? opt.labelAr : opt.labelEn,
                    }))}
                    ariaLabel={t.status}
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.image}</label>
                <div className="space-y-2">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                        title={isRtl ? 'إزالة الصورة' : 'Remove image'}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">{t.imagePlaceholder}</span>
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
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
                  aria-label={t.cancel}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                  aria-label={editingProduct ? t.update : t.add}
                >
                  {editingProduct ? t.update : t.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.confirmDelete}</h3>
            <p className="text-xs text-gray-600 mb-4">{t.deleteWarning}</p>
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
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors"
                aria-label={t.delete}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}