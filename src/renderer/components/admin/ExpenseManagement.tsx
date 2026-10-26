import React, { useState, useEffect } from "react";
import {
  Wallet,
  AlertTriangle,
  X,
  Banknote,
  CreditCard,
  Plus,
  Trash2,
  Pencil,
  Tags,
} from "lucide-react";
import { expenseAPI, transactionAPI } from "../../lib/api";

const fmt = (n: number) =>
  `N${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ExpenseRecord {
  id: number;
  category: string;
  amount: number;
  payment_mode: string;
  description: string | null;
  created_at: string;
  shift_id: number | null;
}

const ExpenseManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(
    null,
  );
  const [editingCategory, setEditingCategory] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Bank Transfer">(
    "Cash",
  );
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await expenseAPI.getExpensesForHistory({});
      // Transform to match ExpenseRecord shape
      setExpenses(
        data.map((e: any) => ({
          id: e.expense_id,
          category: e.category,
          amount: e.amount_paid,
          payment_mode: e.payment_mode,
          description: e.description,
          created_at: e.timestamp,
          shift_id: e.shift_id,
        })),
      );
    } catch (err) {
      console.error(err);
      setError("Failed to load expenses");
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const data = await expenseAPI.getCategories();
      setCategories(data);
      setCategory((current) => current || data[0]?.name || "");
    } catch (err) {
      console.error(err);
      setError("Failed to load expense categories");
    }
  };

  const openExpenseEditor = (expense: ExpenseRecord) => {
    const date = new Date(expense.created_at);
    setEditingExpense(expense);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setPaymentMode(
      expense.payment_mode === "Cash Drawer" ? "Cash" : "Bank Transfer",
    );
    setDescription(expense.description || "");
    setExpenseDate(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
    setError("");
    setShowModal(true);
  };

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setCategory(categories[0]?.name || "");
    setAmount("");
    setDescription("");
    setPaymentMode("Cash");
    setExpenseDate("");
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    const result = editingCategory
      ? await expenseAPI.updateCategory(
          editingCategory.id,
          name,
          editingCategory.name,
        )
      : await expenseAPI.createCategory(name);
    if (result.success) {
      setCategoryName("");
      setEditingCategory(null);
      await loadCategories();
    } else {
      setError(result.error || "Failed to save category");
    }
    setCategorySaving(false);
  };

  const removeCategory = async (item: { id: number; name: string }) => {
    if (categories.length <= 1) {
      setError("At least one expense category must remain");
      return;
    }
    if (
      !window.confirm(
        `Delete the "${item.name}" category? Existing expenses will keep their saved category name.`,
      )
    )
      return;
    const result = await expenseAPI.deleteCategory(item.id);
    if (result.success) {
      if (category === item.name)
        setCategory(
          categories.find((entry) => entry.id !== item.id)?.name || "",
        );
      await loadCategories();
    } else {
      setError(result.error || "Failed to delete category");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount) || 0;
    if (!category || amountNum <= 0 || (editingExpense && !expenseDate)) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = editingExpense
        ? await expenseAPI.updateExpense(editingExpense.id, {
            category,
            amount: amountNum,
            paymentMode:
              paymentMode === "Cash" ? "Cash Drawer" : "Bank Transfer",
            description: description.trim() || undefined,
            date: expenseDate,
          })
        : await expenseAPI.addExpense({
            shiftId: undefined,
            category,
            amount: amountNum,
            paymentMode:
              paymentMode === "Cash" ? "Cash Drawer" : "Bank Transfer",
            description: description.trim() || undefined,
            createdBy: undefined,
          });

      if (result.success) {
        setSuccess(
          editingExpense
            ? "Expense updated successfully"
            : "Expense recorded successfully",
        );
        resetExpenseForm();
        setShowModal(false);
        loadExpenses();
      } else {
        setError((result as any).error || "Failed to record expense");
      }
    } catch (err) {
      setError("Error: " + (err as Error).message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense record?"))
      return;
    try {
      const result = await expenseAPI.deleteExpense(id);
      if (result.success) {
        loadExpenses();
      } else {
        setError((result as any).error || "Failed to delete expense");
      }
    } catch (err) {
      setError("Error: " + (err as Error).message);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (startDate && new Date(e.created_at) < new Date(startDate)) return false;
    if (endDate && new Date(e.created_at) > new Date(endDate + "T23:59:59"))
      return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (paymentFilter && e.payment_mode !== paymentFilter) return false;
    return true;
  });

  const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const cashTotal = filteredExpenses
    .filter((e) => e.payment_mode === "Cash Drawer")
    .reduce((s, e) => s + e.amount, 0);
  const bankTotal = filteredExpenses
    .filter((e) => e.payment_mode === "Bank Transfer")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Expense Management</h1>
          <p className="text-gray-500">
            Record and track school operational expenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Manage expense categories"
          >
            <Tags className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => {
              resetExpenseForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="text-2xl font-bold">{fmt(totalAmount)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Cash Payments</div>
          <div className="text-2xl font-bold text-warning-600">
            {fmt(cashTotal)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-gray-500">Bank Transfers</div>
          <div className="text-2xl font-bold text-primary-600">
            {fmt(bankTotal)}
          </div>
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
            placeholder="Start Date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            placeholder="End Date"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All Methods</option>
            <option value="Cash Drawer">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setCategoryFilter("");
              setPaymentFilter("");
            }}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Payment Method
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No expenses found
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">
                      #{expense.id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        {new Date(expense.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(expense.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 ${expense.payment_mode === "Cash Drawer" ? "text-warning-600" : "text-primary-600"}`}
                      >
                        {expense.payment_mode === "Cash Drawer" ? (
                          <Banknote className="w-4 h-4" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        {expense.payment_mode === "Cash Drawer"
                          ? "Cash"
                          : "Bank Transfer"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {expense.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-danger-600">
                      {fmt(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openExpenseEditor(expense)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="Edit expense"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
                <h2 className="text-lg font-bold">
                  {editingExpense ? "Edit Expense" : "Record Admin Expense"}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {category &&
                    !categories.some((item) => item.name === category) && (
                      <option value={category}>
                        {category} (saved record)
                      </option>
                    )}
                </select>
              </div>

              {editingExpense && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    N
                  </span>
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

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("Cash")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${
                      paymentMode === "Cash"
                        ? "bg-warning-50 border-warning-500 text-warning-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-warning-300"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("Bank Transfer")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${
                      paymentMode === "Bank Transfer"
                        ? "bg-primary-50 border-primary-500 text-primary-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-primary-300"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    POS / Bank Transfer
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="e.g. Payment for generator fuel"
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                <div className="font-medium text-gray-700 mb-1">
                  Admin Expense
                </div>
                This expense will be recorded as an administrative expense and
                is not tied to any cashier shift.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetExpenseForm();
                  }}
                  className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingExpense
                      ? "Save Changes"
                      : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Expense Categories</h2>
              <button
                onClick={() => {
                  setShowCategoryManager(false);
                  setEditingCategory(null);
                  setCategoryName("");
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close category manager"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Category name"
                aria-label="Category name"
                required
              />
              <button
                type="submit"
                disabled={categorySaving || !categoryName.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {editingCategory ? "Save" : "Add"}
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryName("");
                  }}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm"
                >
                  Cancel
                </button>
              )}
            </form>
            <div className="max-h-72 overflow-y-auto divide-y border-y">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-sm text-gray-800">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingCategory(item);
                        setCategoryName(item.name);
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                      title={`Edit ${item.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void removeCategory(item)}
                      className="p-1.5 text-gray-400 hover:text-danger-600 rounded"
                      title={`Delete ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagement;
