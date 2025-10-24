import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Plus } from 'lucide-react';
import QuantityInput from './QuantityInput';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  price: number;
  unit?: string;
  unitEn?: string;
  department: { _id: string; name: string; nameEn?: string };
}

interface OrderItem {
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

interface Translations {
  ar: {
    department: string;
    price: string;
    addToCart: string;
    currency: string;
  };
  en: {
    department: string;
    price: string;
    addToCart: string;
    currency: string;
  };
}

const ProductCard = ({
  product,
  cartItem,
  onAdd,
  onUpdate,
  onRemove,
  getDisplayName,
  getDisplayUnit,
  translations,
}: {
  product: Product;
  cartItem?: OrderItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
  getDisplayName: (item: { name: string; nameEn?: string }) => string;
  getDisplayUnit: (item: { unit?: string; unitEn?: string }) => string;
  translations: Translations;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];

  return (
    <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
            {getDisplayName(product)}
          </h3>
          <p className="text-sm text-gray-500">{product.code}</p>
        </div>
        <p className="text-sm text-amber-600">{t.department}: {getDisplayName(product.department)}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.price}: {product.price} {t.currency} / {getDisplayUnit(product)}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <QuantityInput
            value={cartItem.quantity}
            onChange={(val) => onUpdate(val)}
            onIncrement={() => onUpdate(cartItem.quantity + 0.5)}
            onDecrement={() => onUpdate(cartItem.quantity - 0.5)}
          />
        ) : (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
            aria-label={t.addToCart}
          >
            <Plus className="w-4 h-4" />
            {t.addToCart}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;