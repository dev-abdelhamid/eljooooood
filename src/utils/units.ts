import { Product } from '../pages/NewOrder';

// دالة لتحديد الوحدات المتاحة
export const getAllowedUnits = (): string[] => {
  return ['كيلو', 'قطعة', 'علبة', 'صينية'];
};

// دالة لجلب الوحدات المتاحة من المنتجات
export const getUnitOptions = (products: Product[], language: string): { value: string; label: string }[] => {
  const allowedUnits = getAllowedUnits();
  const unitsSet = new Set<string>();
  products.forEach((product) => {
    if (product.unit && allowedUnits.includes(product.unit)) {
      unitsSet.add(product.unit);
    }
  });

  return Array.from(unitsSet).map((unit) => ({
    value: unit,
    label: language === 'ar' ? unit : products.find((p) => p.unit === unit)?.unitEn || unit,
  }));
};