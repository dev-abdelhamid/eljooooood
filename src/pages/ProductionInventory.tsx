import React, { useState, useEffect } from 'react';
import { factoryInventoryAPI } from '../services/factoryInventoryAPI';

export const ProductionInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState({ type: 'branch', branchId: '', items: [], notes: '' });
  const [chefs, setChefs] = useState([]); // افتراضيًا، يمكن جلب الشيفات من API منفصل
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // جلب المخزون
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const data = await factoryInventoryAPI.getFactoryInventory();
        setInventory(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch inventory');
      } finally {
        setLoading(false);
      }
    };

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const data = await factoryInventoryAPI.getFactoryProductionRequests();
        setRequests(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch requests');
      } finally {
        setLoading(false);
      }
    };

    // جلب قائمة افتراضية للشيفات (يمكن استبدالها بـ API حقيقي)
    const fetchChefs = async () => {
      // هنا يمكن استدعاء chefsAPI.getAll() إذا كان موجودًا
      setChefs([{ id: '1', name: 'Chef Ali' }, { id: '2', name: 'Chef Ahmed' }]);
    };

    fetchInventory();
    fetchRequests();
    fetchChefs();
  }, []);

  // إضافة منتج للطلب الجديد
  const addItem = () => {
    setNewRequest((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1 }],
    }));
  };

  // تحديث بيانات المنتج أو الكمية
  const updateItem = (index, field, value) => {
    const updatedItems = [...newRequest.items];
    updatedItems[index][field] = value;
    setNewRequest((prev) => ({ ...prev, items: updatedItems }));
  };

  // إزالة منتج من الطلب
  const removeItem = (index) => {
    const updatedItems = newRequest.items.filter((_, i) => i !== index);
    setNewRequest((prev) => ({ ...prev, items: updatedItems }));
  };

  // إرسال طلب إنتاج جديد
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        type: newRequest.type,
        branchId: newRequest.type === 'branch' ? newRequest.branchId : null,
        items: newRequest.items.map(item => ({
          productId: item.productId,
          quantity: parseInt(item.quantity, 10),
        })),
        notes: newRequest.notes,
      };
      const data = await factoryInventoryAPI.createFactoryProductionRequest(payload);
      setRequests((prev) => [...prev, data]);
      setNewRequest({ type: 'branch', branchId: '', items: [], notes: '' });
      setSuccess('Request created successfully');
    } catch (err) {
      setError(err.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  // تخصيص شيف للطلب
  const handleAssignChef = async (requestId, chefId) => {
    setLoading(true);
    try {
      const data = await factoryInventoryAPI.assignChefToRequest({ requestId, chefId });
      setRequests((prev) =>
        prev.map((req) => (req._id === requestId ? { ...req, ...data } : req))
      );
      setSuccess('Chef assigned successfully');
    } catch (err) {
      setError(err.message || 'Failed to assign chef');
    } finally {
      setLoading(false);
    }
  };

  // إكمال طلب
  const handleCompleteRequest = async (requestId) => {
    setLoading(true);
    try {
      const data = await factoryInventoryAPI.completeProductionRequest(requestId);
      setRequests((prev) =>
        prev.map((req) => (req._id === requestId ? { ...req, ...data } : req))
      );
      setSuccess('Request completed successfully');
    } catch (err) {
      setError(err.message || 'Failed to complete request');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (error) return <div className="text-red-500 text-center py-10">{error}</div>;
  if (success) return <div className="text-green-500 text-center py-10">{success}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Production Inventory & Requests</h1>

      {/* عرض المخزون */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Factory Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map((item) => (
            <div key={item._id} className="border p-4 rounded shadow">
              <p><strong>Product:</strong> {item.productName}</p>
              <p><strong>Stock:</strong> {item.currentStock}</p>
              <p><strong>Status:</strong> {item.status}</p>
              <p><strong>Unit:</strong> {item.unit}</p>
              <p><strong>Department:</strong> {item.departmentName}</p>
            </div>
          ))}
        </div>
      </div>

      {/* إنشاء طلب جديد */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Create New Production Request</h2>
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <select
            value={newRequest.type}
            onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}
            className="w-full p-2 border rounded"
          >
            <option value="branch">Branch</option>
            <option value="production">Production</option>
          </select>
          {newRequest.type === 'branch' && (
            <input
              type="text"
              placeholder="Branch ID"
              value={newRequest.branchId}
              onChange={(e) => setNewRequest({ ...newRequest, branchId: e.target.value })}
              className="w-full p-2 border rounded"
            />
          )}
          {newRequest.items.map((item, index) => (
            <div key={index} className="flex space-x-2">
              <input
                type="text"
                placeholder="Product ID"
                value={item.productId}
                onChange={(e) => updateItem(index, 'productId', e.target.value)}
                className="w-1/3 p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                className="w-1/3 p-2 border rounded"
                min="1"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="bg-red-500 text-white p-2 rounded"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="bg-blue-500 text-white p-2 rounded"
          >
            Add Item
          </button>
          <textarea
            placeholder="Notes"
            value={newRequest.notes}
            onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <button type="submit" className="bg-green-500 text-white p-2 rounded">
            Create Request
          </button>
        </form>
      </div>

      {/* قائمة الطلبات */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Production Requests</h2>
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div key={req._id} className="border p-4 rounded shadow">
              <p><strong>Type:</strong> {req.type}</p>
              <p><strong>Branch:</strong> {req.branchName}</p>
              <p><strong>Status:</strong> {req.status}</p>
              <p><strong>Items:</strong></p>
              <ul className="list-disc pl-5">
                {req.items.map((item, index) => (
                  <li key={index}>{item.productName} - {item.quantity}</li>
                ))}
              </ul>
              {req.status === 'pending' && (
                <select
                  onChange={(e) => handleAssignChef(req._id, e.target.value)}
                  className="w-full p-2 border rounded mt-2"
                >
                  <option value="">Assign Chef</option>
                  {chefs.map((chef) => (
                    <option key={chef.id} value={chef.id}>{chef.name}</option>
                  ))}
                </select>
              )}
              {req.status === 'in_progress' && (
                <button
                  onClick={() => handleCompleteRequest(req._id)}
                  className="bg-yellow-500 text-white p-2 rounded mt-2"
                >
                  Complete Request
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductionInventory;