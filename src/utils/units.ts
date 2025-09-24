// في src/utils/units.ts
import { useLanguage } from '../contexts/LanguageContext';

interface UnitOption {
  value: string;
  label: string;
}

interface Product {
  unit?: string;
  unitEn?: string;
}

export const getUnitOptions = (products: Product[], language: string, quantity: number): UnitOption[] => {
  // تعريف صيغ الوحدات بناءً على العدد في العربية
  const unitForms: { [key: string]: { singular: string; dual: string; pluralFew: string; pluralMany: string } } = {
    'كيلو': {
      singular: 'كيلو',
      dual: 'كيلوين',
      pluralFew: 'كيلوات',
      pluralMany: 'كيلو',
    },
    'قطعة': {
      singular: 'قطعة',
      dual: 'قطعتين',
      pluralFew: 'قطع',
      pluralMany: 'قطعة',
    },
    'علبة': {
      singular: 'علبة',
      dual: 'علبتين',
      pluralFew: 'علب',
      pluralMany: 'علبة',
    },
    'صينية': {
      singular: 'صينية',
      dual: 'صينيتين',
      pluralFew: 'صواني',
      pluralMany: 'صينية',
    },
  };

  // دالة لتحديد الصيغة بناءً على العدد (للغة العربية)
  const getUnitForm = (unit: string, qty: number): string => {
    if (language !== 'ar') {
      return unitForms[unit]?.singular || unit; // الإنجليزية: دايمًا المفرد
    }
    if (qty === 1) {
      return unitForms[unit]?.singular || unit;
    } else if (qty === 2) {
      return unitForms[unit]?.dual || unit;
    } else if (qty >= 3 && qty <= 10) {
      return unitForms[unit]?.pluralFew || unit;
    } else {
      return unitForms[unit]?.pluralMany || unit;
    }
  };

  // قواعد الوحدات بناءً على الكمية
  const getAllowedUnits = (qty: number): string[] => {
    if (qty === 2) {
      return ['قطعة']; // الكمية 2: قطعة بس
    } else if (qty >= 3 && qty <= 10) {
      return ['قطعة', 'علبة', 'صينية']; // الكمية 3-10: قطعة، علبة، صينية
    } else {
      return ['كيلو', 'قطعة', 'علبة', 'صينية']; // الكميات الأخرى: كل الوحدات
    }
  };

  // استخراج الوحدات الفريدة من المنتجات
  const unitsSet = new Set<string>();
  products.forEach((product) => {
    if (product.unit) {
      unitsSet.add(product.unit);
    }
  });

  // الوحدات المسموحة بناءً على الكمية
  const allowedUnits = getAllowedUnits(quantity);

  // تحويل الوحدات لـ array من الـ options
  const unitOptions: UnitOption[] = allowedUnits
    .filter((unit) => unitsSet.has(unit)) // نأكد إن الوحدة موجودة في المنتجات
    .map((unit) => {
      const unitMapping: { [key: string]: string } = {
        'كيلو': 'Kilo',
        'قطعة': 'Piece',
        'علبة': 'Pack',
        'صينية': 'Tray',
      };
      return {
        value: unit,
        label: language === 'ar' ? getUnitForm(unit, quantity) : unitMapping[unit],
      };
    });

  // إذا مافيش وحدات متاحة، نرجّع وحدة افتراضية
  if (unitOptions.length === 0 && quantity > 0) {
    return [
      {
        value: 'قطعة',
        label: language === 'ar' ? getUnitForm('قطعة', quantity) : 'Piece',
      },
    ];
  }

  return unitOptions;
};

// دالة لعرض الوحدة في ملخص الطلب
export const getDisplayUnit = (unit: string, quantity: number, language: string): string => {
  const unitForms: { [key: string]: { singular: string; dual: string; pluralFew: string; pluralMany: string } } = {
    'كيلو': {
      singular: 'كيلو',
      dual: 'كيلوين',
      pluralFew: 'كيلوات',
      pluralMany: 'كيلو',
    },
    'قطعة': {
      singular: 'قطعة',
      dual: 'قطعتين',
      pluralFew: 'قطع',
      pluralMany: 'قطعة',
    },
    'علبة': {
      singular: 'علبة',
      dual: 'علبتين',
      pluralFew: 'علب',
      pluralMany: 'علبة',
    },
    'صينية': {
      singular: 'صينية',
      dual: 'صينيتين',
      pluralFew: 'صواني',
      pluralMany: 'صينية',
    },
  };

  if (language !== 'ar') {
    const unitMapping: { [key: string]: string } = {
      'كيلو': 'Kilo',
      'قطعة': 'Piece',
      'علبة': 'Pack',
      'صينية': 'Tray',
    };
    return unitMapping[unit] || unit;
  }

  if (quantity === 1) {
    return unitForms[unit]?.singular || unit;
  } else if (quantity === 2) {
    return unitForms[unit]?.dual || unit;
  } else if (quantity >= 3 && quantity <= 10) {
    return unitForms[unit]?.pluralFew || unit;
  } else {
    return unitForms[unit]?.pluralMany || unit;
  }
};