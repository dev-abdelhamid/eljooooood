import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Package, Search, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string };
  price: number;
  unit: string;
  unitEn?: string;
  description?: string;
  isActive: boolean;
}

interface Department {
  _id: string;
  name: string;
}

interface FormState {
  name: string;
  nameEn: string;
  code: string;
  department: string;
  price: string;
  unit: string;
  description: string;
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'RESET' };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET':
      return {
        name: '',
        nameEn: '',
        code: '',
        department: '',
        price: '',
        unit: 'قطعة',
        description: '',
      };
    default:
      return state;
  }
};

const translations = {
  ar: {
    manage: 'إدارة المنتجات',
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
    description: 'الوصف',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    delete: 'حذف',
    name: 'اسم المنتج (عربي)',
    nameEn: 'اسم المنتج (إنجليزي)',
    nameRequired: 'اسم المنتج مطلوب',
    nameEnRequired: 'اسم المنتج بالإنجليزية مطلوب',
    codeRequired: 'كود المنتج مطلوب',
    departmentRequired: 'القسم مطلوب',
    priceRequired: 'السعر مطلوب',
    priceInvalid: 'السعر يجب أن يكون رقمًا موجبًا',
    unitRequired: 'الوحدة مطلوبة',
    namePlaceholder: 'أدخل اسم المنتج',
    nameEnPlaceholder: 'أدخل اسم المنتج بالإنجليزية',
    codePlaceholder: 'أدخل كود المنتج',
    departmentPlaceholder: 'اختر القسم',
    pricePlaceholder: 'أدخل السعر',
    descriptionPlaceholder: 'أدخل وصف المنتج (اختياري)',
    update: 'تحديث المنتج',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    codeExists: 'الكود مستخدم بالفعل',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    saveError: 'خطأ أثناء حفظ المنتج',
    added: 'تم إضافة المنتج بنجاح',
    updated: 'تم تحديث المنتج بنجاح',
    deleteConfirm: 'هل أنت متأكد من حذف هذا المنتج؟',
    deleteError: 'خطأ أثناء حذف المنتج',
    deleted: 'تم حذف المنتج بنجاح',
    units: {
      kilo: 'كيلو',
      piece: 'قطعة',
      box: 'علبة',
      tray: 'صينية',
    },
    currency: 'ر.س',
  },
  en: {
    manage: 'Manage Products',
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
    description: 'Description',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    delete: 'Delete',
    name: 'Product Name (Arabic)',
    nameEn: 'Product Name (English)',
    nameRequired: 'Product name is required',
    nameEnRequired: 'Product name in English is required',
    codeRequired: 'Product code is required',
    departmentRequired: 'Department is required',
    priceRequired: 'Price is required',
    priceInvalid: 'Price must be a positive number',
    unitRequired: 'Unit is required',
    namePlaceholder: 'Enter product name',
    nameEnPlaceholder: 'Enter product name in English',
    codePlaceholder: 'Enter product code',
    departmentPlaceholder: 'Select department',
    pricePlaceholder: 'Enter price',
    descriptionPlaceholder: 'Enter product description (optional)',
    update: 'Update Product',
    requiredFields: 'Please fill all required fields',
    codeExists: 'Code is already in use',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    saveError: 'Error saving product',
    added: 'Product added successfully',
    updated: 'Product updated successfully',
    deleteConfirm: 'Are you sure you want to delete this product?',
    deleteError: 'Error deleting product',
    deleted: 'Product deleted successfully',
    units: {
      kilo: 'Kilo',
      piece: 'Piece',
      box: 'Pack',
      tray: 'Tray',
    },
    currency: 'SAR',
  },
};

export const Products: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];

  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, dispatchForm] = useReducer(formReducer, {
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: 'قطعة',
    description: '',
  });

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setLoading(true);
    try {
      const [productsResponse, departmentsResponse] = await Promise.all([
        productsAPI.getAll({ page, limit: 12, search: searchTerm }),
        departmentAPI.getAll(),
      ]);
      const productsData = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse;
      setProducts(productsData);
      setDepartments(Array.isArray(departmentsResponse) ? departmentsResponse : []);
      setTotalPages(productsResponse.totalPages || Math.ceil(productsData.length / 12));
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [user, page, searchTerm, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (product) =>
        product &&
        ((isRtl ? product.name : product.nameEn || product.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.code?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm, isRtl]);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.nameEn.trim()) errors.nameEn = t.nameEnRequired;
    if (!formData.code.trim()) errors.code = t.codeRequired;
    if (!formData.department) errors.department = t.departmentRequired;
    if (!formData.price.trim()) errors.price = t.priceRequired;
    else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) errors.price = t.priceInvalid;
    if (!formData.unit) errors.unit = t.unitRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const openAddModal = useCallback(() => {
    dispatchForm({ type: 'RESET' });
    setIsEditMode(false);
    setSelectedProduct(null);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  }, []);

  const openEditModal = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchForm({ type: 'RESET' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: product.name });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value: product.nameEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: product.code });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'department', value: product.department._id });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'price', value: product.price.toString() });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'unit', value: product.unit });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'description', value: product.description || '' });
    setIsEditMode(true);
    setSelectedProduct(product);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  }, []);

  const openDeleteModal = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) {
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
          unit: formData.unit,
          description: formData.description.trim() || undefined,
        };
        if (isEditMode && selectedProduct) {
          const updatedProduct = await productsAPI.update(selectedProduct._id, productData);
          setProducts(
            products.map((p) =>
              p._id === selectedProduct._id
                ? { ...p, ...updatedProduct, department: departments.find((d) => d._id === formData.department)! }
                : p
            )
          );
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          const newProduct = await productsAPI.create(productData);
          setProducts([
            ...products,
            { ...newProduct, department: departments.find((d) => d._id === formData.department)! },
          ]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
        }
        setIsModalOpen(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Submit error:`, err);
        const errorMessage = err.response?.data?.message === 'Code already exists' ? t.codeExists : t.saveError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [formData, isEditMode, selectedProduct, products, departments, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedProduct) return;
    try {
      await productsAPI.delete(selectedProduct._id);
      setProducts(products.filter((p) => p._id !== selectedProduct._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      const errorMessage = err.response?.data?.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [selectedProduct, products, t, isRtl]);

  const handleCardClick = useCallback((productId: string) => {
    navigate(`/products/${productId}`);
  }, [navigate]);

  const renderPagination = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={page === i ? 'primary' : 'outline'}
          onClick={() => setPage(i)}
          className={`w-10 h-10 text-sm font-medium rounded-full ${page === i ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} transition-colors`}
        >
          {i}
        </Button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6 gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          &larr;
        </Button>
        {pages}
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          &rarr;
        </Button>
      </div>
    );
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-md transition-transform transform hover:scale-105"
          >
            {t.add}
          </Button>
        )}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <Card className="p-4 mb-6 bg-white rounded-lg shadow-md">
        <div className="relative">
          <Search
            className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5`}
          />
          <Input
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
            placeholder={t.searchPlaceholder}
            className={`w-full pl-10 pr-4 py-2 text-sm border border-amber-300 rounded-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t.searchPlaceholder}
          />
        </div>
      </Card>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredProducts.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-lg shadow-md col-span-full">
            <Package className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-900">{t.noProducts}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {searchTerm ? t.noMatch : t.empty}
            </p>
            {user?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-4 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-md transition-transform transform hover:scale-105"
              >
                {t.addFirst}
              </Button>
            )}
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <motion.div
              key={product._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                onClick={() => handleCardClick(product._id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-amber-900 truncate max-w-[80%]">
                      {isRtl ? product.name : product.nameEn || product.name}
                    </h3>
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xs text-gray-600 truncate">{t.code}: {product.code}</p>
                  <p className="text-xs text-gray-600 truncate">{t.department}: {product.department?.name || '-'}</p>
                  <p className="text-xs text-gray-600 truncate">{t.price}: {product.price} {t.currency}</p>
                  <p className="text-xs text-gray-600 truncate">{t.unit}: {isRtl ? product.unit : product.unitEn || product.unit}</p>
                  {product.description && (
                    <p className="text-xs text-gray-600 truncate">{t.description}: {product.description}</p>
                  )}
                  <p className={`text-xs font-medium ${product.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {t.status}: {product.isActive ? t.active : t.inactive}
                  </p>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => openEditModal(product, e)}
                        className="text-xs p-1.5 w-8 h-8 rounded-full text-amber-600 hover:text-amber-800 border-amber-600 hover:bg-amber-50"
                        aria-label={t.edit}
                      />
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => openDeleteModal(product, e)}
                        className="text-xs p-1.5 w-8 h-8 rounded-full text-red-500 hover:text-red-700 border-red-500 hover:bg-red-50"
                        aria-label={t.delete}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
      {filteredProducts.length > 0 && renderPagination}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? t.edit : t.add}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4"
          >
            <Input
              label={t.name}
              value={formData.name}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value })}
              placeholder={t.namePlaceholder}
              required
              error={formErrors.name}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.nameEn}
              value={formData.nameEn}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value })}
              placeholder={t.nameEnPlaceholder}
              required
              error={formErrors.nameEn}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.code}
              value={formData.code}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value })}
              placeholder={t.codePlaceholder}
              required
              error={formErrors.code}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Select
              label={t.department}
              options={[{ value: '', label: t.departmentPlaceholder }, ...departments.map((d) => ({ value: d._id, label: d.name }))]}
              value={formData.department}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'department', value })}
              required
              error={formErrors.department}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.price}
              type="number"
              value={formData.price}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'price', value })}
              placeholder={t.pricePlaceholder}
              required
              error={formErrors.price}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Select
              label={t.unit}
              options={[
                { value: 'كيلو', label: t.units.kilo },
                { value: 'قطعة', label: t.units.piece },
                { value: 'علبة', label: t.units.box },
                { value: 'صينية', label: t.units.tray },
              ]}
              value={formData.unit}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'unit', value })}
              required
              error={formErrors.unit}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">{t.description}</label>
              <textarea
                value={formData.description}
                onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'description', value: e.target.value })}
                placeholder={t.descriptionPlaceholder}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                rows={3}
              />
            </div>
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-6">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {isEditMode ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t.deleteConfirm}
        size="sm"
      >
        <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-sm text-gray-600">{t.deleteConfirm}</p>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.delete}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Products;
