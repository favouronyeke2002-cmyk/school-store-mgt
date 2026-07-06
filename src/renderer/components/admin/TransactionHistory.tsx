import React, { useState, useEffect } from "react";
import { transactionAPI, expenseAPI } from "../../lib/api";

interface Transaction {
  transaction_id: number | string;
  student_id?: string;
  shift_id?: number;
  type: string;
  amount_paid: number;
  payment_mode: string;
  timestamp: string;
  student_name?: string;
  student_class?: string;
  category?: string;
  description?: string;
}

const TransactionHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    searchTransactions();
  }, [typeFilter, paymentFilter]);

  const searchTransactions = async () => {
    setLoading(true);
    try {
      const [txnData, expenseData] = await Promise.all([
        transactionAPI.search({
          query,
          startDate,
          endDate,
          type: typeFilter === "EXPENSE" ? undefined : typeFilter,
          paymentMode: paymentFilter,
        }),
        typeFilter === "" || typeFilter === "EXPENSE"
          ? expenseAPI.getExpensesForHistory({
              startDate,
              endDate,
              paymentMode: paymentFilter === "Cash" ? "Cash Drawer" : paymentFilter === "POS_Transfer" ? "Bank Transfer" : undefined,
            })
          : Promise.resolve([]),
      ]);

      const allData = [...txnData, ...expenseData].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setTransactions(allData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const viewDetails = async (t: Transaction) => {
    setSelected(t);
    if (t.type === "EXPENSE") {
      setDetails({
        items: [],
        transaction: {
          type: "EXPENSE",
          amount_paid: t.amount_paid,
          payment_mode: t.payment_mode,
          category: t.category,
          description: t.description,
        },
      });
    } else {
      const d = await transactionAPI.getDetails(t.transaction_id as number);
      setDetails(d);
    }
  };

  const formatCurrency = (n: number) =>
    `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const total = transactions.reduce((s, t) => s + t.amount_paid, 0);
  const storeTotal = transactions
    .filter((t) => t.type === "STORE_PURCHASE")
    .reduce((s, t) => s + t.amount_paid, 0);
  const feesTotal = transactions
    .filter((t) => t.type === "FEES_CASH_COLLECTION")
    .reduce((s, t) => s + t.amount_paid, 0);
  const expensesTotal = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount_paid, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-gray-500">
            {transactions.length} transactions - Total: {formatCurrency(total)}
          </p>
        </div>
        <button
          onClick={() => {
            setQuery("");
            setStartDate("");
            setEndDate("");
            setTypeFilter("");
            setPaymentFilter("");
          }}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clear Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Transactions", value: transactions.length },
          { label: "Store Purchases", value: formatCurrency(storeTotal) },
          { label: "Fees Collected", value: formatCurrency(feesTotal) },
          { label: "Expenses", value: formatCurrency(expensesTotal), isExpense: true },
          { label: "Net Total", value: formatCurrency(total - expensesTotal) },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-5">
            <div className={`text-sm ${s.isExpense ? "text-red-500" : "text-gray-500"}`}>{s.label}</div>
            <div className={`text-2xl font-bold ${s.isExpense ? "text-red-600" : ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="col-span-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchTransactions()}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Search by name or student ID..."
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <button
            onClick={searchTransactions}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Search
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Types</option>
              <option value="STORE_PURCHASE">Store Purchase</option>
              <option value="FEES_CASH_COLLECTION">Fees Collection</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Payment:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="POS_Transfer">POS/Transfer</option>
            </select>
          </div>
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
                  Date/Time
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                  Payment
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
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.transaction_id}
                    className={`border-t hover:bg-gray-50 ${t.type === "EXPENSE" ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm">
                      #{t.transaction_id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{new Date(t.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {t.type === "EXPENSE" ? t.category : t.student_name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {t.type === "EXPENSE" ? (t.description || "—") : (t.student_id || "—")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.type === "EXPENSE" ? (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">
                          —
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs ${t.student_class === "—" || t.student_class === "New Admission" ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"}`}
                        >
                          {t.student_class}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          t.type === "EXPENSE"
                            ? "bg-red-100 text-red-700"
                            : t.type === "STORE_PURCHASE"
                              ? "bg-primary-100 text-primary-700"
                              : "bg-success-100 text-success-700"
                        }`}
                      >
                        {t.type === "EXPENSE" ? "Expense" : t.type === "STORE_PURCHASE" ? "Store" : "Fees"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.type === "EXPENSE" ? "Cash Drawer" : t.payment_mode}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${t.type === "EXPENSE" ? "text-red-600" : ""}`}>
                      {formatCurrency(t.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => viewDetails(t)}
                        className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selected && details && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selected.type === "EXPENSE" ? "Expense Details" : "Transaction Details"}
              </h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setDetails(null);
                }}
                className="text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">ID:</span> #
                {selected.transaction_id}
              </div>
              <div>
                <span className="text-gray-500">Date:</span>{" "}
                {new Date(selected.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="text-gray-500">Type:</span>{" "}
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    selected.type === "EXPENSE"
                      ? "bg-red-100 text-red-700"
                      : selected.type === "STORE_PURCHASE"
                        ? "bg-primary-100"
                        : "bg-success-100"
                  }`}
                >
                  {selected.type === "EXPENSE" ? "Expense" : selected.type}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Payment:</span>{" "}
                {selected.type === "EXPENSE" ? "Cash Drawer" : selected.payment_mode}
              </div>
            </div>

            {selected.type === "EXPENSE" ? (
              <div className="bg-red-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-500">Expense Details</div>
                <div className="font-bold text-lg">{selected.category}</div>
                {selected.description && (
                  <div className="text-sm text-gray-600">
                    {selected.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-primary-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-500">Customer Details</div>
                <div className="font-bold text-lg">{selected.student_name}</div>
                <div className="text-sm text-gray-600">
                  {selected.student_class}
                </div>
                {selected.student_id && (
                  <div className="text-xs font-mono text-gray-500">
                    {selected.student_id}
                  </div>
                )}
              </div>
            )}

            {details.items?.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Items</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="py-2 text-left">Item</th>
                        <th className="py-2 text-right">Qty</th>
                        <th className="py-2 text-right">Price</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.items.map((item: any) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2">{item.item_name}</td>
                          <td className="py-2 text-right">{item.quantity}</td>
                          <td className="py-2 text-right">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="border-t-2 pt-4 flex justify-between items-center text-lg font-bold">
              <span>{selected.type === "EXPENSE" ? "Amount" : "Total"}</span>
              <span className={selected.type === "EXPENSE" ? "text-red-600" : "text-primary-600"}>
                {formatCurrency(selected.amount_paid)}
              </span>
            </div>
            <div className="mt-4 text-xs text-gray-400 text-center">
              {selected.type === "EXPENSE" ? "Expenses" : "Transactions"} are immutable and cannot be modified.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
