import { Clock, Check, Package, Truck, X } from 'lucide-react';

export const STATUS_COLORS = {
  pending: {
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    label: 'pending',
    progress: 10,
  },
  approved: {
    color: 'bg-teal-100 text-teal-800',
    icon: Check,
    label: 'approved',
    progress: 30,
  },
  in_production: {
    color: 'bg-purple-100 text-purple-800',
    icon: Package,
    label: 'in_production',
    progress: 50,
  },
  completed: {
    color: 'bg-green-50 text-green-800',
    icon: Check,
    label: 'completed',
    progress: 70,
  },
  in_transit: {
    color: 'bg-blue-100 text-blue-800',
    icon: Truck,
    label: 'in_transit',
    progress: 90,
  },
  delivered: {
    color: 'bg-green-300 text-gray-800',
    icon: Check,
    label: 'delivered',
    progress: 100,
  },
  cancelled: {
    color: 'bg-red-100 text-red-800',
    icon: X,
    label: 'cancelled',
    progress: 0,
  },
};

export const ITEM_STATUS_COLORS = {
  pending: {
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    label: 'pending',
    progress: 0,
  },
  in_production: {
    color: 'bg-purple-100 text-purple-800',
    icon: Package,
    label: 'in_production',
    progress: 50,
  },
  completed: {
    color: 'bg-green-200 text-green-800',
    icon: Check,
    label: 'completed',
    progress: 100,
  },
};