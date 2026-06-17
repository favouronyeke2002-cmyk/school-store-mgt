import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Users, Clock, LogOut, Search,
  Plus, Minus, Trash2, CreditCard, Banknote,
  AlertTriangle, CheckCircle, ChevronRight, Package,
  User, RefreshCw, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { studentAPI, inventoryAPI, transactionAPI } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; }
interface InventoryItem { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; }
interface CartItem { item_id: number; item_name: string; selling_price: number; quantity: number; }
type SideTab = 'sale' | 'history' | 'students';
type SaleMode = 'store' | 'fees';

// ─── Currency helper ──────────────────────────────────────────────────────────
const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const ShiftOpenForm: React.FC<{ userId: number; openShift: (cash: number, uid: number) => Promise<boolean>; onLogout: () => void }> = ({ userId, openShift, onLogout }) => {
  const [opening, setOpening] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(opening);
    if (isNaN(cash) || cash < 0) { setErr('Enter a valid amount'); return; }
    setLoading(true);
    const ok = await openShift(cash, userId);
    if (!ok) setErr('Could not open shift. Please try again.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-7 h-7 text-success-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Open Shift</h2>
          <p className="text-sm text-gray-500 mt-1">Count the float in the drawer and enter the opening cash balance.</p>
        </div>
        {err && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{err}</div>}
        <form onSubmit={handle}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash Balance</label>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
            <input
              type="number" min="0" step="0.01"
              value={opening} onChange={(e) => setOpening(e.target.value)}
              className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-success-500"
              placeholder="0.00" autoFocus />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-success-600 text-white font-semibold rounded-lg hover:bg-success-700 disabled:opacity-50">
            {loading ? 'Opening Shift…' : 'Start Shift'}
          </button>
        </form>
        <button onClick={onLogout} className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm">
          Back to Login
        </button>
      </div>
    </div>
  );
};

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
const ReceiptModal: React.FC<{ txn: any; onClose: () => void }> = ({ txn, onClose }) => {
  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=340,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Courier New', monospace; width:80mm; padding:4mm; font-size:11px; }
      .center { text-align:center; }
      .bold { font-weight:bold; }
      .large { font-size:14px; }
      .divider { border-top:1px dashed #000; margin:6px 0; }
      .divider2 { border-top:2px solid #000; margin:6px 0; }
      .row { display:flex; justify-content:space-between; margin:3px 0; }
      .footer { text-align:center; margin-top:12px; font-size:10px; }
    </style></head><body>
    <div class="center bold large">SCHOOL STORE</div>
    <div class="center" style="font-size:10px;">Official School Store Receipt</div>
    <div class="divider"></div>
    <div class="row"><span>Receipt #:</span><span>${txn.transaction.transaction_id}</span></div>
    <div class="row"><span>Date:</span><span>${new Date(txn.transaction.timestamp).toLocaleString()}</span></div>
    <div class="row"><span>Student:</span><span>${txn.transaction.student_name}</span></div>
    <div class="row"><span>Class:</span><span>${txn.transaction.student_class}</span></div>
    <div class="divider"></div>
    ${(txn.items || []).map((item: any) =>
      `<div class="row"><span>${item.item_name} x${item.quantity}</span><span>₦${Number(item.total_price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>`
    ).join('')}
    <div class="divider2"></div>
    <div class="row bold large"><span>TOTAL:</span><span>₦${Number(txn.total).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
    <div class="row"><span>Payment:</span><span>${txn.transaction.payment_mode === 'POS_Transfer' ? 'POS / Transfer' : 'Cash'}</span></div>
    <div class="footer">Thank you!<br/>*** END OF RECEIPT ***</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-9 h-9 text-success-600" />
        </div>
        <h2 className="text-xl font-bold mb-1">Payment Received!</h2>
        <p className="text-gray-500 text-sm mb-4">Receipt #{txn.transaction.transaction_id}</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Student</span><span className="font-semibold">{txn.transaction.student_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span>{txn.transaction.payment_mode === 'POS_Transfer' ? 'POS / Transfer' : 'Cash'}</span></div>
          <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total</span><span className="text-success-600">{fmt(txn.total)}</span></div>
        </div>
        <button onClick={printReceipt} className="w-full py-3 bg-gray-800 text-white rounded-xl mb-2 font-semibold flex items-center justify-center gap-2 hover:bg-gray-900">
          <Package className="w-4 h-4" /> Print Receipt (80mm)
        </button>
        <button onClick={onClose} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">
          Done
        </button>
      </div>
    </div>
  );
};

// ─── Main CashierPOS ─────────────────────────────────────────────────────────
const CashierPOS: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeShift, openShift, closeShift, refreshShift } = useShift();

  const [tab, setTab] = useState<SideTab>('sale');
  const [saleMode, setSaleMode] = useState<SaleMode>('store');

  // Student selection
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentDrop, setShowStudentDrop] = useState(false);
  const studentRef = useRef<HTMLDivElement>(null);

  // Store purchase
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS_Transfer'>('Cash');

  // Fees collection
  const [feesAmount, setFeesAmount] = useState('');

  // UI state
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTxn, setLastTxn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [historyTxns, setHistoryTxns] = useState<any[]>([]);

  // Fetch students when searching
  useEffect(() => {
    if (!studentSearch) { setStudents([]); return; }
    studentAPI.getAll({ search: studentSearch }).then((data) => {
      setStudents(data);
      setShowStudentDrop(true);
    }).catch(console.error);
  }, [studentSearch]);

  // Fetch inventory
  useEffect(() => {
    inventoryAPI.getAll({ search: itemSearch }).then(setInventory).catch(console.error);
  }, [itemSearch]);

  // Fetch shift history txns when that tab is open
  useEffect(() => {
    if (tab === 'history' && activeShift) {
      transactionAPI.getHistory({}).then((data) => {
        setHistoryTxns(data.filter((t: any) => t.shift_id === activeShift.id));
      }).catch(console.error);
    }
  }, [tab, activeShift]);

  // Close student dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (studentRef.current && !studentRef.current.contains(e.target as Node)) {
        setShowStudentDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectStudent = (s: Student) => {
    setSelectedStudent(s);
    setStudentSearch(s.name);
    setShowStudentDrop(false);
    setCart([]);
    setFeesAmount('');
    setSaleMode('store');
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setStudentSearch('');
    setCart([]);
    setFeesAmount('');
  };

  const addToCart = useCallback((item: InventoryItem) => {
    if (item.stock_quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === item.item_id);
      if (existing) {
        if (existing.quantity >= item.stock_quantity) return prev;
        return prev.map((i) => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.item_id, item_name: item.item_name, selling_price: item.selling_price, quantity: 1 }];
    });
  }, []);

  const updateQty = (itemId: number, delta: number) => {
    setCart((prev) => prev.map((i) => i.item_id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (itemId: number) => setCart((prev) => prev.filter((i) => i.item_id !== itemId));
  const cartTotal = cart.reduce((sum, i) => sum + i.selling_price * i.quantity, 0);

  const handleStorePurchase = async () => {
    if (!selectedStudent || !activeShift || cart.length === 0 || loading) return;
    setLoading(true);
    try {
      const result = await transactionAPI.createPurchase(selectedStudent.student_id, activeShift.id, cart, paymentMode);
      if (result.success) {
        setLastTxn(result);
        setShowCheckout(false);
        setShowReceipt(true);
        setCart([]);
        setItemSearch('');
        inventoryAPI.getAll({}).then(setInventory);
      } else {
        alert('Transaction failed: ' + result.error);
      }
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
    setLoading(false);
  };

  const handleFeesCollection = async () => {
    if (!selectedStudent || !activeShift || loading) return;
    const amount = parseFloat(feesAmount);
    if (isNaN(amount) || amount <= 0) { alert('Enter a valid amount.'); return; }
    setLoading(true);
    try {
      const result = await transactionAPI.createFees(selectedStudent.student_id, activeShift.id, amount, paymentMode);
      if (result.success) {
        const updated = await studentAPI.getById(selectedStudent.student_id);
        if (updated) setSelectedStudent(updated);
        setFeesAmount('');
        alert(`₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} fees payment recorded successfully.`);
      } else {
        alert('Failed to process payment');
      }
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
    setLoading(false);
  };

  const handleCloseShift = async () => {
    const input = prompt('Enter physical cash count in the drawer now (₦):');
    if (input === null) return;
    const cash = parseFloat(input);
    if (isNaN(cash) || cash < 0) { alert('Invalid amount.'); return; }
    const result = await closeShift(cash, user?.id || 0);
    if (result) {
      alert(
        `Shift Closed\n\nExpected Cash: ${fmt(result.expectedCash)}\nActual Count: ${fmt(cash)}\nDifference: ${fmt(result.difference)}`
      );
      setShowCloseShift(false);
    }
  };

  if (!activeShift) {
    return <ShiftOpenForm userId={user?.id || 0} openShift={openShift} onLogout={logout} />;
  }

  const shiftCashSales = historyTxns.filter((t) => t.payment_mode === 'Cash').reduce((s, t) => s + Number(t.amount_paid), 0);
  const shiftPOSSales = historyTxns.filter((t) => t.payment_mode === 'POS_Transfer').reduce((s, t) => s + Number(t.amount_paid), 0);

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <aside className="w-16 bg-gray-900 flex flex-col items-center py-4 shrink-0">
        <div className="w-9 h-9 bg-success-500 rounded-lg flex items-center justify-center mb-6">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>

        {[
          { id: 'sale', icon: <ShoppingCart className="w-5 h-5" />, label: 'New Sale' },
          { id: 'history', icon: <Clock className="w-5 h-5" />, label: 'Shift Log' },
          { id: 'students', icon: <Users className="w-5 h-5" />, label: 'Students' },
        ].map((item) => (
          <button
            key={item.id}
            title={item.label}
            onClick={() => setTab(item.id as SideTab)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-all ${tab === item.id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          >
            {item.icon}
          </button>
        ))}

        <div className="mt-auto flex flex-col items-center gap-2">
          <button onClick={() => setShowCloseShift(true)} title="Close Shift" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-danger-700 hover:text-white transition-all">
            <Clock className="w-5 h-5" />
          </button>
          <button onClick={logout} title="Log Out" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* ── New Sale Tab ────────────────────────────────────────────── */}
      {tab === 'sale' && (
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/* Center: Student + Items/Fees */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between shrink-0">
              <div>
                <h1 className="font-bold text-gray-900">New Sale</h1>
                <p className="text-xs text-gray-400">Shift #{activeShift.id} · Opened {new Date(activeShift.opened_at).toLocaleTimeString()}</p>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user?.username}</span>
              </div>
            </div>

            {/* Student Selector */}
            <div className="bg-white border-b px-5 py-4 shrink-0">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Select Student</label>
              <div ref={studentRef} className="relative">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); }}
                      onFocus={() => students.length > 0 && setShowStudentDrop(true)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                      placeholder="Search student by name or ID…"
                    />
                  </div>
                  {selectedStudent && (
                    <button onClick={clearStudent} className="p-2.5 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showStudentDrop && students.length > 0 && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-20 max-h-56 overflow-auto">
                    {students.slice(0, 8).map((s) => (
                      <button
                        key={s.student_id}
                        onClick={() => selectStudent(s)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b last:border-0 text-left"
                      >
                        <div>
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.student_class} · {s.student_id}</div>
                        </div>
                        {s.current_fees_owed > 0 && (
                          <span className="text-xs font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
                            Owes {fmt(s.current_fees_owed)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ─ Debt Banner (locked, no X) ─ */}
              {selectedStudent && selectedStudent.current_fees_owed > 0 && (
                <div className="mt-3 flex items-center gap-3 bg-danger-600 text-white rounded-xl px-4 py-3 animate-pulse">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Outstanding School Fees</div>
                    <div className="text-xl font-extrabold">{fmt(selectedStudent.current_fees_owed)}</div>
                  </div>
                </div>
              )}

              {/* ─ Mode Toggle Tabs ─ */}
              {selectedStudent && (
                <div className="mt-3 flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setSaleMode('store')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === 'store' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Store Purchase
                  </button>
                  <button
                    onClick={() => setSaleMode('fees')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === 'fees' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Collect School Fees
                  </button>
                </div>
              )}
            </div>

            {/* ─ Store Items Grid ─ */}
            {selectedStudent && saleMode === 'store' && (
              <div className="flex-1 overflow-auto p-4">
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="Search items or scan barcode…"
                  />
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {inventory.map((item) => (
                    <button
                      key={item.item_id}
                      onClick={() => addToCart(item)}
                      disabled={item.stock_quantity <= 0}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${item.stock_quantity <= 0 ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white border-gray-200 hover:border-primary-400 hover:shadow-md active:scale-95'}`}
                    >
                      <div className="font-medium text-sm text-gray-800 leading-tight mb-1">{item.item_name}</div>
                      <div className="text-base font-extrabold text-primary-600">{fmt(item.selling_price)}</div>
                      <div className={`text-xs mt-1 font-medium ${item.stock_quantity <= 5 ? 'text-danger-500' : 'text-gray-400'}`}>
                        {item.stock_quantity <= 0 ? 'Out of stock' : `${item.stock_quantity} in stock`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Fees Collection Panel ─ */}
            {selectedStudent && saleMode === 'fees' && (
              <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm mt-4">
                  <h2 className="font-bold text-lg mb-1">Collect School Fees</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    For <span className="font-semibold text-gray-800">{selectedStudent.name}</span> · {selectedStudent.student_class}
                  </p>

                  <div className="mb-5">
                    <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-1">Current Balance</div>
                    <div className={`text-3xl font-extrabold ${selectedStudent.current_fees_owed > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                      {fmt(selectedStudent.current_fees_owed)}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Enter Amount Collected for School Fees Balance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-600">₦</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={feesAmount}
                        onChange={(e) => setFeesAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:outline-none focus:border-primary-400"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[selectedStudent.current_fees_owed, selectedStudent.current_fees_owed / 2, 5000, 10000].map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => setFeesAmount(String(preset))}
                          className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium truncate"
                        >
                          {i === 0 ? 'Full' : i === 1 ? 'Half' : fmt(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="mb-5">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMode('Cash')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}
                      >
                        <Banknote className="w-4 h-4" /> CASH
                      </button>
                      <button
                        onClick={() => setPaymentMode('POS_Transfer')}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}
                      >
                        <CreditCard className="w-4 h-4" /> POS
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleFeesCollection}
                    disabled={!feesAmount || parseFloat(feesAmount) <= 0 || loading}
                    className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    {loading ? 'Processing…' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!selectedStudent && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <User className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-medium text-lg">Search for a student above</p>
                <p className="text-sm">Student selection is required before adding items.</p>
              </div>
            )}
          </div>

          {/* ── Right: Cart / Checkout ───────────────────────────────── */}
          <div className="w-80 bg-white border-l flex flex-col shrink-0">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                <h2 className="font-bold text-gray-900">Cart</h2>
              </div>
              {cart.length > 0 && (
                <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
              )}
            </div>

            <div className="flex-1 overflow-auto px-3 py-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
                  <ShoppingCart className="w-10 h-10 mb-2" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.item_id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.item_name}</div>
                        <div className="text-xs text-gray-400">{fmt(item.selling_price)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.item_id, -1)} className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm font-bold">−</button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.item_id, 1)} className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm font-bold">+</button>
                      </div>
                      <div className="text-sm font-bold text-gray-900 w-16 text-right">{fmt(item.selling_price * item.quantity)}</div>
                      <button onClick={() => removeFromCart(item.item_id)} className="text-gray-300 hover:text-danger-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart total + checkout */}
            {cart.length > 0 && saleMode === 'store' && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-xl font-extrabold text-gray-900">{fmt(cartTotal)}</span>
                </div>

                {/* Payment mode selection */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setPaymentMode('Cash')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}
                  >
                    <Banknote className="w-4 h-4" /> CASH
                  </button>
                  <button
                    onClick={() => setPaymentMode('POS_Transfer')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}
                  >
                    <CreditCard className="w-4 h-4" /> POS
                  </button>
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 transition-all text-lg shadow-sm"
                >
                  Charge {fmt(cartTotal)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Shift Log Tab ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Shift Log</h1>
              <p className="text-gray-500 text-sm">Shift #{activeShift.id} · {new Date(activeShift.opened_at).toLocaleString()}</p>
            </div>
            <button onClick={() => transactionAPI.getHistory({}).then((d) => setHistoryTxns(d.filter((t: any) => t.shift_id === activeShift.id)))} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Opening Cash</div>
              <div className="text-2xl font-extrabold">{fmt(activeShift.opening_cash)}</div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="text-xs text-success-600 font-semibold uppercase mb-1">Cash Sales</div>
              <div className="text-2xl font-extrabold text-success-700">{fmt(shiftCashSales)}</div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="text-xs text-primary-600 font-semibold uppercase mb-1">POS / Transfer</div>
              <div className="text-2xl font-extrabold text-primary-700">{fmt(shiftPOSSales)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Transactions ({historyTxns.length})</h2>
              <span className="text-sm font-bold text-gray-600">Total: {fmt(historyTxns.reduce((s, t) => s + Number(t.amount_paid), 0))}</span>
            </div>
            {historyTxns.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No transactions yet this shift</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTxns.map((t) => (
                    <tr key={t.transaction_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 font-medium">{t.student_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.type === 'STORE_PURCHASE' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>
                          {t.type === 'STORE_PURCHASE' ? 'Store' : 'Fees'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${t.payment_mode === 'Cash' ? 'text-success-700' : 'text-primary-700'}`}>
                          {t.payment_mode === 'Cash' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {t.payment_mode === 'Cash' ? 'Cash' : 'POS'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(Number(t.amount_paid))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Students Tab ─────────────────────────────────────────────── */}
      {tab === 'students' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Students</h1>
            <p className="text-gray-500 text-sm">View student accounts and fees balance</p>
          </div>
          <StudentQuickList onSelect={(s) => { selectStudent(s); setTab('sale'); }} />
        </div>
      )}

      {/* ── Confirm Checkout Modal ──────────────────────────────────── */}
      {showCheckout && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Sale</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="font-bold text-gray-800">{selectedStudent.name}</div>
              <div className="text-sm text-gray-500">{selectedStudent.student_class}</div>
            </div>
            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.item_id} className="flex justify-between text-sm">
                  <span>{item.item_name} × {item.quantity}</span>
                  <span className="font-semibold">{fmt(item.selling_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t-2 pt-3 mb-5 flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="font-extrabold text-xl text-success-700">{fmt(cartTotal)}</span>
            </div>

            {/* Final payment method confirmation */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-600 mb-2">Payment Method</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-success-400'}`}>
                  <Banknote className="w-5 h-5" /> CASH
                </button>
                <button onClick={() => setPaymentMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-primary-400'}`}>
                  <CreditCard className="w-5 h-5" /> POS / TRANSFER
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleStorePurchase} disabled={loading} className="flex-1 py-3 bg-success-600 text-white rounded-xl font-bold hover:bg-success-700 disabled:opacity-50">
                {loading ? 'Processing…' : 'Confirm & Charge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ────────────────────────────────────────────── */}
      {showReceipt && lastTxn && (
        <ReceiptModal txn={lastTxn} onClose={() => { setShowReceipt(false); setLastTxn(null); }} />
      )}

      {/* ── Close Shift Confirm ──────────────────────────────────────── */}
      {showCloseShift && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-warning-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Close Shift?</h2>
            <p className="text-gray-500 text-sm mb-4">Count the physical cash in the drawer and you will be prompted to enter the total before closing.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseShift(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium hover:bg-gray-200">Back</button>
              <button onClick={handleCloseShift} className="flex-1 py-3 bg-danger-600 text-white rounded-xl font-bold hover:bg-danger-700">Close Shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Quick Student List for Students tab ──────────────────────────────────────
const StudentQuickList: React.FC<{ onSelect: (s: Student) => void }> = ({ onSelect }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studentAPI.getAll({ search }).then(setStudents).catch(console.error).finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="Search students…"
        />
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {students.map((s) => (
            <button key={s.student_id} onClick={() => onSelect(s)} className="bg-white rounded-xl p-4 text-left border hover:border-primary-400 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                  {s.name.charAt(0)}
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.student_class}</span>
              </div>
              <div className="font-semibold text-sm text-gray-900">{s.name}</div>
              <div className="text-xs text-gray-400 font-mono">{s.student_id}</div>
              {s.current_fees_owed > 0 ? (
                <div className="mt-1 text-xs font-bold text-danger-600">{fmt(s.current_fees_owed)} owed</div>
              ) : (
                <div className="mt-1 text-xs font-bold text-success-600">No fees owed</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CashierPOS;
