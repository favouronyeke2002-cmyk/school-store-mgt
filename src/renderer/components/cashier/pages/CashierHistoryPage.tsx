import React from "react";
import {
  Banknote,
  CreditCard,
  Printer,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

const fmt = (n: number) =>
  `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CashierHistoryPage: React.FC<any> = ({
  activeShift,
  classes,
  historyTxns,
  historySearch,
  setHistorySearch,
  historyClass,
  setHistoryClass,
  shiftExpenses,
  handleReprint,
  setShowExpenseModal,
  setExpenseError,
  transactionAPI,
  expenseAPI,
  setHistoryTxns,
  setShiftExpenses,
}) => {
  const shiftCash = historyTxns
    .filter((t: any) => t.payment_mode === "Cash" && t.status !== "VOIDED")
    .reduce((s: number, t: any) => s + Number(t.amount_paid), 0);
  const shiftPOS = historyTxns
    .filter(
      (t: any) => t.payment_mode === "POS_Transfer" && t.status !== "VOIDED",
    )
    .reduce((s: number, t: any) => s + Number(t.amount_paid), 0);

  const filteredHistory = historyTxns.filter((t: any) => {
    if (historyClass !== "all" && t.student_class !== historyClass)
      return false;
    if (historySearch) {
      const q = historySearch.toLowerCase();
      if (!t.student_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Shift Log</h1>
          <p className="text-sm text-gray-400">
            Shift #{activeShift.id} ·{" "}
            {new Date(activeShift.opened_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowExpenseModal(true);
              setExpenseError("");
            }}
            className="flex items-center gap-2 px-3 py-2 bg-warning-600 text-white rounded-lg text-sm font-semibold hover:bg-warning-700"
          >
            <Wallet className="w-4 h-4" /> Record Expense
          </button>
          <button
            onClick={() => {
              transactionAPI
                .getHistory({})
                .then((d: any[]) =>
                  setHistoryTxns(
                    d.filter((t: any) => t.shift_id === activeShift.id),
                  ),
                );
              expenseAPI
                .getExpensesByShift(activeShift.id)
                .then(setShiftExpenses);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            placeholder="Search by student name…"
          />
        </div>
        <select
          value={historyClass}
          onChange={(e) => setHistoryClass(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="all">All Classes</option>
          {classes.map((c: string) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-5">
        <div className="px-5 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-900">Expected Cash Calculation</h2>
          <p className="text-xs text-gray-500">
            How your expected closing cash is computed
          </p>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Opening Cash (Float)</span>
            <span className="font-bold">{fmt(activeShift.opening_cash)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">+ Total Cash Sales</span>
            <span className="font-bold text-success-600">
              + {fmt(shiftCash)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">
              = Cash in Drawer (before expenses)
            </span>
            <span className="font-bold">
              {fmt(activeShift.opening_cash + shiftCash)}
            </span>
          </div>
          <div className="border-t border-dashed pt-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">- Cash Expenses</span>
              <span className="font-bold text-danger-600">
                -{" "}
                {fmt(
                  shiftExpenses
                    .filter((e: any) => e.payment_mode === "Cash Drawer")
                    .reduce((s: number, e: any) => s + Number(e.amount), 0),
                )}
              </span>
            </div>
          </div>
          <div className="border-t-2 pt-3 flex justify-between items-center bg-primary-50 -mx-5 px-5 py-3">
            <span className="font-bold text-gray-900">
              Expected Closing Cash
            </span>
            <span className="text-2xl font-extrabold text-primary-600">
              {fmt(
                activeShift.opening_cash +
                  shiftCash -
                  shiftExpenses
                    .filter((e: any) => e.payment_mode === "Cash Drawer")
                    .reduce((s: number, e: any) => s + Number(e.amount), 0),
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Opening Cash", val: fmt(activeShift.opening_cash) },
          {
            label: "Cash Sales",
            val: fmt(shiftCash),
            color: "text-success-700",
          },
          {
            label: "POS / Transfer",
            val: fmt(shiftPOS),
            color: "text-primary-700",
          },
          {
            label: "Cash Expenses",
            val: fmt(
              shiftExpenses
                .filter((e: any) => e.payment_mode === "Cash Drawer")
                .reduce((s: number, e: any) => s + Number(e.amount), 0),
            ),
            color: "text-danger-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-5 shadow-sm border"
          >
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">
              {s.label}
            </div>
            <div className={`text-2xl font-extrabold ${s.color || ""}`}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {shiftExpenses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-5">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Expenses ({shiftExpenses.length})</h2>
            <span className="text-sm font-bold text-danger-600">
              Total:{" "}
              {fmt(
                shiftExpenses.reduce(
                  (s: number, e: any) => s + Number(e.amount),
                  0,
                ),
              )}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Payment
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {shiftExpenses.map((e: any) => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{e.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.payment_mode === "Cash Drawer" ? "bg-warning-100 text-warning-700" : "bg-primary-100 text-primary-700"}`}
                    >
                      {e.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-danger-600">
                    {fmt(Number(e.amount))}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {e.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(e.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold">Transactions ({filteredHistory.length})</h2>
          <span className="text-sm font-bold text-gray-600">
            Total:{" "}
            {fmt(
              filteredHistory
                .filter((t: any) => t.status !== "VOIDED")
                .reduce((s: number, t: any) => s + Number(t.amount_paid), 0),
            )}
          </span>
        </div>
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No transactions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Time", "Student", "Type", "Method", "Amount", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-xs font-medium text-gray-500 ${h === "Amount" ? "text-right" : h === "" ? "text-center" : "text-left"}`}
                      >
                        {h || "Receipt"}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((t: any) => {
                  const isVoided = t.status === "VOIDED";
                  return (
                    <tr
                      key={t.transaction_id}
                      className={`border-t hover:bg-gray-50 ${isVoided ? "opacity-60 bg-red-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span
                          className={
                            isVoided ? "line-through text-gray-400" : ""
                          }
                        >
                          {t.student_name}
                        </span>
                        {isVoided && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-100 text-danger-700">
                            VOIDED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.type === "STORE_PURCHASE" ? "bg-primary-100 text-primary-700" : t.type === "REGISTRATION_PAYMENT" ? "bg-warning-100 text-warning-700" : "bg-success-100 text-success-700"}`}
                        >
                          {t.type === "STORE_PURCHASE"
                            ? "Store"
                            : t.type === "REGISTRATION_PAYMENT"
                              ? "Reg."
                              : "Fees"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`flex items-center gap-1 text-xs font-medium ${t.payment_mode === "Cash" ? "text-success-700" : "text-primary-700"}`}
                        >
                          {t.payment_mode === "Cash" ? (
                            <Banknote className="w-3 h-3" />
                          ) : (
                            <CreditCard className="w-3 h-3" />
                          )}
                          {t.payment_mode === "Cash" ? "Cash" : "POS"}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${isVoided ? "line-through text-gray-400" : ""}`}
                      >
                        {fmt(Number(t.amount_paid))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isVoided && (
                          <button
                            onClick={() => handleReprint(t.transaction_id)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Reprint Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierHistoryPage;
