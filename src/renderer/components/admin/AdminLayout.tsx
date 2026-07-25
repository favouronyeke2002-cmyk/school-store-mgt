import React, { useState } from 'react';
import {
  LayoutDashboard, Users, Package, FileText, Clock, Settings,
  Upload, LogOut, ChevronRight, Store, DollarSign, Cog, Layers, UserPlus, Menu, X, Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Dashboard from './Dashboard';
import StudentManagement from './StudentManagement';
import InventoryManagement from './InventoryManagement';
import TransactionHistory from './TransactionHistory';
import ShiftHistory from './ShiftHistory';
import UserManagement from './UserManagement';
import BulkImport from './BulkImport';
import FeesManagement from './FeesManagement';
import SchoolSettings from './SchoolSettings';
import BundleManagement from './BundleManagement';
import PendingAdmissions from './PendingAdmissions';
import ExpenseManagement from './ExpenseManagement';

type AdminView = 'dashboard' | 'students' | 'inventory' | 'transactions' | 'shifts' | 'expenses' | 'fees' | 'bundles' | 'admissions' | 'users' | 'import' | 'settings';

const navItems: { id: AdminView; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'transactions', label: 'Transactions', icon: FileText, group: 'Overview' },
  { id: 'shifts', label: 'Shift History', icon: Clock, group: 'Overview' },
  { id: 'expenses', label: 'Expenses', icon: Wallet, group: 'Overview' },
  { id: 'inventory', label: 'Inventory', icon: Package, group: 'Store' },
  { id: 'bundles', label: 'Bundles', icon: Layers, group: 'Store' },
  { id: 'students', label: 'Students', icon: Users, group: 'People' },
  { id: 'admissions', label: 'Pending Admissions', icon: UserPlus, group: 'People' },
  { id: 'fees', label: 'Fees & Billing', icon: DollarSign, group: 'People' },
  { id: 'users', label: 'Staff', icon: Settings, group: 'Admin' },
  { id: 'import', label: 'Bulk Import', icon: Upload, group: 'Admin' },
  { id: 'settings', label: 'School Settings', icon: Cog, group: 'Admin' },
];

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [feesStudentId, setFeesStudentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigateTo = (view: string, studentId?: string) => {
    setCurrentView(view as AdminView);
    setFeesStudentId(view === 'fees' && studentId ? studentId : null);
  };

  const currentLabel = navItems.find((n) => n.id === currentView)?.label || '';

  const groups = ['Overview', 'Store', 'People', 'Admin'];

  const handleNavClick = (id: AdminView) => {
    setCurrentView(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex flex-col shrink-0
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">School POS</div>
              <div className="text-xs text-gray-400">Admin Panel</div>
            </div>
          </div>
          <button
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-3 overflow-auto">
          {groups.map((group) => {
            const items = navItems.filter((n) => n.group === group);
            return (
              <div key={group} className="mb-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">{group}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-all ${active ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 text-primary-400" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 mb-2">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{user?.username}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-gray-900">{currentLabel}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
            <span>School POS</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 font-medium">{currentLabel}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 md:p-6">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'students' && <StudentManagement onNavigate={navigateTo} />}
          {currentView === 'inventory' && <InventoryManagement />}
          {currentView === 'transactions' && <TransactionHistory />}
          {currentView === 'shifts' && <ShiftHistory />}
          {currentView === 'expenses' && <ExpenseManagement />}
          {currentView === 'fees' && <FeesManagement focusStudentId={feesStudentId} />}
          {currentView === 'bundles' && <BundleManagement />}
          {currentView === 'admissions' && <PendingAdmissions />}
          {currentView === 'users' && <UserManagement />}
          {currentView === 'import' && <BulkImport />}
          {currentView === 'settings' && <SchoolSettings />}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
