import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShiftProvider } from './context/ShiftContext';
import LoginPage from './components/auth/LoginPage';
import CashierLayout from './components/cashier/CashierLayout';
import AdminLayout from './components/admin/AdminLayout';
import { isSupabaseConfigured } from './lib/supabase';
import { Database, Key, CheckCircle, ShieldCheck } from 'lucide-react';
import './styles/index.css';

function SupabaseSetupScreen() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">School POS & Store Management</h1>
            <p className="text-sm text-slate-400">Database Connection Setup</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm text-amber-300 space-y-1">
          <p className="font-semibold">Supabase credentials are not configured yet.</p>
          <p className="text-amber-200/80 text-xs">
            To bring the application live, configure your Supabase project API credentials.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Quick Setup Steps</h2>
          
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
              <p>
                Open your <strong className="text-white">Supabase Dashboard</strong> and go to <strong className="text-white">Project Settings &rarr; API</strong>.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
              <p>
                Copy your <strong className="text-white">Project URL</strong> and <strong className="text-white">anon / public API key</strong>.
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
              <p>
                Create a <code className="bg-slate-900 px-1.5 py-0.5 rounded text-blue-300">.env</code> file in the project folder with:
              </p>
            </div>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-700 text-xs font-mono text-emerald-400 overflow-x-auto select-all">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
          </pre>

          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 space-y-2">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Database Migrations</span>
            </div>
            <p className="text-slate-400">
              Run the SQL migrations located in <code className="text-blue-300">supabase/migrations/</code> in your Supabase SQL Editor. This will generate all the tables, security policies, and default accounts.
            </p>
            <div className="pt-1 text-slate-400">
              Default logins: <span className="text-emerald-300 font-semibold">Admin:</span> admin / admin123 &bull; <span className="text-emerald-300 font-semibold">Cashier PIN:</span> 1234
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<'admin' | 'cashier' | 'none'>('none');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        setView('admin');
      } else if (user.role === 'cashier' || user.role === 'store_keeper') {
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
  if (!isSupabaseConfigured) {
    return <SupabaseSetupScreen />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
