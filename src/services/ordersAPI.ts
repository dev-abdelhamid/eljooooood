import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

interface OrderItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    unit: string;
    department: {
      _id: string;
      name: string;
      code: string;
    };
  };
  quantity: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedTo?: {
    _id: string;
    username: string;
    name: string;
    department: {
      _id: string;
      name: string;
      code: string;
    };
  };
}

interface Order {
  _id: string;
  orderNumber: string;
  branch: {
    _id: string;
    name: string;
  };
  items: OrderItem[];
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered';
  statusHistory: Array<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes: string;
  }>;
}

interface Assignment {
  _id: string;
  order: {
    _id: string;
    orderNumber: string;
  };
  product: {
    _id: string;
    name: string;
    unit: string;
    department: {
      _id: string;
      name: string;
      code: string;
    };
  };
  chef: {
    _id: string;
    username: string;
    name: string;
    department: {
      _id: string;
      name: string;
      code: string;
    };
  };
  quantity: number;
  itemId: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface Notification {
  _id: string;
  user: {
    _id: string;
    username: string;
    name: string;
    role: string;
    branch?: {
      _id: string;
      name: string;
    };
    department?: {
      _id: string;
      name: string;
      code: string;
    };
  };
  type: 'orderCreated' | 'orderCompleted' | 'taskAssigned' | 'taskStarted' | 'taskCompleted' | 'orderApproved' | 'orderInTransit' | 'orderDelivered' | 'branchConfirmedReceipt' | 'orderStatusUpdated';
  message: string;
  data: {
    orderId?: string;
    orderNumber?: string;
    taskId?: string;
    branchId?: string;
    branchName?: string;
    chefId?: string;
    productId?: string;
    productName?: string;
    quantity?: number;
    itemId?: string;
    eventId?: string;
    status?: string;
    items?: Array<{
      _id: string;
      product: {
        _id: string;
        name: string;
        unit: string;
        department: {
          _id: string;
          name: string;
          code: string;
        };
      };
      assignedTo?: {
        _id: string;
        username: string;
        name: string;
        department: {
          _id: string;
          name: string;
          code: string;
        };
      };
      status: 'pending' | 'assigned' | 'in_progress' | 'completed';
      quantity: number;
    }>;
  };
  read: boolean;
  createdAt: string;
  sound: string;
  soundType: string;
  vibrate: number[];
  timestamp: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const ordersAPI = {
  async getAllOrders(): Promise<ApiResponse<Order[]>> {
    try {
      const response: AxiosResponse = await axios.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error fetching orders:`, error);
      return { success: false, message: 'خطأ في جلب الطلبات', error: error.message };
    }
  },

  async getOrderById(id: string): Promise<ApiResponse<Order>> {
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, message: 'معرف الطلب غير صالح' };
      }
      const response: AxiosResponse = await axios.get(`${API_BASE_URL}/orders/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error fetching order ${id}:`, error);
      return { success: false, message: 'خطأ في جلب الطلب', error: error.message };
    }
  },

  async createOrder(orderData: { branch: string; items: Array<{ product: string; quantity: number }> }): Promise<ApiResponse<Order>> {
    try {
      if (!orderData.branch.match(/^[0-9a-fA-F]{24}$/) || !orderData.items.every(item => item.product.match(/^[0-9a-fA-F]{24}$/) && item.quantity > 0)) {
        return { success: false, message: 'بيانات الطلب غير صالحة' };
      }
      const response: AxiosResponse = await axios.post(`${API_BASE_URL}/orders`, orderData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error creating order:`, error);
      return { success: false, message: 'خطأ في إنشاء الطلب', error: error.message };
    }
  },

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/) || !['pending', 'approved', 'in_production', 'completed', 'in_transit', 'delivered'].includes(status)) {
        return { success: false, message: 'معرف الطلب أو الحالة غير صالحة' };
      }
      const response: AxiosResponse = await axios.patch(`${API_BASE_URL}/orders/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error updating order status ${id}:`, error);
      return { success: false, message: 'خطأ في تحديث حالة الطلب', error: error.message };
    }
  },

  async assignChef(orderId: string, items: Array<{ itemId: string; assignedTo: string; productId: string; quantity: number }>): Promise<ApiResponse<Assignment[]>> {
    try {
      if (!orderId.match(/^[0-9a-fA-F]{24}$/) || !items.every(item => 
        item.itemId.match(/^[0-9a-fA-F]{24}$/) && 
        item.assignedTo.match(/^[0-9a-fA-F]{24}$/) && 
        item.productId.match(/^[0-9a-fA-F]{24}$/) && 
        item.quantity > 0
      )) {
        return { success: false, message: 'بيانات التعيين غير صالحة' };
      }
      const response: AxiosResponse = await axios.patch(`${API_BASE_URL}/orders/${orderId}/assign`, { items }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data.assignments };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error assigning chefs for order ${orderId}:`, error);
      return { success: false, message: 'خطأ في تعيين الشيفات', error: error.message };
    }
  },

  async confirmDelivery(id: string): Promise<ApiResponse<Order>> {
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, message: 'معرف الطلب غير صالح' };
      }
      const response: AxiosResponse = await axios.patch(`${API_BASE_URL}/orders/${id}/confirm-delivery`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error confirming delivery for order ${id}:`, error);
      return { success: false, message: 'خطأ في تأكيد التسليم', error: error.message };
    }
  },

  async getTasks(): Promise<ApiResponse<Assignment[]>> {
    try {
      const response: AxiosResponse = await axios.get(`${API_BASE_URL}/orders/tasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data.tasks };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error fetching tasks:`, error);
      return { success: false, message: 'خطأ في جلب المهام', error: error.message };
    }
  },

  async getChefTasks(chefId: string): Promise<ApiResponse<Assignment[]>> {
    try {
      if (!chefId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, message: 'معرف الشيف غير صالح' };
      }
      const response: AxiosResponse = await axios.get(`${API_BASE_URL}/orders/tasks/chef/${chefId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data.tasks };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error fetching chef tasks ${chefId}:`, error);
      return { success: false, message: 'خطأ في جلب مهام الشيف', error: error.message };
    }
  },

  async createTask(taskData: { order: string; product: string; chef: string; quantity: number; itemId: string }): Promise<ApiResponse<Assignment>> {
    try {
      if (!taskData.order.match(/^[0-9a-fA-F]{24}$/) ||
          !taskData.product.match(/^[0-9a-fA-F]{24}$/) ||
          !taskData.chef.match(/^[0-9a-fA-F]{24}$/) ||
          !taskData.itemId.match(/^[0-9a-fA-F]{24}$/) ||
          taskData.quantity <= 0) {
        return { success: false, message: 'بيانات المهمة غير صالحة' };
      }
      const response: AxiosResponse = await axios.post(`${API_BASE_URL}/orders/tasks`, taskData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data.assignment };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error creating task:`, error);
      return { success: false, message: 'خطأ في إنشاء المهمة', error: error.message };
    }
  },

  async updateTaskStatus(orderId: string, taskId: string, status: 'pending' | 'in_progress' | 'completed'): Promise<ApiResponse<Assignment>> {
    try {
      if (!orderId.match(/^[0-9a-fA-F]{24}$/) || !taskId.match(/^[0-9a-fA-F]{24}$/) || !['pending', 'in_progress', 'completed'].includes(status)) {
        return { success: false, message: 'معرف الطلب أو المهمة أو الحالة غير صالحة' };
      }
      const response: AxiosResponse = await axios.patch(`${API_BASE_URL}/orders/${orderId}/tasks/${taskId}/status`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      return { success: true, data: response.data.task };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error updating task status ${taskId}:`, error);
      return { success: false, message: 'خطأ في تحديث حالة المهمة', error: error.message };
    }
  }
};

export default ordersAPI;