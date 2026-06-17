import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShiftProvider } from './context/ShiftContext';
import LoginPage from './components/auth/LoginPage';
import CashierLayout from './components/cashier/CashierLayout';
import AdminLayout from './components/admin/AdminLayout';
import './styles/index.css';

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<'admin' | 'cashier' | 'none'>('none');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        setView('admin');
      } else if (user.role === 'cashier') {
        setView('cashier');
      }
    } else {
      setView('none');
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || view === 'none') {
    return <LoginPage />;
  }

  if (view === 'admin') {
    return <AdminLayout />;
  }

  if (view === 'cashier') {
    return (
      <ShiftProvider>
        <CashierLayout />
      </ShiftProvider>
    );
  }

  return <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
