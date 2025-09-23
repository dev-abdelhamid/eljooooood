import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI, departmentAPI, branchesAPI, inventoryAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';

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
  image?: string;
  ingredients?: string[];
  preparationTime?: number;
  branches?: { _id: string; name: string }[];
  displayName: string;
  displayUnit: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
}

interface Branch {
  _id: string;
  name: string;
}

export function Products() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    department: '',
    price: '',
    unit: 'قطعة',
    unitEn: 'Piece',
    description: '',
    image: '',
    ingredients: '',
    preparationTime: '',
    branch: '',
  });

  const unitOptions = [
    { value: 'كيلو', label: t('products.units.kilo'), unitEn: 'Kilo' },
    { value: 'قطعة', label: t('products.units.piece'), unitEn: 'Piece' },
    { value: 'علبة', label: t('products.units.box'), unitEn: 'Pack' },
    { value: 'صينية', label: t('products.units.tray'), unitEn: 'Tray' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('products.unauthorized'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching products with params:', { department: filterDepartment, search: searchTerm, page: currentPage, limit: 12 });
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const [productsResponse, departmentsResponse, branchesResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, page: currentPage, limit: 12 }).catch((err) => {
            console.error('Products API error:', err);
            throw err;
          }),
          departmentAPI.getAll().catch((err) => {
            console.error('Departments API error:', err);
            throw err;
          }),
          branchesAPI.getAll().catch((err) => {
            console.error('Branches API error:', err);
            throw err;
          }),
        ]);
        console.log('Products response:', productsResponse);
        console.log('Departments response:', departmentsResponse);
        console.log('Branches response:', branchesResponse);

        // جلب معلومات الفروع المرتبطة بالمنتجات عبر المخزون
        const productsWithBranches = await Promise.all(
          productsResponse.data.map(async (product: Product) => {
            const inventory = await inventoryAPI.getInventory({ product: product._id }).catch(() => []);
            const productBranches = inventory.map((item: any) => ({
              _id: item.branchId,
              name: branchesResponse.find((b: Branch) => b._id === item.branchId)?.name || 'Unknown',
            }));
            return {
              ...product,
              branches: productBranches,
              displayName: product.displayName || (language === 'ar' ? product.name : (product.nameEn || product.name)),
              displayUnit: product.displayUnit || (language === 'ar' ? product.unit : (product.unitEn || product.unit)),
            };
          })
        );

        setProducts(productsWithBranches);
        setTotalPages(productsResponse.totalPages);
        setDepartments(departmentsResponse.data);
        setBranches(branchesResponse);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t('products.fetchError'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, filterDepartment, searchTerm, currentPage]);

  const filteredProducts = products.filter(
    (product) =>
      (product.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterDepartment === '' || product.department._id === filterDepartment)
  );

  const openModal = (product?: Product) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('products.unauthorized'));
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
        unitEn: product.unitEn || '',
        description: product.description || '',
        image: product.image || '',
        ingredients: product.ingredients?.join(', ') || '',
        preparationTime: product.preparationTime?.toString() || '',
        branch: '',
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
        image: '',
        ingredients: '',
        preparationTime: '',
        branch: '',
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
      const price = parseFloat(formData.price);
      const preparationTime = formData.preparationTime ? parseInt(formData.preparationTime) : undefined;
      if (isNaN(price) || price < 0) {
        setError(t('products.invalidPrice'));
        return;
      }
      if (preparationTime && (isNaN(preparationTime) || preparationTime < 0)) {
        setError(t('products.invalidPreparationTime'));
        return;
      }
      const ingredients = formData.ingredients ? formData.ingredients.split(',').map(i => i.trim()).filter(i => i) : undefined;
      const productData = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        department: formData.department,
        price,
        unit: formData.unit,
        unitEn: formData.unitEn || undefined,
        description: formData.description || undefined,
        image: formData.image || undefined,
        ingredients,
        preparationTime,
      };
      console.log('Submitting product:', productData);
      let updatedProduct;
      if (editingProduct) {
        updatedProduct = await productsAPI.update(editingProduct._id, productData);
        setProducts(
          products.map((p) =>
            p._id === editingProduct._id
              ? {
                  ...updatedProduct,
                  department: departments.find((d) => d._id === formData.department)!,
                  displayName: updatedProduct.displayName || (language === 'ar' ? updatedProduct.name : (updatedProduct.nameEn || updatedProduct.name)),
                  displayUnit: updatedProduct.displayUnit || (language === 'ar' ? updatedProduct.unit : (updatedProduct.unitEn || updatedProduct.unit)),
                }
              : p
          )
        );
      } else {
        updatedProduct = await productsAPI.create(productData);
        setProducts([
          ...products,
          {
            ...updatedProduct,
            department: departments.find((d) => d._id === formData.department)!,
            displayName: updatedProduct.displayName || (language === 'ar' ? updatedProduct.name : (updatedProduct.nameEn || updatedProduct.name)),
            displayUnit: updatedProduct.displayUnit || (language === 'ar' ? updatedProduct.unit : (updatedProduct.unitEn || updatedProduct.unit)),
          },
        ]);
      }
      // إذا تم تحديد فرع، إنشاء سجل مخزون
      if (formData.branch) {
        await inventoryAPI.create({
          branchId: formData.branch,
          productId: updatedProduct._id,
          userId: user._id,
          currentStock: 0,
          minStockLevel: 0,
          maxStockLevel: 1000,
        });
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || t('products.saveError'));
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('products.unauthorized'));
      return;
    }
    if (confirm(t('products.deleteConfirm'))) {
      try {
        await productsAPI.delete(id);
        setProducts(products.filter((p) => p._id !== id));
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.message || t('products.deleteError'));
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
    <div className="container mx-auto px-4 py-6 min-h-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {t('products.manage')}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 shadow-md transition-transform transform hover:scale-105"
          >
            {t('products.add')}
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t('products.searchPlaceholder')}
              className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
              aria-label={t('products.searchPlaceholder')}
            />
          </div>
          <Select
            label={t('products.department')}
            options={[{ value: '', label: t('products.allDepartments') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
            value={filterDepartment}
            onChange={setFilterDepartment}
            className="border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t('products.department')}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <Card key={product._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4">
              <img
                src={product.image || 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg'}
                alt={product.displayName}
                className="w-full h-32 object-cover rounded-md mb-3"
              />
              <h3 className="font-medium text-gray-800">{product.displayName}</h3>
              <p className="text-sm text-gray-500">{t('products.code')}: {product.code}</p>
              <p className="text-sm text-blue-500">{language === 'ar' ? product.department.name : (product.department.nameEn || product.department.name)}</p>
              <p className="text-sm text-gray-500">{t('products.unit')}: {product.displayUnit}</p>
              <p className="text-sm text-gray-500">{t('products.branches')}: {product.branches?.length ? product.branches.map(b => b.name).join(', ') : '-'}</p>
              {product.description && <p className="text-xs text-gray-400 mt-1">{t('products.description')}: {product.description}</p>}
              {product.ingredients?.length && (
                <p className="text-xs text-gray-400 mt-1">{t('products.ingredients')}: {product.ingredients.join(', ')}</p>
              )}
              {product.preparationTime && (
                <p className="text-xs text-gray-400 mt-1">{t('products.preparationTime')}: {product.preparationTime} {t('products.minutes')}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-semibold text-gray-800">{product.price} {t('products.currency')}</span>
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(product)}
                      className="text-blue-500 hover:text-blue-700"
                      title={t('products.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product._id)}
                      className="text-red-500 hover:text-red-700"
                      title={t('products.delete')}
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
          <h3 className="text-lg font-medium text-gray-800">{t('products.noProducts')}</h3>
          <p className="text-gray-500">{searchTerm || filterDepartment ? t('products.noMatch') : t('products.empty')}</p>
          {user?.role === 'admin' && !searchTerm && !filterDepartment && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => openModal()}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
            >
              {t('products.addFirst')}
            </Button>
          )}
        </Card>
      )}

      <div className="flex justify-center mt-6">
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="mx-2"
        >
          {t('previous')}
        </Button>
        <span className="mx-4 self-center">{t('page')} {currentPage} / {totalPages}</span>
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="mx-2"
        >
          {t('next')}
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? t('products.edit') : t('products.add')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('products.name')}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t('products.namePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.nameEn')}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t('products.nameEnPlaceholder')}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.code')}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t('products.codePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('products.department')}
              options={[{ value: '', label: t('products.selectDepartment') }, ...departments.map((d) => ({ value: d._id, label: language === 'ar' ? d.name : (d.nameEn || d.name) }))]}
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.price')}
              type="number"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              placeholder="0.00"
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('products.unit')}
              options={unitOptions.map(opt => ({ value: opt.value, label: language === 'ar' ? opt.label : opt.unitEn }))}
              value={formData.unit}
              onChange={(value) => {
                const selected = unitOptions.find(opt => opt.value === value);
                setFormData({ ...formData, unit: value, unitEn: selected?.unitEn || '' });
              }}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.image')}
              value={formData.image}
              onChange={(value) => setFormData({ ...formData, image: value })}
              placeholder={t('products.imagePlaceholder')}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('products.preparationTime')}
              type="number"
              value={formData.preparationTime}
              onChange={(value) => setFormData({ ...formData, preparationTime: value })}
              placeholder="60"
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('products.branch')}
              options={[{ value: '', label: t('products.selectBranch') }, ...branches.map((b) => ({ value: b._id, label: b.name }))]}
              value={formData.branch}
              onChange={(value) => setFormData({ ...formData, branch: value })}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.ingredients')}</label>
              <textarea
                value={formData.ingredients}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                placeholder={t('products.ingredientsPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('products.descriptionPlaceholder')}
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
              {editingProduct ? t('products.update') : t('products.add')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}