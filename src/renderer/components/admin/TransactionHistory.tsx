import React, { useState, useEffect, useMemo } from "react";
import { Printer, Save, CheckCircle } from "lucide-react";
import { transactionAPI, expenseAPI, settingsAPI } from "../../lib/api";

// ─── Receipt printer (mirrors CashierPOS logic) ───────────────────────────────
function printReceipt(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { iframe.contentWindow?.print(); } finally {
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }
  }, 300);
}

const fmtCurrency = (n: number) =>
  `₦${(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildReceiptHtml(
  settings: any,
  txn: any,
  total: number,
  items: any[],
  isFees = false,
  isRegistration = false,
): string {
  const schoolName = settings?.school_name || "School Store";
  const tagline = settings?.tagline || "";
  const address = settings?.address || "";
  const phone = settings?.phone_number || "";
  const session = [settings?.academic_session, settings?.current_term].filter(Boolean).join(" · ");
  const logo = settings?.logo_url || "";

  const itemsHtml =
    items.length > 0
      ? `<div class="section-title">ITEMS</div>` +
        items
          .map(
            (i: any) =>
              `<div class="row item-row"><span class="item-name">${i.item_name}${i.quantity > 1 ? " x" + i.quantity : " x 1"}</span></div>`,
          )
          .join("")
      : "";

  const balanceDueHtml =
    txn.balance_due && txn.balance_due > 0
      ? `<div class="divider"></div><div class="row bold total-row"><span>TOTAL PAID:</span><span>${fmtCurrency(total)}</span></div><div class="row bold balance-row"><span>BALANCE DUE:</span><span>${fmtCurrency(txn.balance_due)}</span></div>`
      : "";

  const paymentLabel =
    txn.payment_mode === "POS_Transfer"
      ? "POS / Transfer"
      : txn.payment_mode === "Bank_Transfer"
        ? "Bank Transfer"
        : "Cash";

  return `<!DOCTYPE html><html><head><title>Receipt</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;color:#000000 !important;-webkit-text-fill-color:#000000 !important;opacity:1 !important;-webkit-font-smoothing:none !important;-moz-osx-font-smoothing:none !important;text-shadow:none !important}
    body{font-family:'Courier New',monospace;width:58mm;padding:2mm;font-size:12px;font-weight:600;line-height:1.4}
    .center{text-align:center}
    .bold{font-weight:800}
    .large{font-size:16px;font-weight:900}
    .divider{border-top:1.5px dashed #000;margin:6px 0}
    .divider2{border-top:2px solid #000;margin:6px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0;font-weight:600}
    .item-row{font-weight:700;margin:2px 0}
    .item-name{flex:1;text-align:left;word-break:break-word}
    .section-title{font-size:11px;font-weight:900;margin:6px 0 3px;padding-bottom:2px;border-bottom:1px solid #000}
    .total-row{font-size:14px;font-weight:900}
    .balance-row{font-size:14px;font-weight:900;color:#000000 !important}
    img{max-width:50px;max-height:50px;object-fit:contain}
    .header-text{font-weight:700}
  </style></head><body>
  <div class="center">
    ${logo ? `<img src="${logo}" alt="logo" style="display:block;margin:0 auto 2px"/>` : ""}
    <div class="bold large">${schoolName}</div>
    ${tagline ? `<div class="header-text" style="font-size:11px">${tagline}</div>` : ""}
    ${session ? `<div class="header-text" style="font-size:10px">${session}</div>` : ""}
  </div>
  <div class="divider"></div>
  <div class="row"><span>Receipt #${txn.transaction_id}</span><span>${new Date(txn.timestamp).toLocaleDateString()}</span></div>
  <div class="row"><span>Time:</span><span>${new Date(txn.timestamp).toLocaleTimeString()}</span></div>
  <div class="row"><span>Student:</span><span>${txn.customer_name || txn.student_name || "Walk-in Applicant"}</span></div>
  <div class="row"><span>Class:</span><span>${txn.target_class || txn.student_class || "N/A"}</span></div>
  <div class="divider"></div>
  ${isFees && !isRegistration && items.length === 0
    ? `<div class="row bold"><span>${txn.fee_type_name || "School Fees"}</span><span>${fmtCurrency(total)}</span></div>`
    : itemsHtml}
  ${balanceDueHtml}
  <div class="divider2"></div>
  <div class="row bold large"><span>TOTAL:</span><span>${fmtCurrency(total)}</span></div>
  <div class="row"><span>Payment:</span><span>${paymentLabel}</span></div>
  <div class="divider"></div>
  <div class="center" style="font-size:10px;font-weight:600">
    ${address ? `<div>${address}</div>` : ""}
    ${phone ? `<div>Tel: ${phone}</div>` : ""}
    <div style="margin-top:4px;font-weight:700">Thank you!</div>
    <div class="bold">*** END OF RECEIPT ***</div>
  </div>
  </body></html>`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TRANSACTION_TYPES = [
  { value: "STORE_PURCHASE", label: "Store Purchase" },
  { value: "FEES_CASH_COLLECTION", label: "Fees Collection" },
  { value: "ACCEPTANCE_FEE", label: "Acceptance Fee" },
  { value: "BUNDLE_PURCHASE", label: "Bundle Purchase" },
];

const PAYMENT_MODES = [
  { value: "Cash", label: "Cash" },
  { value: "POS_Transfer", label: "POS / Transfer" },
  { value: "Bank_Transfer", label: "Bank Transfer" },
];

const BUNDLE_TYPES = new Set(["ACCEPTANCE_FEE", "BUNDLE_PURCHASE"]);

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────
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
  const [settings, setSettings] = useState<any>(null);

  // Edit state (type + payment mode correction)
  const [editType, setEditType] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    searchTransactions();
  }, [typeFilter, paymentFilter]);

  useEffect(() => {
    settingsAPI.get().then(setSettings).catch(console.error);
  }, []);

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
              paymentMode:
                paymentFilter === "Cash"
                  ? "Cash Drawer"
                  : paymentFilter === "POS_Transfer"
                    ? "Bank Transfer"
                    : undefined,
            })
          : Promise.resolve([]),
      ]);

      const allData = [...txnData, ...expenseData].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setTransactions(allData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const viewDetails = async (t: Transaction) => {
    setSelected(t);
    setEditType(t.type);
    setEditPaymentMode(t.payment_mode);
    setSaveError("");
    setSaveSuccess(false);

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

  const closeModal = () => {
    setSelected(null);
    setDetails(null);
    setSaveError("");
    setSaveSuccess(false);
  };

  // ── Bundle overhead injection ──────────────────────────────────────────────
  // For bundle transactions (ACCEPTANCE_FEE, BUNDLE_PURCHASE), if the sum of
  // physical inventory items is less than the total paid, inject a balancing
  // "overhead" service line so that the itemised subtotal equals the grand total.
  const displayItems = useMemo(() => {
    if (!details?.items || !selected) return [];
    const items: any[] = details.items;

    if (!BUNDLE_TYPES.has(editType) || items.length === 0) return items;

    const itemSum = items.reduce((s: number, i: any) => s + Number(i.total_price), 0);
    const total = Number(selected.amount_paid);
    const overhead = total - itemSum;

    if (overhead > 0.01) {
      const label =
        editType === "ACCEPTANCE_FEE"
          ? "Acceptance Admin Processing Fee"
          : "Registration Package Overhead";
      return [
        ...items,
        {
          id: "__overhead__",
          item_name: label,
          quantity: 1,
          unit_price: overhead,
          total_price: overhead,
        },
      ];
    }
    return items;
  }, [details, selected, editType]);

  // ── Admin save changes ────────────────────────────────────────────────────
  const hasChanges =
    selected != null &&
    selected.type !== "EXPENSE" &&
    (editType !== selected.type || editPaymentMode !== selected.payment_mode);

  const handleSaveChanges = async () => {
    if (!selected || selected.type === "EXPENSE") return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await transactionAPI.update(selected.transaction_id as number, {
        type: editType,
        payment_mode: editPaymentMode,
      });
      // Patch local state so the list and selected row stay in sync
      const patched = { ...selected, type: editType, payment_mode: editPaymentMode };
      setSelected(patched);
      setTransactions((prev) =>
        prev.map((t) =>
          t.transaction_id === selected.transaction_id
            ? { ...t, type: editType, payment_mode: editPaymentMode }
            : t,
        ),
      );
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err.message || "Save failed. Please try again.");
    }
    setSaving(false);
  };

  // ── Print receipt from admin modal ────────────────────────────────────────
  const handlePrintReceipt = () => {
    if (!selected || !details) return;
    const isFees = editType === "FEES_CASH_COLLECTION";
    const isRegistration = BUNDLE_TYPES.has(editType);
    const txn = {
      ...(details.transaction || {}),
      transaction_id: selected.transaction_id,
      timestamp: selected.timestamp,
      customer_name: selected.student_name,
      student_name: selected.student_name,
      target_class: selected.student_class,
      student_class: selected.student_class,
      payment_mode: editPaymentMode,
      fee_type_name: details.transaction?.fee_type_name,
      balance_due: details.transaction?.balance_due || 0,
    };
    printReceipt(
      buildReceiptHtml(settings, txn, Number(selected.amount_paid), displayItems, isFees, isRegistration),
    );
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
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

  // ── Payment mode display helper ───────────────────────────────────────────
  const paymentLabel = (mode: string) =>
    mode === "POS_Transfer" ? "POS / Transfer" : mode === "Bank_Transfer" ? "Bank Transfer" : mode;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-gray-500">
            {transactions.length} transactions — Total: {fmtCurrency(total)}
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
          { label: "Store Purchases", value: fmtCurrency(storeTotal) },
          { label: "Fees Collected", value: fmtCurrency(feesTotal) },
          { label: "Expenses", value: fmtCurrency(expensesTotal), isExpense: true },
          { label: "Net Total", value: fmtCurrency(total - expensesTotal) },
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
              <option value="POS_Transfer">POS / Transfer</option>
              <option value="Bank_Transfer">Bank Transfer</option>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No transactions found</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.transaction_id}
                    className={`border-t hover:bg-gray-50 ${t.type === "EXPENSE" ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm">#{t.transaction_id}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>{new Date(t.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.type === "EXPENSE" ? t.category : t.student_name}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {t.type === "EXPENSE" ? (t.description || "—") : (t.student_id || "—")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.type === "EXPENSE" ? (
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500">—</span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            t.student_class === "—" || t.student_class === "New Admission"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-primary-100 text-primary-800"
                          }`}
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
                              : t.type === "ACCEPTANCE_FEE" || t.type === "BUNDLE_PURCHASE"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-success-100 text-success-700"
                        }`}
                      >
                        {t.type === "EXPENSE"
                          ? "Expense"
                          : t.type === "STORE_PURCHASE"
                            ? "Store"
                            : t.type === "ACCEPTANCE_FEE"
                              ? "Acceptance"
                              : t.type === "BUNDLE_PURCHASE"
                                ? "Bundle"
                                : "Fees"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.type === "EXPENSE" ? "Cash Drawer" : paymentLabel(t.payment_mode)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${t.type === "EXPENSE" ? "text-red-600" : ""}`}
                    >
                      {fmtCurrency(t.amount_paid)}
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

      {/* ── Transaction Details Modal ─────────────────────────────────────── */}
      {selected && details && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b">
              <h2 className="text-xl font-bold">
                {selected.type === "EXPENSE" ? "Expense Details" : "Transaction Details"}
              </h2>
              <div className="flex items-center gap-2">
                {/* Print Receipt button — only for non-expense transactions */}
                {selected.type !== "EXPENSE" && (
                  <button
                    onClick={handlePrintReceipt}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                )}
                <button onClick={closeModal} className="text-2xl text-gray-400 hover:text-gray-700 leading-none">
                  &times;
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

              {/* Meta grid */}
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">ID:</span>{" "}
                  <span className="font-mono font-semibold">#{selected.transaction_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>{" "}
                  {new Date(selected.timestamp).toLocaleString()}
                </div>

                {/* Editable Type — only for non-expense */}
                {selected.type !== "EXPENSE" ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select
                        value={editType}
                        onChange={(e) => { setEditType(e.target.value); setSaveSuccess(false); }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-400"
                      >
                        {TRANSACTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
                      <select
                        value={editPaymentMode}
                        onChange={(e) => { setEditPaymentMode(e.target.value); setSaveSuccess(false); }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-400"
                      >
                        {PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-500">Type:</span>{" "}
                      <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Expense</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Payment:</span> Cash Drawer
                    </div>
                  </>
                )}
              </div>

              {/* Customer / Expense info */}
              {selected.type === "EXPENSE" ? (
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Expense Details</div>
                  <div className="font-bold text-lg">{selected.category}</div>
                  {selected.description && (
                    <div className="text-sm text-gray-600 mt-1">{selected.description}</div>
                  )}
                </div>
              ) : (
                <div className="bg-primary-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">Customer Details</div>
                  <div className="font-bold text-lg">{selected.student_name}</div>
                  <div className="text-sm text-gray-600">{selected.student_class}</div>
                  {selected.student_id && selected.student_id !== "—" && (
                    <div className="text-xs font-mono text-gray-500 mt-1">{selected.student_id}</div>
                  )}
                </div>
              )}

              {/* Items table (with overhead injection for bundles) */}
              {displayItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-700">Items</div>
                    {BUNDLE_TYPES.has(editType) && (
                      <div className="text-xs text-gray-400 italic">
                        Includes package overhead balancing line
                      </div>
                    )}
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="py-2 px-3 text-left font-medium text-gray-600">Item</th>
                          <th className="py-2 px-3 text-right font-medium text-gray-600">Qty</th>
                          <th className="py-2 px-3 text-right font-medium text-gray-600">Unit Price</th>
                          <th className="py-2 px-3 text-right font-medium text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayItems.map((item: any, idx: number) => (
                          <tr
                            key={item.id ?? idx}
                            className={`border-b last:border-0 ${item.id === "__overhead__" ? "bg-amber-50" : ""}`}
                          >
                            <td className="py-2 px-3">
                              {item.item_name}
                              {item.id === "__overhead__" && (
                                <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                  overhead
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">{item.quantity}</td>
                            <td className="py-2 px-3 text-right">{fmtCurrency(item.unit_price)}</td>
                            <td className="py-2 px-3 text-right font-semibold">
                              {fmtCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Grand total */}
              <div className="border-t-2 pt-3 flex justify-between items-center text-lg font-bold">
                <span>{selected.type === "EXPENSE" ? "Amount" : "Total"}</span>
                <span className={selected.type === "EXPENSE" ? "text-red-600" : "text-primary-600"}>
                  {fmtCurrency(selected.amount_paid)}
                </span>
              </div>

              {/* Balance due (if any) */}
              {details.transaction?.balance_due > 0 && (
                <div className="flex justify-between items-center text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg px-4 py-2">
                  <span>Balance Due</span>
                  <span>{fmtCurrency(details.transaction.balance_due)}</span>
                </div>
              )}

              {/* Admin edit controls */}
              {selected.type !== "EXPENSE" && (
                <div className="border-t pt-4">
                  <div className="text-xs text-gray-400 mb-3">
                    Admin correction — only Type and Payment Method may be changed. Item totals are locked.
                  </div>

                  {saveError && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-3">
                      {saveError}
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-3">
                      <CheckCircle className="w-4 h-4" />
                      Changes saved successfully.
                    </div>
                  )}

                  <button
                    onClick={handleSaveChanges}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
