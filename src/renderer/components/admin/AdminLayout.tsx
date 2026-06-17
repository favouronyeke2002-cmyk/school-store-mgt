import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Dashboard from './Dashboard';
import StudentManagement from './StudentManagement';
import InventoryManagement from './InventoryManagement';
import TransactionHistory from './TransactionHistory';
import ShiftHistory from './ShiftHistory';
import UserManagement from './UserManagement';
import BulkImport from './BulkImport';

type AdminView = 'dashboard' | 'students' | 'inventory' | 'transactions' | 'shifts' | 'users' | 'import';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { id: 'students', label: 'Students', icon: 'users' },
    { id: 'inventory', label: 'Inventory', icon: 'package' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt' },
    { id: 'shifts', label: 'Shift History', icon: 'clock' },
    { id: 'users', label: 'User Management', icon: 'settings' },
    { id: 'import', label: 'Bulk Import', icon: 'upload' },
  ];

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'chart': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
      case 'users': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
      case 'package': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
      case 'receipt': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
      case 'clock': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'settings': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
      case 'upload': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Admin Panel</h1>
              <p className="text-xs text-gray-400">School POS System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setCurrentView(item.id as AdminView)} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${currentView === item.id ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
              {renderIcon(item.icon)}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-medium">{user?.username?.charAt(0).toUpperCase()}</div>
            <div>
              <div className="text-sm font-medium">{user?.username}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full py-2 bg-danger-600 text-white rounded text-sm hover:bg-danger-700">Log Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'students' && <StudentManagement />}
          {currentView === 'inventory' && <InventoryManagement />}
          {currentView === 'transactions' && <TransactionHistory />}
          {currentView === 'shifts' && <ShiftHistory />}
          {currentView === 'users' && <UserManagement />}
          {currentView === 'import' && <BulkImport />}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
