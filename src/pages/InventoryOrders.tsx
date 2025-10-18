import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Product {
  _id: string;
  name: string;
  nameEn: string;
  unit: string;
  unitEn: string;
  code: string;
  department: { name: string; nameEn: string };
}

interface User {
  _id: string;
  username: string;
  name: string;
  nameEn: string;
}

interface OrderItem {
  _id: string;
  product: Product;
  quantity: number;
  status: string;
  assignedTo?: User;
}

interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  status: string;
  createdBy: User;
}

const InventoryOrders: React.FC = () => {
  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [chefs, setChefs] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedChef, setSelectedChef] = useState<string>('');
  const isRtl = true; // Set based on language preference (Arabic)

  // Fetch orders and chefs on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersResponse, chefsResponse] = await Promise.all([
          axios.get('/api/factory-orders', { params: { lang: 'ar' } }),
          axios.get('/api/users', { params: { role: 'chef', lang: 'ar' } }), // Assuming endpoint for chefs
        ]);
        setOrders(ordersResponse.data.data);
        setChefs(chefsResponse.data.data);
        setError(null);
      } catch (err) {
        setError(isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle chef assignment
  const handleAssignChef = async (orderId: string, itemId: string) => {
    if (!selectedChef) {
      setError(isRtl ? 'يرجى اختيار شيف' : 'Please select a chef');
      return;
    }
    try {
      setLoading(true);
      await axios.post(`/api/factory-orders/${orderId}/assign-chefs`, {
        items: [{ itemId, assignedTo: selectedChef }],
      }, { params: { lang: 'ar' } });
      // Refresh orders
      const response = await axios.get('/api/factory-orders', { params: { lang: 'ar' } });
      setOrders(response.data.data);
      setSelectedOrderId(null);
      setSelectedItemId(null);
      setSelectedChef('');
      setError(null);
    } catch (err) {
      setError(isRtl ? 'خطأ في تعيين الشيف' : 'Error assigning chef');
      console.error('Assign chef error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4 dir-rtl">
      <h1 className="text-2xl font-bold mb-4">{isRtl ? 'طلبات المصنع' : 'Factory Orders'}</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b text-right">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className="py-2 px-4 border-b text-right">{isRtl ? 'المنتجات' : 'Products'}</th>
              <th className="py-2 px-4 border-b text-right">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="py-2 px-4 border-b text-right">{isRtl ? 'إنشاء بواسطة' : 'Created By'}</th>
              <th className="py-2 px-4 border-b text-right">{isRtl ? 'الإجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order._id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b">{order.orderNumber}</td>
                <td className="py-2 px-4 border-b">
                  <ul className="list-disc pr-4">
                    {order.items.map(item => (
                      <li key={item._id}>
                        {isRtl ? item.product.name : item.product.nameEn} ({item.quantity} {isRtl ? item.product.unit : item.product.unitEn})
                        <br />
                        {isRtl ? 'الشيف: ' : 'Chef: '}
                        {item.assignedTo ? (isRtl ? item.assignedTo.name : item.assignedTo.nameEn) : (
                          <button
                            className="text-blue-500 hover:underline text-sm"
                            onClick={() => {
                              setSelectedOrderId(order._id);
                              setSelectedItemId(item._id);
                            }}
                          >
                            {isRtl ? 'تعيين شيف' : 'Assign Chef'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-2 px-4 border-b">
                  {isRtl
                    ? order.status === 'pending' ? 'معلق' :
                      order.status === 'approved' ? 'تم الموافقة' :
                      order.status === 'in_production' ? 'قيد الإنتاج' :
                      order.status === 'completed' ? 'مكتمل' : 'ملغى'
                    : order.status
                  }
                </td>
                <td className="py-2 px-4 border-b">
                  {isRtl ? order.createdBy.name : order.createdBy.nameEn}
                </td>
                <td className="py-2 px-4 border-b">
                  {order.items.some(item => !item.assignedTo) && (
                    <button
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 py-2 text-sm"
                      onClick={() => setSelectedOrderId(order._id)}
                    >
                      {isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal for assigning chef */}
      {selectedOrderId && selectedItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-md w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{isRtl ? 'تعيين شيف' : 'Assign Chef'}</h2>
            <select
              value={selectedChef}
              onChange={e => setSelectedChef(e.target.value)}
              className="w-full p-2 border rounded-md mb-4"
            >
              <option value="">{isRtl ? 'اختر شيف' : 'Select Chef'}</option>
              {chefs.map(chef => (
                <option key={chef._id} value={chef._id}>
                  {isRtl ? chef.name : chef.nameEn}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-300 hover:bg-gray-400 text-black rounded-md px-4 py-2 text-sm"
                onClick={() => {
                  setSelectedOrderId(null);
                  setSelectedItemId(null);
                  setSelectedChef('');
                }}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => handleAssignChef(selectedOrderId, selectedItemId)}
                disabled={loading || !selectedChef}
              >
                {loading ? (isRtl ? 'جاري التعيين...' : 'Assigning...') : (isRtl ? 'تعيين' : 'Assign')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryOrders;