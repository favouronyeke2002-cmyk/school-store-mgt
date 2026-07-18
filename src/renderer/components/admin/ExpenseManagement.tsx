import React, { useState, useEffect } from 'react';
import { Wallet, AlertTriangle, X, Banknote, CreditCard, Plus, Trash2, User } from 'lucide-react';
import { expenseAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Supplies',
  'Maintenance',
  'Transportation',
  'Salaries',
  'Equipment',
  'Miscellaneous',
  'Other',
];

interface ExpenseRecord {
  id: number;
  category: string;
  amount: number;
  payment_mode: string;
  description: string | null;
  payee: string | null;
  created_at: string;
  shift_id: number | null;
}

// Map DB-stored payment_mode values to display labels
const paymentLabel = (mode: string) =>
  mode === 'Cash Drawer' ? 'Cash' : 'POS / Bank Transfer';

const ExpenseManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [category, setCategory] = useState('Other');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS / Bank Transfer'>('Cash');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  useEffect(() => { loadExpenses(); }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await expenseAPI.getExpensesForHistory({});
      setExpenses(data.map((e: any) => ({
        id: e.expense_id,
        category: e.category,
        amount: e.amount_paid,
        payment_mode: e.payment_mode,
        description: e.description,
        payee: e.payee ?? null,
        created_at: e.timestamp,
        shift_id: e.shift_id,
      })));
    } catch (err) {
      console.error(err);
      setError('Failed to load expenses');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount) || 0;
    if (!category || amountNum <= 0) {
      setError('Please fill in all required fields');
      return;
    }
    if (!payee.trim()) {
      setError('Payee / Vendor Name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await expenseAPI.addExpense({
        shiftId: undefined,
        category,
        amount: amountNum,
        paymentMode: paymentMode === 'Cash' ? 'Cash Drawer' : 'Bank Transfer',
        description: description.trim() || undefined,
        payee: payee.trim(),
        createdBy: undefined,
      });

      if (result.success) {
        setSuccess('Expense recorded successfully');
        setCategory('Other');
        setAmount('');
        setDescription('');
        setPayee('');
        setPaymentMode('Cash');
        setShowModal(false);
        loadExpenses();
      } else {
        setError((result as any).error || 'Failed to record expense');
      }
    } catch (err) {
      setError('Error: ' + (err as Error).message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const result = await expenseAPI.deleteExpense(id);
      if (result.success) {
        loadExpenses();
      } else {
        setError((result as any).error || 'Failed to delete expense');
      }
    } catch (err) {
      setError('Error: ' + (err as Error).message);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (startDate && new Date(e.created_at) < new Date(startDate)) return false;
    if (endDate && new Date(e.created_at) > new Date(endDate + 'T23:59:59')) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (paymentFilter && e.payment_mode !== paymentFilter) return false;
    return true;
  });

  const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const cashTotal = filteredExpenses.filter(e => e.payment_mode === 'Cash Drawer').reduce((s, e) => s + e.amount, 0);
  const bankTotal = filteredExpenses.filter(e => e.payment_mode === 'Bank Transfer').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Expense Management</h1>
          <p className="text-gray-500">Record and track school operational expenses</p>
        </div>
        <button
          onClick={() => { setError(''); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="text-2xl font-bold text-danger-600">{fmt(totalAmount)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Cash Payments</div>
          <div className="text-2xl font-bold text-warning-600">{fmt(cashTotal)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">POS / Bank Transfers</div>
          <div className="text-2xl font-bold text-primary-600">{fmt(bankTotal)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Record Count</div>
          <div className="text-2xl font-bold">{filteredExpenses.length}</div>
        </div>
      </div>

      {/* Error/Success alerts */}
      {error && (
        <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-success-50 text-success-700 text-sm rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-5 gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Methods</option>
            <option value="Cash Drawer">Cash</option>
            <option value="Bank Transfer">POS / Bank Transfer</option>
          </select>
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setCategoryFilter(''); setPaymentFilter(''); }}
            className="px-4 py-2 bg-gray-100 rounded-md text-sm hover:bg-gray-200"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Payee / Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No expenses found</td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">#{expense.id}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>{new Date(expense.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(expense.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-medium">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {expense.payee || <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 ${expense.payment_mode === 'Cash Drawer' ? 'text-warning-600' : 'text-primary-600'}`}>
                        {expense.payment_mode === 'Cash Drawer' ? (
                          <Banknote className="w-4 h-4" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        {paymentLabel(expense.payment_mode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {expense.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-danger-600">
                      {fmt(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-danger-600" />
                </div>
                <h2 className="text-lg font-bold">Record Admin Expense</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Payee / Vendor Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Payee / Vendor Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="e.g. Mandy Catering Services, Power Company"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:border-primary-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('Cash')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${
                      paymentMode === 'Cash'
                        ? 'bg-warning-50 border-warning-500 text-warning-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-warning-300'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('POS / Bank Transfer')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${
                      paymentMode === 'POS / Bank Transfer'
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-primary-300'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    POS / Bank Transfer
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="e.g. Monthly generator fuel refill"
                />
              </div>

              {error && (
                <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                <div className="font-medium text-gray-700 mb-1">Admin Expense</div>
                This expense will be recorded as an administrative expense and is not tied to any cashier shift.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !amount || parseFloat(amount) <= 0 || !payee.trim()}
                  className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700 disabled:opacity-50"
                >
                  {saving ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;
