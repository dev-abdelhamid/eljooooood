// Updated App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { OrderDetailsPage } from './pages/OrderDetailsPage';
import { NewOrder } from './pages/NewOrder';
import { ChefTasks } from './pages/ChefTasks';
import ProductionReport from './pages/ProductionReport';
import { Chefs } from './pages/Chefs';
import { Departments } from './pages/Departments';
import { Branches } from './pages/Branches';
import BranchOrders from './pages/BranchOrders';
import BranchReturns from './pages/BranchReturns';
import { Users } from './pages/Users';
import { BranchInventory } from './pages/BranchInventory';
import SalesReport from './pages/SalesReport';
import BranchSalesReport from './pages/BranchSalesReport';
import CreateSale from './pages/CreateSale';
import  AdminSalesReport   from './pages/AdminSalesReport';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Chefstatics from './pages/Chefstatics';
import BranchProfile from './pages/BranchProfile';
import { ChefDetails } from './pages/ChefDetails';
import BranchSalesAnalytics from './pages/BranchSalesAnalytics';
import SalesAnalytics from './pages/SalesAnalytics';
import ReturnStats from './pages/ReturnStats';
import InventoryOrders from './pages/InventoryOrders';
import { FactoryInventory } from './pages/FactoryInventory';
import DailyOrdersSummary from './pages/DailyOrdersSummary';

// New imports for separate pages
import OrdersTablePage from './pages/OrdersTablePage';
import { FactoryOrders } from './pages/InventoryOrders';



// إعداد QueryClient لإدارة الاستعلامات
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 دقائق
      retry: 2,
    },
    mutations: {
      retry: 2,
    },
  },
});

// مكون لحماية المسارات المقيدة
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// مكون محتوى التطبيق مع التوجيه
function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/orders/:id" element={<OrderDetailsPage />} />
                  <Route path="/orders/new" element={<NewOrder />} />
                  <Route path="/orders/review" element={<Orders />} />
                  <Route path="/returns" element={<BranchReturns />} />
                  <Route path="/production-report" element={<ProductionReport />} />
                  <Route path="/FactoryInventory" element={<FactoryInventory />} />
                  <Route path="/InventoryOrders" element={<InventoryOrders />} />
                  <Route path="/production-tasks" element={<ChefTasks />} />
                  <Route path="/branches" element={<Branches />} />
                  <Route path="/branch-inventory" element={<BranchInventory />} />
                  <Route path="/branch-sales" element={<BranchSalesReport />} />
                  <Route path="/branch-returns" element={<BranchReturns />} />
                  <Route path="/branch-sales/new" element={<CreateSale />} />
                  <Route path="/branch-sales/analytics" element={<BranchSalesAnalytics />} />
                  <Route path="/reports" element={<SalesAnalytics />} />
                  <Route path="/admin-sales" element={<AdminSalesReport />} />
                  <Route path="/returnStats" element={<ReturnStats />} />
                  <Route path="/dailyOrdersSummary" element={<DailyOrdersSummary />} />
                  <Route path="/branch-orders" element={<BranchOrders />} />
                  <Route path="/chefstatics" element={<Chefstatics />} />
                  <Route path="/chefs" element={<Chefs />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/chefs/:id" element={<ChefDetails />} />
                  <Route path="/branches/:id" element={<BranchProfile />} />
                  <Route path="/departments" element={<Departments />} />
                  <Route path="/inventory" element={<div className="p-8 text-center">قريباً: إدارة المخزون</div>} />
                  <Route path="/sales" element={<SalesReport />} />
                  <Route path="/reports" element={<div className="p-8 text-center">قريباً: التقارير والتحليلات</div>} />
                  <Route path="/settings" element={<div className="p-8 text-center">قريباً: الإعدادات</div>} />

                  {/* New separate pages */}
                  <Route path="/daily-orders" element={<OrdersTablePage />} />
                
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

// مكون التطبيق الرئيسي
function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
         <SocketProvider>
            <NotificationProvider>
              <AppContent />
              <ToastContainer
                position="top-left"
                autoClose={4000}
                newestOnTop
                rtl={true}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                className="font-arabic"
              />
            </NotificationProvider>
          </SocketProvider>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;