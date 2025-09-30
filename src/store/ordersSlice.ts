import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Order } from '../types/types';

interface OrdersState {
  orders: Order[];
  socketConnected: boolean;
  socketError: string | null;
}

const initialState: OrdersState = {
  orders: [],
  socketConnected: false,
  socketError: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    addOrder: (state, action: PayloadAction<Order>) => {
      state.orders.push(action.payload);
    },
    updateOrderStatus: (
      state,
      action: PayloadAction<{ orderId: string; status: string; payload?: Order }>
    ) => {
      const index = state.orders.findIndex((order) => order.id === action.payload.orderId);
      if (index !== -1) {
        if (action.payload.payload) {
          state.orders[index] = action.payload.payload;
        } else {
          state.orders[index].status = action.payload.status;
        }
      }
    },
    taskAssigned: (
      state,
      action: PayloadAction<{ orderId: string; items: Order['items'] }>
    ) => {
      const index = state.orders.findIndex((order) => order.id === action.payload.orderId);
      if (index !== -1) {
        state.orders[index].items = action.payload.items;
      }
    },
    updateItemStatus: (
      state,
      action: PayloadAction<{ orderId: string; itemId: string; status: string }>
    ) => {
      const index = state.orders.findIndex((order) => order.id === action.payload.orderId);
      if (index !== -1) {
        const itemIndex = state.orders[index].items.findIndex(
          (item) => item.itemId === action.payload.itemId
        );
        if (itemIndex !== -1) {
          state.orders[index].items[itemIndex].status = action.payload.status;
        }
      }
    },
    returnStatusUpdated: (
      state,
      action: PayloadAction<{ orderId: string; returnId: string; status: string }>
    ) => {
      const index = state.orders.findIndex((order) => order.id === action.payload.orderId);
      if (index !== -1) {
        const returnIndex = state.orders[index].returns.findIndex(
          (ret) => ret.returnId === action.payload.returnId
        );
        if (returnIndex !== -1) {
          state.orders[index].returns[returnIndex].status = action.payload.status;
        }
      }
    },
    missingAssignments: (
      state,
      action: PayloadAction<{ orderId: string; itemId: string; productName: string }>
    ) => {
      // يمكن إضافة منطق إضافي إذا لزم الأمر، مثل تسجيل العناصر غير المعينة
      console.log(`[${new Date().toISOString()}] Missing assignment:`, action.payload);
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },
    setSocketError: (state, action: PayloadAction<string | null>) => {
      state.socketError = action.payload;
    },
  },
});

export const {
  addOrder,
  updateOrderStatus,
  taskAssigned,
  updateItemStatus,
  returnStatusUpdated,
  missingAssignments,
  setSocketConnected,
  setSocketError,
} = ordersSlice.actions;

export default ordersSlice.reducer;