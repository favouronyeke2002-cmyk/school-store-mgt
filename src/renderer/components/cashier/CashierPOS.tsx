import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Users, Clock, LogOut, Search, Plus, Minus,
  Trash2, CreditCard, Banknote, AlertTriangle, CheckCircle,
  Package, User, RefreshCw, X, Tag, ChevronLeft, ChevronRight, Printer, UserPlus, Layers, UserCheck, Pencil,
  FileText, PowerOff, Wallet, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { studentAPI, inventoryAPI, transactionAPI, studentFeeAPI, categoryAPI, settingsAPI, feeTypeAPI, bundleAPI, applicantAPI, bundlePaymentAPI, shiftAPI, expenseAPI } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; admission_type?: 'Returning' | 'New'; }
interface InventoryItem { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; category_id: number | null; category_name: string | null; category_color: string | null; }
interface CartItem { item_id: number; item_name: string; selling_price: number; quantity: number; }
interface StudentFee { id: number; fee_name: string; fee_description: string; academic_session: string; amount_due: number; amount_paid: number; balance: number; fee_category: string; }
interface Category { id: number; name: string; color: string; }
interface Bundle { id: number; name: string; description: string | null; base_price: number; bundle_type: 'acceptance' | 'registration' | 'custom'; is_active: boolean; applicable_to?: string; class_category?: string | null; coaching_addon?: boolean; items: { item_id: number; item_name: string; selling_price: number; quantity: number }[]; }
type SideTab = 'sale' | 'history' | 'students';
type SaleMode = 'store' | 'fees' | 'bundles';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Iframe-based receipt printer (bypasses popup blockers) ──────────────────
function printReceipt(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { iframe.contentWindow?.print(); } finally { setTimeout(() => document.body.removeChild(iframe), 1000); }
  }, 300);
}

function buildReceiptHtml(settings: any, txn: any, total: number, items: any[], isFees = false, isRegistration = false): string {
  const schoolName = settings?.school_name || 'School Store';
  const tagline = settings?.tagline || '';
  const address = settings?.address || '';
  const phone = settings?.phone_number || '';
  const sessionParts = [settings?.academic_session, settings?.current_term].filter(Boolean);
  const session = sessionParts.join(' · ');
  const logo = settings?.logo_url || '';

  // Build items HTML - Item Name + Quantity ONLY. Prices are intentionally omitted so
  // parents/storekeepers can't see individual item pricing on this slip.
  const itemsHtml = items.length > 0
    ? `<div class="section-title">ITEMS</div>` + items.map((i: any) =>
        `<div class="row item-row"><span class="item-name">${i.item_name}${i.quantity > 1 ? ' x' + i.quantity : ' x 1'}</span></div>`
      ).join('')
    : '';

  const typeLabel = isRegistration ? (txn.fee_type_name || 'Registration Package') : isFees ? (txn.fee_type_name || 'School Fees') : 'Store Purchase';

  const balanceDueHtml = txn.balance_due && txn.balance_due > 0
    ? `<div class="divider"></div><div class="row bold total-row"><span>TOTAL PAID:</span><span>${fmt(total)}</span></div><div class="row bold balance-row"><span>BALANCE DUE:</span><span>${fmt(txn.balance_due)}</span></div>`
    : '';

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
    .item-price{font-weight:700}
    .section-title{font-size:11px;font-weight:900;margin:6px 0 3px;padding-bottom:2px;border-bottom:1px solid #000}
    .total-row{font-size:14px;font-weight:900}
    .balance-row{font-size:14px;font-weight:900;color:#000000 !important}
    img{max-width:50px;max-height:50px;object-fit:contain}
    .header-text{font-weight:700}
  </style></head><body>
  <div class="center">
    ${logo ? `<img src="${logo}" alt="logo" style="display:block;margin:0 auto 2px"/>` : ''}
    <div class="bold large">${schoolName}</div>
    ${tagline ? `<div class="header-text" style="font-size:11px">${tagline}</div>` : ''}
    ${session ? `<div class="header-text" style="font-size:10px">${session}</div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="row"><span>Receipt #${txn.transaction_id}</span><span>${new Date(txn.timestamp).toLocaleDateString()}</span></div>
  <div class="row"><span>Time:</span><span>${new Date(txn.timestamp).toLocaleTimeString()}</span></div>
  <div class="row"><span>Student:</span><span>${txn.customer_name || txn.student_name || 'Walk-in Applicant'}</span></div>
  <div class="row"><span>Class:</span><span>${txn.target_class || txn.student_class || 'N/A'}</span></div>
  <div class="divider"></div>
  ${isFees && !isRegistration && items.length === 0
    ? `<div class="row bold"><span>${txn.fee_type_name || 'School Fees'}</span><span>${fmt(total)}</span></div>`
    : itemsHtml
  }
  ${balanceDueHtml}
  <div class="divider2"></div>
  <div class="row bold large"><span>TOTAL:</span><span>${fmt(total)}</span></div>
  <div class="row"><span>Payment:</span><span>${txn.payment_mode === 'POS_Transfer' ? 'POS / Transfer' : 'Cash'}</span></div>
  <div class="divider"></div>
  <div class="center" style="font-size:10px;font-weight:600">
    ${address ? `<div>${address}</div>` : ''}
    ${phone ? `<div>Tel: ${phone}</div>` : ''}
    <div style="margin-top:4px;font-weight:700">Thank you!</div>
    <div class="bold">*** END OF RECEIPT ***</div>
  </div>
  </body></html>`;
}

// ─── Stale Shift Lockout ──────────────────────────────────────────────────────
const StaleShiftLockout: React.FC<{
  shift: { id: number; opened_at: string };
  closeShift: (cash: number, uid: number) => Promise<{ expectedCash: number; difference: number } | null>;
  userId: number;
  onLogout: () => void;
}> = ({ shift, closeShift, userId, onLogout }) => {
  const [expectedCash, setExpectedCash] = useState<number | null>(null);
  const [cash, setCash] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ expectedCash: number; actualCash: number; difference: number } | null>(null);

  useEffect(() => {
    shiftAPI.getExpectedCash(shift.id).then(setExpectedCash).catch(() => setExpectedCash(0));
  }, [shift.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cash);
    if (isNaN(val) || val < 0) { setErr('Enter a valid cash amount'); return; }
    setLoading(true);
    const result = await closeShift(val, userId);
    setLoading(false);
    if (result) setDone({ expectedCash: result.expectedCash, actualCash: val, difference: result.difference });
    else setErr('Failed to close shift. Please try again.');
  };

  const shiftDate = new Date(shift.opened_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (done) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-7 h-7 text-success-600" /></div>
          <h2 className="text-xl font-bold mb-1">Shift Closed</h2>
          <p className="text-sm text-gray-500 mb-5">You can now open a new shift for today.</p>
          <div className="space-y-2 mb-5 text-left">
            <div className="flex justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm"><span className="text-gray-500">Expected</span><span className="font-bold">{fmt(done.expectedCash)}</span></div>
            <div className="flex justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm"><span className="text-gray-500">Actual Count</span><span className="font-bold">{fmt(done.actualCash)}</span></div>
            <div className={`flex justify-between rounded-lg px-4 py-2 text-sm ${done.difference === 0 ? 'bg-success-50' : done.difference < 0 ? 'bg-danger-50' : 'bg-primary-50'}`}>
              <span className="text-gray-500">Difference</span>
              <span className={`font-extrabold ${done.difference === 0 ? 'text-success-600' : done.difference < 0 ? 'text-danger-600' : 'text-primary-600'}`}>{fmt(done.difference)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">Reload the page to open a new shift.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-3"><AlertTriangle className="w-7 h-7 text-danger-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Stale Shift Detected</h2>
          <p className="text-sm text-gray-500 mt-1">A shift from <strong>{shiftDate}</strong> is still open.</p>
          <p className="text-sm text-danger-600 font-medium mt-2">You must close this shift before processing any new payments.</p>
        </div>
        {err && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{err}</div>}
        {expectedCash === null ? (
          <div className="text-center text-gray-400 py-4 text-sm">Calculating expected cash…</div>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-center">
              <div className="text-xs text-gray-400 font-semibold uppercase">Expected Cash in Drawer</div>
              <div className="text-2xl font-extrabold text-gray-900">{fmt(expectedCash)}</div>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Count</label>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
                <input type="number" min="0" step="0.01" value={cash} onChange={(e) => { setCash(e.target.value); setErr(''); }} className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-danger-500" placeholder="0.00" autoFocus />
              </div>
              {cash && !isNaN(parseFloat(cash)) && (
                <div className={`rounded-xl p-3 mb-4 text-center ${parseFloat(cash) === expectedCash ? 'bg-success-50' : parseFloat(cash) < expectedCash ? 'bg-danger-50' : 'bg-primary-50'}`}>
                  <div className="text-xs text-gray-400">Difference</div>
                  <div className={`text-xl font-extrabold ${parseFloat(cash) === expectedCash ? 'text-success-600' : parseFloat(cash) < expectedCash ? 'text-danger-600' : 'text-primary-600'}`}>{fmt(parseFloat(cash) - expectedCash)}</div>
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full py-3 bg-danger-600 text-white font-bold rounded-xl hover:bg-danger-700 disabled:opacity-50">{loading ? 'Closing…' : 'Close Shift & Continue'}</button>
            </form>
          </>
        )}
        <button onClick={onLogout} className="w-full mt-3 py-2 text-gray-400 hover:text-gray-600 text-sm">Log Out</button>
      </div>
    </div>
  );
};

// ─── Open Shift Form ──────────────────────────────────────────────────────────
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
          <div className="w-14 h-14 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3"><Clock className="w-7 h-7 text-success-600" /></div>
          <h2 className="text-xl font-bold text-gray-900">Open Shift</h2>
          <p className="text-sm text-gray-500 mt-1">Count the float and enter the opening cash balance.</p>
        </div>
        {err && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{err}</div>}
        <form onSubmit={handle}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash Balance</label>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
            <input type="number" min="0" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-success-500" placeholder="0.00" autoFocus />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-success-600 text-white font-semibold rounded-lg hover:bg-success-700 disabled:opacity-50">{loading ? 'Opening…' : 'Start Shift'}</button>
        </form>
        <button onClick={onLogout} className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm">Back to Login</button>
      </div>
    </div>
  );
};

// ─── Receipt Success Modal ────────────────────────────────────────────────────
const ReceiptModal: React.FC<{ txn: any; total: number; items: any[]; settings: any; isFees?: boolean; isRegistration?: boolean; onClose: () => void }> = ({ txn, total, items, settings, isFees = false, isRegistration = false, onClose }) => {
  const handlePrint = () => printReceipt(buildReceiptHtml(settings, txn, total, items, isFees, isRegistration));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-9 h-9 text-success-600" /></div>
        <h2 className="text-xl font-bold mb-1">Payment Received!</h2>
        <p className="text-gray-500 text-sm mb-4">Receipt #{txn.transaction_id}</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Student</span><span className="font-semibold">{txn.student_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span>{txn.payment_mode === 'POS_Transfer' ? 'POS / Transfer' : 'Cash'}</span></div>
          <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total</span><span className="text-success-600">{fmt(total)}</span></div>
        </div>
        <button onClick={handlePrint} className="w-full py-3 bg-gray-800 text-white rounded-xl mb-2 font-semibold flex items-center justify-center gap-2 hover:bg-gray-900"><Package className="w-4 h-4" /> Print Receipt (80mm)</button>
        <button onClick={onClose} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">Done</button>
      </div>
    </div>
  );
};

// ─── Error Modal ──────────────────────────────────────────────────────────────
const ErrorModal: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
      <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-danger-600" /></div>
      <h2 className="text-lg font-bold mb-2">Error</h2>
      <p className="text-gray-600 text-sm mb-5">{message}</p>
      <button onClick={onClose} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">OK</button>
    </div>
  </div>
);

// ─── Shift Close Modal ────────────────────────────────────────────────────────
const ShiftCloseModal: React.FC<{
  expectedCash: number;
  onClose: (closingCash: number) => void;
  onCancel: () => void;
}> = ({ expectedCash, onClose, onCancel }) => {
  const [cash, setCash] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cash);
    if (isNaN(val) || val < 0) { setErr('Enter a valid amount'); return; }
    onClose(val);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3"><Clock className="w-7 h-7 text-warning-600" /></div>
          <h2 className="text-xl font-bold">Close Shift</h2>
          <p className="text-sm text-gray-500 mt-1">Count the physical cash in the drawer</p>
        </div>
        {err && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{err}</div>}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-center">
          <div className="text-xs text-gray-400 font-semibold uppercase">Expected Cash</div>
          <div className="text-2xl font-extrabold text-gray-900">{fmt(expectedCash)}</div>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Count</label>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
            <input type="number" min="0" step="0.01" value={cash} onChange={(e) => { setCash(e.target.value); setErr(''); }} className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-warning-500" placeholder="0.00" autoFocus />
          </div>
          {cash && !isNaN(parseFloat(cash)) && (
            <div className={`rounded-xl p-3 mb-4 text-center ${parseFloat(cash) === expectedCash ? 'bg-success-50' : parseFloat(cash) < expectedCash ? 'bg-danger-50' : 'bg-primary-50'}`}>
              <div className="text-xs text-gray-400">Difference</div>
              <div className={`text-xl font-extrabold ${parseFloat(cash) === expectedCash ? 'text-success-600' : parseFloat(cash) < expectedCash ? 'text-danger-600' : 'text-primary-600'}`}>
                {fmt(parseFloat(cash) - expectedCash)}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium hover:bg-gray-200">Back</button>
            <button type="submit" className="flex-1 py-3 bg-danger-600 text-white rounded-xl font-bold hover:bg-danger-700">Close Shift</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Shift Close Result Modal ─────────────────────────────────────────────────
const ShiftResultModal: React.FC<{ expectedCash: number; actualCash: number; difference: number; onClose: () => void }> = ({ expectedCash, actualCash, difference, onClose }) => (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
      <div className={`w-14 h-14 ${difference === 0 ? 'bg-success-100' : 'bg-warning-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
        {difference === 0 ? <CheckCircle className="w-7 h-7 text-success-600" /> : <AlertTriangle className="w-7 h-7 text-warning-600" />}
      </div>
      <h2 className="text-xl font-bold mb-4">Shift Closed</h2>
      <div className="space-y-3 mb-5">
        <div className="flex justify-between bg-gray-50 rounded-lg px-4 py-2"><span className="text-gray-500">Expected Cash</span><span className="font-bold">{fmt(expectedCash)}</span></div>
        <div className="flex justify-between bg-gray-50 rounded-lg px-4 py-2"><span className="text-gray-500">Actual Count</span><span className="font-bold">{fmt(actualCash)}</span></div>
        <div className={`flex justify-between rounded-lg px-4 py-2 ${difference === 0 ? 'bg-success-50' : difference < 0 ? 'bg-danger-50' : 'bg-primary-50'}`}>
          <span className="text-gray-500">Difference</span>
          <span className={`font-extrabold ${difference === 0 ? 'text-success-600' : difference < 0 ? 'text-danger-600' : 'text-primary-600'}`}>{fmt(difference)}</span>
        </div>
      </div>
      <button onClick={onClose} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">OK</button>
    </div>
  </div>
);

// ─── Quick Add Student Modal ──────────────────────────────────────────────────
const QuickAddStudentModal: React.FC<{
  classes: string[];
  onSave: (data: { name: string; studentClass: string; studentStatus: 'Day' | 'Boarding' }) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}> = ({ classes, onSave, onCancel, saving, error }) => {
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState(classes[0] || '');
  const [studentStatus, setStudentStatus] = useState<'Day' | 'Boarding'>('Day');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !studentClass) return;
    onSave({ name: name.trim(), studentClass, studentStatus });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center"><UserPlus className="w-5 h-5 text-primary-600" /></div>
            <div>
              <h2 className="text-lg font-bold">Quick Add Returning Student</h2>
              <p className="text-xs text-gray-400">For students already in the system but missing from roster</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 mb-4 text-xs text-primary-700">
          Standard class fees will be applied to this student automatically upon saving.
        </div>

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Enter student's full name" required autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Class *</label>
            <select value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required>
              {classes.length === 0 && <option value="">No classes available</option>}
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Student Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStudentStatus('Day')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${studentStatus === 'Day' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}>Day Student</button>
              <button type="button" onClick={() => setStudentStatus('Boarding')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${studentStatus === 'Boarding' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-purple-400'}`}>Boarding Student</button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving || !name.trim() || !studentClass} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Adding…' : 'Quick Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Walk-In Applicant Modal ──────────────────────────────────────────────────
const WalkInApplicantModal: React.FC<{
  classes: string[];
  classCategoryMap: Record<string, string>;
  onSave: (data: { firstName: string; lastName: string; proposedClass: string; studentStatus: 'Day' | 'Boarding' }) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}> = ({ classes, classCategoryMap, onSave, onCancel, saving, error }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [proposedClass, setProposedClass] = useState(classes[0] || '');
  const [studentStatus, setStudentStatus] = useState<'Day' | 'Boarding'>('Day');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    onSave({ firstName: firstName.trim(), lastName: lastName.trim(), proposedClass, studentStatus });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center"><User className="w-5 h-5 text-warning-600" /></div>
            <h2 className="text-lg font-bold">Walk-In Applicant</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="First name" required autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Last name" required />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Proposed Class</label>
            <select value={proposedClass} onChange={(e) => setProposedClass(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              {classes.length === 0 && <option value="">No classes available</option>}
              {(() => {
                const groups: Record<string, string[]> = { JUNIOR: [], SENIOR: [], REMEDIAL: [], '': [] };
                classes.forEach((c) => { const g = classCategoryMap[c] || ''; (groups[g] || groups['']).push(c); });
                const labels: Record<string, string> = { JUNIOR: 'Junior Secondary (JSS1–3)', SENIOR: 'Senior Secondary (SS1–3)', REMEDIAL: 'Remedial / A.C.E. Class', '': 'Unassigned' };
                return (['JUNIOR', 'SENIOR', 'REMEDIAL', ''] as const).flatMap((g) =>
                  groups[g].length === 0 ? [] : [
                    <optgroup key={g} label={labels[g]}>
                      {groups[g].map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  ]
                );
              })()}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Student Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStudentStatus('Day')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${studentStatus === 'Day' ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>Day</button>
              <button type="button" onClick={() => setStudentStatus('Boarding')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${studentStatus === 'Boarding' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'}`}>Boarding</button>
            </div>
          </div>
          <p className="text-xs text-gray-400">Applicant will be created. Choose next action (form, acceptance fee, or registration bundle) from the menu that appears.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving || !firstName.trim() || !lastName.trim()} className="flex-1 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-semibold hover:bg-warning-600 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Applicant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Bundle Payment Modal ─────────────────────────────────────────────────────
const BundlePaymentModal: React.FC<{
  bundle: Bundle;
  minFloor: number;
  applicantName: string;
  onComplete: (amount: number, paymentMode: 'Cash' | 'POS_Transfer', autoIssue: boolean) => void;
  onCancel: () => void;
  processing: boolean;
  error: string;
}> = ({ bundle, minFloor, applicantName, onComplete, onCancel, processing, error }) => {
  const [amount, setAmount] = useState(String(bundle.base_price));
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [autoIssue, setAutoIssue] = useState(true);
  const [stockLevels, setStockLevels] = useState<Record<number, number>>({});

  useEffect(() => {
    const itemIds = bundle.items?.map((i) => i.item_id) || [];
    if (itemIds.length === 0) { setStockLevels({}); return; }
    inventoryAPI.getStockLevels(itemIds).then(setStockLevels).catch(() => setStockLevels({}));
  }, [bundle]);

  const stockCappedItems = (bundle.items || []).map((item) => {
    const available = stockLevels[item.item_id] ?? item.quantity;
    return { ...item, outOfStock: available <= 0, quantity: Math.max(0, Math.min(item.quantity, available)) };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(parseFloat(amount) || 0, paymentMode, autoIssue);
  };

  const isPartial = parseFloat(amount) < bundle.base_price;
  const isBelowFloor = isPartial && parseFloat(amount) < minFloor;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center"><Layers className="w-5 h-5 text-success-600" /></div>
            <h2 className="text-lg font-bold">{bundle.name}</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <div className="font-semibold text-gray-900">{applicantName}</div>
          <div className="text-xs text-gray-500">{bundle.bundle_type === 'acceptance' ? 'Acceptance Fee' : 'Registration Package'}</div>
        </div>

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        {/* Bundle items */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-gray-700 mb-2 block">Package Contents</label>
          <div className="space-y-1">
            {stockCappedItems.map((item) => (
              <div key={item.item_id} className={`flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 ${item.outOfStock ? 'text-danger-500' : ''}`}>
                <span>
                  {item.item_name} ×{item.quantity}
                  {item.outOfStock && <span className="ml-2 font-bold uppercase text-[10px] bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded">Out of Stock</span>}
                </span>
                <span className="font-medium">{item.outOfStock ? '—' : fmt(item.selling_price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">₦</span>
              <input type="number" min="0" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:border-primary-400" />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setAmount(String(bundle.base_price))} className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold">Full ({fmt(bundle.base_price)})</button>
              <button type="button" onClick={() => setAmount(String(minFloor))} className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">Min. Partial ({fmt(minFloor)})</button>
            </div>
            {isPartial && (
              <div className={`mt-2 text-xs ${isBelowFloor ? 'text-danger-600 font-semibold' : 'text-warning-600'}`}>
                {isBelowFloor ? `Minimum partial payment is ${fmt(minFloor)}` : `Partial payment — balance will be ${fmt(bundle.base_price - parseFloat(amount))}`}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}><Banknote className="w-4 h-4" /> CASH</button>
              <button type="button" onClick={() => setPaymentMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}><CreditCard className="w-4 h-4" /> POS</button>
            </div>
          </div>

          {/* Auto-issuance toggle — only shown when at least one item is in stock */}
          {stockCappedItems.some((i) => !i.outOfStock) && (
            <label className="flex items-start gap-3 cursor-pointer bg-success-50 border border-success-200 rounded-xl px-3 py-2.5 hover:border-success-400 transition-colors">
              <input
                type="checkbox"
                checked={autoIssue}
                onChange={(e) => setAutoIssue(e.target.checked)}
                className="mt-0.5 rounded accent-success-600"
              />
              <div>
                <span className="text-sm font-semibold text-success-800">Hand over available items right now</span>
                <p className="text-xs text-success-600 mt-0.5">
                  Items in stock will be marked as <strong>Issued</strong> and deducted from inventory immediately.
                  Uncheck to create <strong>Pending Collection</strong> entries instead.
                </p>
              </div>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={processing || isBelowFloor || parseFloat(amount) <= 0} className="flex-1 py-2.5 bg-success-600 text-white rounded-xl text-sm font-semibold hover:bg-success-700 disabled:opacity-50">
              {processing ? 'Processing…' : `Pay ${fmt(parseFloat(amount) || 0)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Add Expense Modal ───────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'Water Tanker',
  'Generator Fuel',
  'Kitchen Supplies',
  'Repairs',
  'Salaries',
  'Other',
] as const;

const AddExpenseModal: React.FC<{
  shiftId: number;
  openingCash: number;
  currentCashSales: number;
  onConfirm: (data: { category: string; amount: number; paymentMode: 'Cash Drawer'; description: string }) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}> = ({ shiftId, openingCash, currentCashSales, onConfirm, onCancel, saving, error }) => {
  const [category, setCategory] = useState<string>('Other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const expectedCash = openingCash + currentCashSales;
  const remainingCash = expectedCash - amountNum;
  const isNegative = remainingCash < 0;
  const isInsufficient = amountNum > expectedCash;
  const paymentMode = 'Cash Drawer'; // Always cash drawer for cashiers

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || amountNum <= 0) return;
    if (isInsufficient) return; // Block if insufficient funds
    if (!showWarning) {
      setShowWarning(true);
      return;
    }
    onConfirm({ category, amount: amountNum, paymentMode: 'Cash Drawer', description: description.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-100 rounded-xl flex items-center justify-center"><Wallet className="w-5 h-5 text-danger-600" /></div>
            <h2 className="text-lg font-bold">Record Cash Expense</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        {/* Insufficient funds error - shown when amount exceeds cash at hand */}
        {isInsufficient && amountNum > 0 && (
          <div className="bg-danger-100 border-2 border-danger-400 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-danger-600" />
            <div className="text-sm">
              <div className="font-bold text-danger-800">ERROR: Insufficient cash in drawer. This transaction is blocked.</div>
              <div className="text-danger-700 mt-1 font-medium">Current cash at hand is only {fmt(expectedCash)}.</div>
            </div>
          </div>
        )}

        {/* Cash drawer summary warning */}
        <div className={`rounded-xl p-4 mb-4 ${showWarning && !isInsufficient ? 'bg-warning-50 border border-warning-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Cash Drawer Impact</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Opening Cash</span>
              <span className="font-medium">{fmt(openingCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">+ Cash Sales</span>
              <span className="font-medium text-success-600">+ {fmt(currentCashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">= Current Cash at Hand</span>
              <span className="font-bold">{fmt(expectedCash)}</span>
            </div>
            {amountNum > 0 && (
              <>
                <div className="border-t border-dashed my-2 border-gray-300" />
                <div className="flex justify-between">
                  <span className="text-gray-500">- Expense</span>
                  <span className="font-medium text-danger-600">- {fmt(amountNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700">Remaining</span>
                  <span className={`font-bold ${isNegative ? 'text-danger-600' : 'text-gray-900'}`}>{fmt(remainingCash)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Warning confirmation */}
        {showWarning && !isInsufficient && (
          <div className={`rounded-xl p-4 mb-4 flex items-start gap-3 ${isNegative ? 'bg-danger-50 border border-danger-300' : 'bg-warning-50 border border-warning-300'}`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isNegative ? 'text-danger-600' : 'text-warning-600'}`} />
            <div className="text-sm">
              <div className={`font-semibold ${isNegative ? 'text-danger-800' : 'text-warning-800'}`}>
                {isNegative ? 'Warning: This expense exceeds the cash in your drawer!' : 'This expense will be deducted from your shift\'s expected cash.'}
              </div>
              <div className={`${isNegative ? 'text-danger-700' : 'text-warning-700'} mt-1`}>
                {isNegative ? 'Your expected cash will become negative. Make sure this is intentional.' : 'This reduces the amount you are expected to turn in at close of shift.'}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">N</span>
              <input type="number" min="0" step="100" value={amount} onChange={(e) => { setAmount(e.target.value); setShowWarning(false); }} className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:border-primary-400" placeholder="0.00" />
            </div>
          </div>

          {/* Payment mode is always Cash Drawer for cashiers - shown as static badge */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Mode</label>
            <div className="flex items-center gap-2 px-4 py-3 bg-warning-50 border border-warning-200 rounded-xl">
              <Banknote className="w-5 h-5 text-warning-600" />
              <span className="font-semibold text-warning-700">Cash Drawer</span>
              <span className="text-xs text-gray-400 ml-auto">Deducted from shift cash</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description (Optional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="e.g. Fuel for generator, Water for kitchen" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving || amountNum <= 0 || isInsufficient} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700 disabled:opacity-50">
              {saving ? 'Recording…' : showWarning ? 'Confirm Expense' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Registration Flow Modal ─────────────────────────────────────────────────
const RegistrationFlowModal: React.FC<{
  student: Student;
  registrationFeeTypes: any[];
  clearanceItems: InventoryItem[];
  onComplete: (registrationFeeId: number | null, feeAmount: number, selectedItems: CartItem[], paymentMode: 'Cash' | 'POS_Transfer') => void;
  onCancel: () => void;
  processing: boolean;
  error: string;
}> = ({ student, registrationFeeTypes, clearanceItems, onComplete, onCancel, processing, error }) => {
  const [selectedFeeId, setSelectedFeeId] = useState<number | null>(null);
  const [feeAmount, setFeeAmount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS_Transfer'>('Cash');

  useEffect(() => {
    if (registrationFeeTypes.length === 1) {
      setSelectedFeeId(registrationFeeTypes[0].id);
      setFeeAmount(Number(registrationFeeTypes[0].amount));
    }
  }, [registrationFeeTypes]);

  const toggleItem = (item: InventoryItem) => {
    setSelectedItems((prev) => {
      const ex = prev.find((i) => i.item_id === item.item_id);
      if (ex) return prev.filter((i) => i.item_id !== item.item_id);
      return [...prev, { item_id: item.item_id, item_name: item.item_name, selling_price: item.selling_price, quantity: 1 }];
    });
  };

  const total = feeAmount + selectedItems.reduce((s, i) => s + i.selling_price * i.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">New Student Registration</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mb-4">
          <div className="font-semibold text-warning-800">{student.name}</div>
          <div className="text-sm text-warning-600">{student.student_class} · New Admission</div>
        </div>

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        {/* Registration Fee */}
        {registrationFeeTypes.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Registration Fee</label>
            <div className="space-y-2">
              {registrationFeeTypes.map((ft) => (
                <button key={ft.id} onClick={() => { setSelectedFeeId(ft.id); setFeeAmount(Number(ft.amount)); }}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedFeeId === ft.id ? 'border-warning-500 bg-warning-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <div className="flex justify-between">
                    <span className="font-medium text-sm">{ft.name}</span>
                    <span className="font-bold">{fmt(Number(ft.amount))}</span>
                  </div>
                  {ft.description && <div className="text-xs text-gray-500 mt-0.5">{ft.description}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clearance Items */}
        {clearanceItems.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Inventory Clearance Items</label>
            <p className="text-xs text-gray-400 mb-2">Select items to issue to the student (stock will be decremented)</p>
            <div className="space-y-2">
              {clearanceItems.map((item) => {
                const isSelected = selectedItems.some((i) => i.item_id === item.item_id);
                return (
                  <button key={item.item_id} onClick={() => item.stock_quantity > 0 && toggleItem(item)}
                    disabled={item.stock_quantity <= 0}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-primary-500 bg-primary-50' : item.stock_quantity <= 0 ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-sm">{item.item_name}</span>
                        {item.category_name && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: item.category_color || '#6b7280' }}>{item.category_name}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{fmt(item.selling_price)}</span>
                        <div className={`text-xs ${item.stock_quantity <= 0 ? 'text-danger-500' : 'text-gray-400'}`}>
                          {item.stock_quantity <= 0 ? 'Out of stock' : `${item.stock_quantity} avail.`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
          {feeAmount > 0 && <div className="flex justify-between text-sm"><span>Registration Fee</span><span className="font-semibold">{fmt(feeAmount)}</span></div>}
          {selectedItems.map((i) => <div key={i.item_id} className="flex justify-between text-sm"><span>{i.item_name}</span><span>{fmt(i.selling_price)}</span></div>)}
          <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{fmt(total)}</span></div>
        </div>

        {/* Payment Method */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}><Banknote className="w-4 h-4" /> CASH</button>
          <button onClick={() => setPaymentMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}><CreditCard className="w-4 h-4" /> POS</button>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
          <button onClick={() => total > 0 && onComplete(selectedFeeId, feeAmount, selectedItems, paymentMode)} disabled={processing || total <= 0} className="flex-1 py-2.5 bg-success-600 text-white rounded-xl text-sm font-semibold hover:bg-success-700 disabled:opacity-50">
            {processing ? 'Processing…' : `Complete Registration (${fmt(total)})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Student Quick List (with pagination + Pending Applicants toggle) ──────────
const StudentQuickList: React.FC<{ onSelect: (s: Student) => void; onSelectApplicant?: (a: any) => void }> = ({ onSelect, onSelectApplicant }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cls, setCls] = useState('all');
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const pageSize = 12;

  useEffect(() => { studentAPI.getClasses().then(setClasses).catch(console.error); }, []);
  useEffect(() => {
    setLoading(true);
    if (showPending) {
      applicantAPI.getAll({ search: search || undefined }).then((data: any[]) => {
        const nonEnrolled = data.filter((a: any) => a.status !== 'enrolled');
        setApplicants(nonEnrolled);
        setTotal(nonEnrolled.length);
        setStudents([]);
      }).catch(console.error).finally(() => setLoading(false));
    } else {
      studentAPI.getAll({ search, class: cls, page, pageSize, hasBalance: debtorsOnly || undefined }).then((d) => {
        setStudents(d.students); setTotal(d.total); setApplicants([]);
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [search, cls, page, debtorsOnly, showPending]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder={showPending ? 'Search pending applicants…' : 'Search by name…'} />
        </div>
        {!showPending && (
          <select value={cls} onChange={(e) => { setCls(e.target.value); setPage(1); }} className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="all">All Classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => { setShowPending((v) => !v); setPage(1); setSearch(''); }}
          className={`shrink-0 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${showPending ? 'bg-warning-500 border-warning-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-warning-400 hover:text-warning-600'}`}
        >
          Pending Applicants
        </button>
        {!showPending && (
          <button
            type="button"
            onClick={() => { setDebtorsOnly((v) => !v); setPage(1); }}
            className={`shrink-0 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${debtorsOnly ? 'bg-danger-600 border-danger-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-danger-400 hover:text-danger-600'}`}
          >
            Balance Due Only
          </button>
        )}
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : showPending ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {applicants.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-300 text-sm">No pending applicants found</div>
          ) : applicants.map((a: any) => (
            <button key={a.id} onClick={() => onSelectApplicant?.(a)} className="bg-white rounded-xl p-4 text-left border border-warning-200 hover:border-warning-400 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 bg-warning-100 rounded-full flex items-center justify-center text-warning-700 font-bold text-sm">{a.full_name.charAt(0)}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.status === 'eligible' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'}`}>
                  {a.status === 'eligible' ? 'Eligible' : 'Pending'}
                </span>
              </div>
              <div className="font-semibold text-sm text-gray-900">{a.full_name}</div>
              <div className="text-xs text-gray-400">{a.proposed_class || 'Class TBD'} · #{a.id}</div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {students.map((s) => (
              <button key={s.student_id} onClick={() => onSelect(s)} className="bg-white rounded-xl p-4 text-left border hover:border-primary-400 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">{s.name.charAt(0)}</div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.student_class}</span>
                </div>
                <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                <div className="text-xs text-gray-400 font-mono">{s.student_id}</div>
                {s.current_fees_owed > 0 ? <div className="mt-1 text-xs font-bold text-danger-600">{fmt(s.current_fees_owed)} owed</div>
                  : <div className="mt-1 text-xs font-bold text-success-600">No fees owed</div>}
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Hardcoded fallback prices (used when no configured bundle exists for the tier)
const FALLBACK_FEES: Record<string, Record<'Day' | 'Boarding', number>> = {
  JUNIOR:   { Day: 306_000, Boarding: 448_600 },
  SENIOR:   { Day: 323_300, Boarding: 467_300 },
  REMEDIAL: { Day: 350_500, Boarding: 503_100 },
};
const COACHING_FEE_AMOUNT = 10_000;

// ─── Walk-In Registration Fee Modal ──────────────────────────────────────────
const WalkInRegistrationFeeModal: React.FC<{
  applicantName: string;
  proposedClass: string;
  studentStatus: 'Day' | 'Boarding';
  matchedBundle: Bundle | null;
  categoryGroup: string | null;
  onConfirm: (mode: 'Cash' | 'POS_Transfer', total: number, coachingIncluded: boolean, balanceDue?: number, autoIssue?: boolean) => void;
  onCancel: () => void;
  processing: boolean;
  error: string;
}> = ({ applicantName, proposedClass, studentStatus, matchedBundle, categoryGroup, onConfirm, onCancel, processing, error }) => {
  const [payMode, setPayMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [coachingAddon, setCoachingAddon] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'half'>('full');
  const [autoIssue, setAutoIssue] = useState(true);
  const [stockLevels, setStockLevels] = useState<Record<number, number>>({});
  const [stockLoaded, setStockLoaded] = useState(false);

  // Check live inventory stock for every item in the bundle before rendering it
  useEffect(() => {
    const itemIds = matchedBundle?.items?.map((i) => i.item_id) || [];
    if (itemIds.length === 0) { setStockLevels({}); setStockLoaded(true); return; }
    setStockLoaded(false);
    inventoryAPI.getStockLevels(itemIds)
      .then((levels) => setStockLevels(levels))
      .catch(() => setStockLevels({}))
      .finally(() => setStockLoaded(true));
  }, [matchedBundle]);

  const COACHING_FEE = COACHING_FEE_AMOUNT;
  const fallbackPrices = categoryGroup ? FALLBACK_FEES[categoryGroup] : null;

  const isBundleMode = !!matchedBundle;
  const isFallbackMode = !matchedBundle && !!fallbackPrices;
  const canProceed = isBundleMode || isFallbackMode;

  const base = isBundleMode
    ? matchedBundle!.base_price
    : (fallbackPrices ? fallbackPrices[studentStatus] : 0);

  // Coaching: bundle mode = driven by bundle.coaching_addon; fallback mode = Junior/Senior only (never Remedial)
  const hasCoaching = isBundleMode
    ? !!matchedBundle!.coaching_addon
    : (isFallbackMode && categoryGroup !== 'REMEDIAL');

  const fullTotal = base + (coachingAddon ? COACHING_FEE : 0);
  const halfTotal = Math.ceil(base / 2) + (coachingAddon ? COACHING_FEE : 0);
  const total = paymentType === 'full' ? fullTotal : halfTotal;
  const balanceDue = paymentType === 'half' ? (base - Math.ceil(base / 2)) : 0;

  // Cap each bundle item's quantity to live stock and mark out-of-stock items so
  // they never make it into the print/receipt payload handed to the storekeeper.
  // Until the live stock check resolves, treat items as unavailable (0) rather than
  // assuming the configured bundle quantity is in stock.
  const stockCappedItems = (matchedBundle?.items || []).map((item) => {
    const available = stockLoaded ? (stockLevels[item.item_id] ?? 0) : 0;
    return {
      ...item,
      availableStock: available,
      outOfStock: available <= 0,
      quantity: Math.max(0, Math.min(item.quantity, available)),
    };
  });
  const inStockBundleItems = stockCappedItems.filter((i) => !i.outOfStock && i.quantity > 0);

  const tierColor: Record<string, string> = {
    JUNIOR: 'bg-blue-100 text-blue-700',
    SENIOR: 'bg-indigo-100 text-indigo-700',
    REMEDIAL: 'bg-amber-100 text-amber-700',
  };
  const tierLabel: Record<string, string> = {
    JUNIOR: 'JSS1–3',
    SENIOR: 'SS1–3',
    REMEDIAL: 'Remedial',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Registration Fee Payment</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-sm font-semibold text-warning-800">{applicantName}</p>
          <p className="text-xs text-warning-600 mt-0.5">{proposedClass || 'No class'} · {studentStatus} Student</p>
        </div>

        {/* Hard error: class has no category assigned at all */}
        {!matchedBundle && !fallbackPrices && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-700">
              This class has no category group assigned. Go to <strong>Admin → School Settings → Class Category Groups</strong> and assign JUNIOR, SENIOR, or REMEDIAL to this class first.
            </p>
          </div>
        )}

        {/* Soft warning: category known but no bundle configured yet — using hardcoded fallback */}
        {!matchedBundle && isFallbackMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">No Registration bundle configured for <strong>{categoryGroup}</strong> · {studentStatus}. Using official baseline price. Create a bundle in <strong>Bundle Management</strong> to include inventory items.</p>
          </div>
        )}

        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        {canProceed && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                {(matchedBundle?.class_category || categoryGroup) && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierColor[matchedBundle?.class_category || categoryGroup || ''] || 'bg-gray-100 text-gray-600'}`}>
                    {tierLabel[matchedBundle?.class_category || categoryGroup || ''] || (matchedBundle?.class_category || categoryGroup)}
                  </span>
                )}
                {matchedBundle
                  ? <><span className="text-xs text-gray-500 font-medium">{matchedBundle.name}</span><span className="text-xs text-gray-400">{studentStatus === 'Boarding' ? '· Boarding' : '· Day'}</span></>
                  : <span className="text-xs text-gray-500">Official Baseline Price</span>
                }
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Base Registration Fee</span>
                <span className="font-semibold">{fmt(base)}</span>
              </div>

              {matchedBundle && stockCappedItems.length > 0 && (
                <div className="border-t pt-2 mt-1 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Included Items</p>
                  {stockCappedItems.map((item) => (
                    <div key={item.item_id} className={`flex justify-between text-xs ${item.outOfStock ? 'text-danger-500' : 'text-gray-600'}`}>
                      <span>
                        {item.item_name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                        {item.outOfStock && <span className="ml-2 font-bold uppercase text-[10px] bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded">Out of Stock</span>}
                      </span>
                      <span>{item.outOfStock ? '—' : fmt(item.selling_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              {hasCoaching && (
                <label className="flex items-center gap-3 cursor-pointer bg-white border border-gray-200 rounded-lg px-3 py-2 mt-1 hover:border-primary-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={coachingAddon}
                    onChange={(e) => setCoachingAddon(e.target.checked)}
                    className="rounded accent-primary-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">Add Coaching Fee</span>
                    <span className="text-xs text-gray-400 ml-2">(optional)</span>
                  </div>
                  <span className="text-sm font-semibold text-primary-700">+{fmt(COACHING_FEE)}</span>
                </label>
              )}

              {/* Payment Type Toggle - Full vs Half */}
              <div className="border-t pt-3 mt-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('full')}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${paymentType === 'full' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}
                  >
                    <div className="text-xs opacity-80">Full Payment</div>
                    <div className="text-base">{fmt(fullTotal)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('half')}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${paymentType === 'half' ? 'bg-warning-500 border-warning-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-warning-400'}`}
                  >
                    <div className="text-xs opacity-80">Half Payment</div>
                    <div className="text-base">{fmt(halfTotal)}</div>
                  </button>
                </div>
                {paymentType === 'half' && (
                  <div className="mt-2 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2 text-xs text-warning-800">
                    <div className="font-semibold mb-1">Installment Payment Selected</div>
                    <div>Balance due: <span className="font-bold">{fmt(balanceDue)}</span></div>
                    <div className="text-warning-600 mt-1">This will be recorded in the student's account for later collection.</div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="font-bold text-gray-900">{paymentType === 'full' ? 'Total' : 'Amount to Pay'}</span>
                <span className="text-xl font-extrabold text-primary-600">{fmt(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <button type="button" onClick={() => setPayMode('Cash')}
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                Cash
              </button>
              <button type="button" onClick={() => setPayMode('POS_Transfer')}
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                POS / Transfer
              </button>
            </div>
          </>
        )}

        {/* Auto-issuance toggle — show only when bundle has physical items */}
        {inStockBundleItems.length > 0 && (
          <label className="flex items-start gap-3 cursor-pointer bg-success-50 border border-success-200 rounded-xl px-3 py-2.5 mb-3 hover:border-success-400 transition-colors">
            <input type="checkbox" checked={autoIssue} onChange={(e) => setAutoIssue(e.target.checked)} className="mt-0.5 rounded accent-success-600" />
            <div>
              <span className="text-sm font-semibold text-success-800">Hand over available items right now</span>
              <p className="text-xs text-success-600 mt-0.5">Items in stock will be <strong>Issued</strong> and deducted from inventory immediately. Uncheck for <strong>Pending Collection</strong>.</p>
            </div>
          </label>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
          {canProceed && (
            <button
              onClick={() => onConfirm(payMode, total, coachingAddon, paymentType === 'half' ? balanceDue : undefined, autoIssue)}
              disabled={processing || (isBundleMode && (matchedBundle!.items?.length || 0) > 0 && !stockLoaded)}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {processing ? 'Processing…' : !stockLoaded && isBundleMode && (matchedBundle!.items?.length || 0) > 0 ? 'Checking stock…' : `Confirm ${fmt(total)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Walk-In Locked Form Payment Modal ───────────────────────────────────────
const WalkInFormModal: React.FC<{
  applicantName: string;
  onConfirm: (mode: 'Cash' | 'POS_Transfer', autoIssue: boolean) => void;
  onCancel: () => void;
  processing: boolean;
  error: string;
}> = ({ applicantName, onConfirm, onCancel, processing, error }) => {
  const [payMode, setPayMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [autoIssue, setAutoIssue] = useState(true);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Admission Form Purchase</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-sm font-semibold text-warning-800">{applicantName}</p>
        </div>
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Admission Application Form</span>
            <span className="text-gray-500">× 1</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-bold text-gray-900">Total (Locked)</span>
            <span className="text-xl font-extrabold text-primary-600">₦3,000.00</span>
          </div>
          <p className="text-xs text-gray-400">1 unit will be deducted from Admission Form inventory</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button type="button" onClick={() => setPayMode('Cash')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>Cash</button>
          <button type="button" onClick={() => setPayMode('POS_Transfer')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>POS / Transfer</button>
        </div>
        <label className="flex items-start gap-3 cursor-pointer bg-success-50 border border-success-200 rounded-xl px-3 py-2.5 mb-4 hover:border-success-400 transition-colors">
          <input type="checkbox" checked={autoIssue} onChange={(e) => setAutoIssue(e.target.checked)} className="mt-0.5 rounded accent-success-600" />
          <div>
            <span className="text-sm font-semibold text-success-800">Hand over the form right now</span>
            <p className="text-xs text-success-600 mt-0.5">Uncheck to create a <strong>Pending Collection</strong> entry without deducting inventory yet.</p>
          </div>
        </label>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(payMode, autoIssue)} disabled={processing} className="flex-1 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-semibold hover:bg-warning-600 disabled:opacity-50">{processing ? 'Processing…' : 'Confirm ₦3,000'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Walk-In Locked Bundle Payment Modal (Acceptance / Registration) ──────────
const WalkInBundleModal: React.FC<{
  title: string;
  applicantName: string;
  bundle: Bundle;
  onConfirm: (mode: 'Cash' | 'POS_Transfer', autoIssue: boolean) => void;
  onCancel: () => void;
  processing: boolean;
  error: string;
}> = ({ title, applicantName, bundle, onConfirm, onCancel, processing, error }) => {
  const [payMode, setPayMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [autoIssue, setAutoIssue] = useState(true);
  const [stockLevels, setStockLevels] = useState<Record<number, number>>({});
  const [stockLoaded, setStockLoaded] = useState(false);

  useEffect(() => {
    const itemIds = bundle.items?.map((i) => i.item_id) || [];
    if (itemIds.length === 0) { setStockLevels({}); setStockLoaded(true); return; }
    setStockLoaded(false);
    inventoryAPI.getStockLevels(itemIds)
      .then(setStockLevels)
      .catch(() => setStockLevels({}))
      .finally(() => setStockLoaded(true));
  }, [bundle]);

  const stockCappedItems = (bundle.items || []).map((item) => {
    const available = stockLoaded ? (stockLevels[item.item_id] ?? 0) : 0;
    return { ...item, outOfStock: available <= 0, quantity: Math.max(0, Math.min(item.quantity, available)) };
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-sm font-semibold text-warning-800">{applicantName}</p>
          {bundle.applicable_to && bundle.applicable_to !== 'All Students' && (
            <p className="text-xs text-warning-600 mt-0.5">{bundle.applicable_to}</p>
          )}
        </div>
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
          {stockCappedItems.map((item) => (
            <div key={item.item_id} className={`flex justify-between text-sm ${item.outOfStock ? 'text-danger-500' : ''}`}>
              <span className={item.outOfStock ? '' : 'text-gray-700'}>
                {item.item_name} × {item.quantity}
                {item.outOfStock && <span className="ml-2 font-bold uppercase text-[10px] bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded">Out of Stock</span>}
              </span>
              <span className="text-gray-500">{item.outOfStock ? '—' : fmt(item.selling_price * item.quantity)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 mt-1">
            <span className="font-bold text-gray-900">Total (Locked)</span>
            <span className="text-xl font-extrabold text-primary-600">{fmt(bundle.base_price)}</span>
          </div>
          <p className="text-xs text-warning-600 bg-warning-50 rounded px-2 py-1">Amount is fixed — cannot be modified at cashier level</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button type="button" onClick={() => setPayMode('Cash')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>Cash</button>
          <button type="button" onClick={() => setPayMode('POS_Transfer')} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${payMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>POS / Transfer</button>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
          <button onClick={() => onConfirm(payMode, autoIssue)} disabled={processing} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{processing ? 'Processing…' : `Confirm ${fmt(bundle.base_price)}`}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Main CashierPOS ─────────────────────────────────────────────────────────
const CashierPOS: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeShift, isStaleShift, openShift, closeShift } = useShift();

  const [tab, setTab] = useState<SideTab>('sale');
  const [saleMode, setSaleMode] = useState<SaleMode>('store');
  const [cartOpen, setCartOpen] = useState(false);

  // School settings for receipts
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  // Student selection
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [studentSuggestions, setStudentSuggestions] = useState<Student[]>([]);
  const [studentSuggTotal, setStudentSuggTotal] = useState(0);
  const [studentSuggPage, setStudentSuggPage] = useState(1);
  const [showStudentDrop, setShowStudentDrop] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const studentRef = useRef<HTMLDivElement>(null);
  const studentSuggPageSize = 10;

  // Store purchase
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [showCheckout, setShowCheckout] = useState(false);

  // Fees collection
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [classFees, setClassFees] = useState<any[]>([]);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [feesAmount, setFeesAmount] = useState('');
  const [feesDiscount, setFeesDiscount] = useState('');
  const [feesPayMode, setFeesPayMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  // Bundle payment info for fee collection
  const [bundlePaymentInfo, setBundlePaymentInfo] = useState<{
    hasBundle: boolean;
    isFullPayment: boolean;
    balanceDue: number;
    transactionId?: number;
    bundleAmount: number;
    academicTerm?: string;
  } | null>(null);
  const [showBundleBalancePayment, setShowBundleBalancePayment] = useState(false);
  const [bundleBalanceAmount, setBundleBalanceAmount] = useState('');
  const [bundleBalanceProcessing, setBundleBalanceProcessing] = useState(false);
  const [bundleFullyPaid, setBundleFullyPaid] = useState(false);

  // UI state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTxn, setLastTxn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [historyTxns, setHistoryTxns] = useState<any[]>([]);

  // Error modal
  const [errorMsg, setErrorMsg] = useState('');

  // Shift close flow
  const [shiftCloseStep, setShiftCloseStep] = useState<'none' | 'input' | 'result'>('none');
  const [shiftCloseResult, setShiftCloseResult] = useState<{ expectedCash: number; actualCash: number; difference: number } | null>(null);

  // Quick Add Student
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [quickAddedStudentIds, setQuickAddedStudentIds] = useState<Set<string>>(new Set());
  const [showQuickEditStudent, setShowQuickEditStudent] = useState(false);
  const [quickEditName, setQuickEditName] = useState('');
  const [quickEditClass, setQuickEditClass] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState('');

  // Class category map for fee engine
  const [classCategoryMap, setClassCategoryMap] = useState<Record<string, string>>({});

  // Walk-in applicant
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInError, setWalkInError] = useState('');
  const [walkInApplicant, setWalkInApplicant] = useState<any>(null);

  // Walk-in applicant inline edit
  const [walkInEditMode, setWalkInEditMode] = useState(false);
  const [walkInEditName, setWalkInEditName] = useState('');
  const [walkInEditClass, setWalkInEditClass] = useState('');
  const [walkInEditSaving, setWalkInEditSaving] = useState(false);

  // Bundle mode
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [showBundlePayment, setShowBundlePayment] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundleAmount, setBundleAmount] = useState('');
  const [bundlePayMode, setBundlePayMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [bundleProcessing, setBundleProcessing] = useState(false);
  const [bundleError, setBundleError] = useState('');

  // Walk-in locked payment modals
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [showWalkInAcceptance, setShowWalkInAcceptance] = useState(false);
  const [walkInAcceptanceBundle, setWalkInAcceptanceBundle] = useState<Bundle | null>(null);
  const [showWalkInRegistration, setShowWalkInRegistration] = useState(false);
  const [walkInRegistrationBundle, setWalkInRegistrationBundle] = useState<Bundle | null>(null);
  const [walkInCategoryGroup, setWalkInCategoryGroup] = useState<string | null>(null);
  const [walkInModalProcessing, setWalkInModalProcessing] = useState(false);
  const [walkInModalError, setWalkInModalError] = useState('');

  // Registration flow
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationFeeTypes, setRegistrationFeeTypes] = useState<any[]>([]);
  const [clearanceItems, setClearanceItems] = useState<InventoryItem[]>([]);
  const [regProcessing, setRegProcessing] = useState(false);
  const [regError, setRegError] = useState('');

  // Shift log search + reprint
  const [historySearch, setHistorySearch] = useState('');
  const [historyClass, setHistoryClass] = useState('all');

  // Expenses
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [shiftExpenses, setShiftExpenses] = useState<any[]>([]);

  // Load school settings + class category map on mount
  useEffect(() => {
    settingsAPI.get().then(setSchoolSettings).catch(console.error);
    setClassCategoryMap(settingsAPI.getClassCategoryMap());
  }, []);
  // Load classes
  useEffect(() => { studentAPI.getClasses().then(setClasses).catch(console.error); }, []);
  // Load categories
  useEffect(() => { categoryAPI.getAll().then(setCategories).catch(console.error); }, []);
  // Load bundles
  useEffect(() => { bundleAPI.getAll().then(setBundles).catch(console.error); }, []);

  // Inventory
  useEffect(() => {
    inventoryAPI.getAll({ search: itemSearch, categoryId: activeCat, activeOnly: true }).then(setInventory).catch(console.error);
  }, [itemSearch, activeCat]);

  // Student search suggestions (paginated)
  useEffect(() => {
    if (!studentSearch || selectedStudent) { setStudentSuggestions([]); setStudentSuggTotal(0); return; }
    // When "Pending Applicants" filter is active, search the applicants table instead
    if (studentClassFilter === '__pending__') {
      applicantAPI.getAll({ search: studentSearch }).then((applicants: any[]) => {
        const nonEnrolled = applicants.filter((a: any) => a.status !== 'enrolled');
        const mapped = nonEnrolled.map((a: any) => ({
          student_id: `__applicant__${a.id}`,
          name: a.full_name,
          student_class: a.proposed_class || 'Pending',
          current_fees_owed: 0,
          _isApplicant: true,
          _applicant: a,
        })) as any[];
        setStudentSuggestions(mapped);
        setStudentSuggTotal(mapped.length);
        setShowStudentDrop(mapped.length > 0);
      }).catch(console.error);
      return;
    }
    studentAPI.getAll({
      search: studentSearch,
      class: studentClassFilter !== 'all' ? studentClassFilter : undefined,
      page: studentSuggPage,
      pageSize: studentSuggPageSize,
    }).then((d) => {
      setStudentSuggestions(d.students);
      setStudentSuggTotal(d.total);
      setShowStudentDrop(d.students.length > 0);
    }).catch(console.error);
  }, [studentSearch, studentClassFilter, selectedStudent, studentSuggPage]);

  // Student fees for fees tab - standard fees always load; bundle balance (if any) is appended separately
  useEffect(() => {
    if (selectedStudent && saleMode === 'fees') {
      setSelectedFee(null);
      setFeesAmount('');
      // Always load standard class fees — never hidden by a bundle balance
      studentFeeAPI.getForStudent(selectedStudent?.student_id).then((fees) => {
        setStudentFees((fees || []).filter((f: StudentFee) => f?.balance > 0));
      }).catch((e) => { console.error(e); setStudentFees([]); });
      feeTypeAPI.getByClass(selectedStudent?.student_class).then((ft) => setClassFees(ft || [])).catch((e) => { console.error(e); setClassFees([]); });
      // Separately, check for an outstanding bundle/registration balance for this student & term
      studentFeeAPI.checkStudentBundlePayment(selectedStudent?.student_id, schoolSettings?.current_term).then((bundleInfo) => {
        setBundlePaymentInfo(bundleInfo || null);
      }).catch((e) => { console.error(e); setBundlePaymentInfo(null); });
    }
  }, [selectedStudent, saleMode, schoolSettings?.current_term]);

  // Load shift history + expenses whenever activeShift changes (not just on history tab)
  useEffect(() => {
    if (activeShift) {
      transactionAPI.getHistory({}).then((d) => setHistoryTxns(d.filter((t: any) => t.shift_id === activeShift.id))).catch(console.error);
      expenseAPI.getExpensesByShift(activeShift.id).then(setShiftExpenses).catch(console.error);
    }
  }, [activeShift]);

  // Refresh history when returning to history tab
  useEffect(() => {
    if (tab === 'history' && activeShift) {
      transactionAPI.getHistory({}).then((d) => setHistoryTxns(d.filter((t: any) => t.shift_id === activeShift.id))).catch(console.error);
      expenseAPI.getExpensesByShift(activeShift.id).then(setShiftExpenses).catch(console.error);
    }
  }, [tab]);

  // Outside click for student dropdown
  useEffect(() => {
    const h = (e: MouseEvent) => { if (studentRef.current && !studentRef.current.contains(e.target as Node)) setShowStudentDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectStudent = (s: any) => {
    // When an applicant is selected from the pending filter, load them as a walk-in
    if (s._isApplicant && s._applicant) {
      setWalkInApplicant({ ...s._applicant });
      setStudentSearch('');
      setShowStudentDrop(false);
      return;
    }
    setSelectedStudent(s);
    setStudentSearch(s.name);
    setShowStudentDrop(false);
    setCart([]);
    setFeesAmount('');
    setSelectedFee(null);
    setSaleMode('store');
    setBundleFullyPaid(false);
  };

  const clearStudent = () => { setSelectedStudent(null); setStudentSearch(''); setCart([]); setFeesAmount(''); setSelectedFee(null); setBundleFullyPaid(false); };

  const addToCart = useCallback((item: InventoryItem) => {
    if (item.stock_quantity <= 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.item_id === item.item_id);
      if (ex) {
        if (ex.quantity >= item.stock_quantity) return prev;
        return prev.map((i) => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.item_id, item_name: item.item_name, selling_price: item.selling_price, quantity: 1 }];
    });
  }, []);

  const updateQty = (itemId: number, delta: number) =>
    setCart((prev) => prev.map((i) => i.item_id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));

  const cartTotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0);

  const handleStorePurchase = async () => {
    if (!selectedStudent || !activeShift || cart.length === 0 || loading) return;
    setLoading(true);
    try {
      const result = await transactionAPI.createPurchase(selectedStudent.student_id, activeShift.id, cart, paymentMode, selectedStudent.name, selectedStudent.student_class);
      if (result.success) {
        const receiptTxn = {
          transaction_id: result.transaction_id,
          timestamp: new Date().toISOString(),
          student_name: selectedStudent.name,
          student_class: selectedStudent.student_class,
          payment_mode: paymentMode,
        };
        const cartTotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0);
        setLastTxn({
          transaction: receiptTxn,
          total: cartTotal,
          items: cart.map(i => ({ item_name: i.item_name, quantity: i.quantity, unit_price: i.selling_price, total_price: i.selling_price * i.quantity })),
          isFees: false,
          isRegistration: false
        });
        setShowCheckout(false);
        setShowReceipt(true);
        setCart([]);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      } else setErrorMsg('Transaction failed: ' + (result as any).error);
    } catch (e) { setErrorMsg('Error: ' + (e as Error).message); }
    setLoading(false);
  };

  const handleFeesPayment = async () => {
    if (!selectedStudent || !activeShift || !selectedFee || loading) return;
    const amount = parseFloat(feesAmount);
    const discount = feesDiscount ? parseFloat(feesDiscount) : 0;
    if (isNaN(amount) || amount <= 0) { setErrorMsg('Enter a valid amount.'); return; }
    const netBalance = selectedFee.balance - (isNaN(discount) ? 0 : discount);
    if (amount > netBalance) {
      setErrorMsg(`Cannot pay ${fmt(amount)} — the net balance after discount is ${fmt(netBalance)}.`);
      return;
    }
    setLoading(true);
    try {
      if (discount > 0) {
        await studentFeeAPI.applyDiscount(selectedFee.id, selectedStudent.student_id, discount);
      }
      const result = await studentFeeAPI.recordPayment(selectedFee.id, amount, selectedStudent.student_id, activeShift.id, feesPayMode, selectedStudent.name, selectedStudent.student_class);
      if (result.success) {
        const updated = await studentAPI.getById(selectedStudent.student_id);
        if (updated) setSelectedStudent(updated);
        const receipTxn = {
          transaction_id: Date.now(),
          timestamp: new Date().toISOString(),
          student_name: selectedStudent.name,
          student_class: selectedStudent.student_class,
          payment_mode: feesPayMode,
          fee_type_name: selectedFee.fee_name,
        };
        setLastTxn({ isFees: true, isRegistration: false, transaction: receipTxn, total: amount, items: [] });
        setShowReceipt(true);
        studentFeeAPI.getForStudent(selectedStudent.student_id).then((fees) => {
          setStudentFees(fees.filter((f: StudentFee) => f.balance > 0));
          setSelectedFee(null);
          setFeesAmount('');
          setFeesDiscount('');
        });
      } else setErrorMsg('Failed to process payment');
    } catch (e) { setErrorMsg((e as Error).message); }
    setLoading(false);
  };

  // Bundle balance payment handler
  const handleBundleBalancePayment = async () => {
    if (!selectedStudent || !activeShift || !bundlePaymentInfo?.transactionId || bundleBalanceProcessing) return;
    const amount = parseFloat(bundleBalanceAmount);
    if (isNaN(amount) || amount <= 0) { setErrorMsg('Enter a valid amount.'); return; }
    if (amount > bundlePaymentInfo.balanceDue) {
      setErrorMsg(`Cannot pay ${fmt(amount)} — the outstanding balance is only ${fmt(bundlePaymentInfo.balanceDue)}.`);
      return;
    }
    setBundleBalanceProcessing(true);
    setErrorMsg('');
    try {
      const result = await studentFeeAPI.recordBundleBalancePayment({
        transactionId: bundlePaymentInfo.transactionId,
        studentId: selectedStudent.student_id,
        shiftId: activeShift.id,
        amount,
        paymentMode: feesPayMode,
        customerName: selectedStudent.name,
        targetClass: selectedStudent.student_class,
      });
      if (result.success) {
        const receiptTxn = {
          transaction_id: Date.now(),
          timestamp: new Date().toISOString(),
          student_name: selectedStudent.name,
          student_class: selectedStudent.student_class,
          payment_mode: feesPayMode,
          fee_type_name: 'Registration Fee Bundle - Installment Payment',
        };
        setLastTxn({ isFees: true, isRegistration: false, transaction: receiptTxn, total: amount, items: [] });
        setShowReceipt(true);
        // Refresh bundle info — detect when balance is fully cleared
        const updatedBundle = await studentFeeAPI.checkStudentBundlePayment(selectedStudent.student_id, schoolSettings?.current_term);
        setBundlePaymentInfo(updatedBundle);
        setBundleBalanceAmount('');
        setShowBundleBalancePayment(false);
        if (result.newBalance <= 0) {
          setBundleFullyPaid(true);
          setTimeout(() => setBundleFullyPaid(false), 5000);
        }
        const updated = await studentAPI.getById(selectedStudent.student_id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (e) { setErrorMsg((e as Error).message); }
    setBundleBalanceProcessing(false);
  };

  const handleShiftCloseRequest = async () => {
    if (!activeShift) return;
    try {
      const expectedCash = await shiftAPI.getExpectedCash(activeShift.id);
      setShiftCloseResult({ expectedCash, actualCash: 0, difference: 0 });
      setShiftCloseStep('input');
    } catch (e) {
      setErrorMsg('Failed to calculate expected cash: ' + (e as Error).message);
    }
  };

  const handleShiftCloseConfirm = async (closingCash: number) => {
    const result = await closeShift(closingCash, user?.id || 0);
    if (result) {
      setShiftCloseResult({ expectedCash: result.expectedCash, actualCash: closingCash, difference: result.difference });
      setShiftCloseStep('result');
    }
  };

  // Quick Edit Student handler (only for quick-added students in current shift)
  const handleQuickEditSave = async () => {
    if (!selectedStudent) return;
    if (!quickEditName.trim() || !quickEditClass) { setQuickEditError('Name and class are required.'); return; }
    setQuickEditSaving(true);
    setQuickEditError('');
    try {
      await studentAPI.update(selectedStudent.student_id, { name: quickEditName.trim(), studentClass: quickEditClass });
      const refreshed = await studentAPI.getById(selectedStudent.student_id);
      if (refreshed) selectStudent(refreshed);
      setShowQuickEditStudent(false);
    } catch (e) { setQuickEditError((e as Error).message); }
    setQuickEditSaving(false);
  };

  // Quick Add Student handler
  const handleQuickAddSave = async (data: { name: string; studentClass: string; studentStatus: 'Day' | 'Boarding' }) => {
    setQuickAddSaving(true);
    setQuickAddError('');
    try {
      const result = await studentAPI.create({ name: data.name, studentClass: data.studentClass, admissionType: 'Returning', studentStatus: data.studentStatus });
      if (result.success) {
        // Track this ID so cashier can edit it this shift
        setQuickAddedStudentIds((prev) => new Set([...prev, result.studentId]));

        // Assign all applicable standard fees before closing the modal so the
        // student immediately has ledger rows and appears in the Student Ledger view.
        // We get ALL fee types and filter in JS so comma-separated class_filter lists
        // (e.g. 'JSS1A,JSS1B') match correctly — the DB .eq() exact-match misses them.
        try {
          const allFeeTypes = await feeTypeAPI.getAll();
          const applicableFees = (allFeeTypes as any[]).filter((ft) => {
            if (ft.fee_category !== 'standard') return false;
            const appTo = ft.applicable_to || 'All Students';
            if (appTo === 'Day' && data.studentStatus !== 'Day') return false;
            if (appTo === 'Boarding' && data.studentStatus !== 'Boarding') return false;
            if (!ft.class_filter) return true; // applies to all classes
            return ft.class_filter.split(',').map((c: string) => c.trim()).includes(data.studentClass);
          });
          for (const ft of applicableFees) {
            await feeTypeAPI.assignToStudents(
              ft.id, Number(ft.amount), undefined, result.studentId, 'standard',
              ft.applicable_to !== 'All Students' ? ft.applicable_to : undefined,
            );
          }
        } catch (feeErr) {
          console.warn('Quick Add: fee assignment failed (non-fatal):', feeErr);
        }

        const refreshed = await studentAPI.getById(result.studentId);
        if (refreshed) selectStudent(refreshed);
        setShowQuickAdd(false);
      } else {
        setQuickAddError(result.error || 'Failed to create student');
      }
    } catch (e) {
      setQuickAddError((e as Error).message);
    }
    setQuickAddSaving(false);
  };

  // Registration flow completion
  const handleRegistrationComplete = async (registrationFeeId: number | null, feeAmount: number, selectedItems: CartItem[], payMode: 'Cash' | 'POS_Transfer') => {
    if (!selectedStudent || !activeShift) return;
    setRegProcessing(true);
    setRegError('');
    try {
      const result = await transactionAPI.createRegistration(selectedStudent.student_id, activeShift.id, registrationFeeId, feeAmount, selectedItems, payMode, selectedStudent.name, selectedStudent.student_class);
      if (result.success) {
        setShowRegistration(false);
        // Build receipt data
        const receiptTxn = {
          transaction_id: result.transactionId,
          timestamp: new Date().toISOString(),
          student_name: selectedStudent.name,
          student_class: selectedStudent.student_class,
          payment_mode: payMode,
          fee_type_name: 'Registration Package',
        };
        const allItems = [
          ...(feeAmount > 0 ? [{ item_name: 'Registration Fee', quantity: 1, total_price: feeAmount }] : []),
          ...selectedItems.map((i) => ({ item_name: i.item_name, quantity: i.quantity, total_price: i.selling_price * i.quantity })),
        ];
        setLastTxn({ isFees: false, isRegistration: true, transaction: receiptTxn, total: result.total, items: allItems });
        setShowReceipt(true);
        // Refresh student data
        const refreshed = await studentAPI.getById(selectedStudent.student_id);
        if (refreshed) setSelectedStudent(refreshed);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      } else {
        setRegError('Registration failed');
      }
    } catch (e) {
      setRegError((e as Error).message);
    }
    setRegProcessing(false);
  };

  // Shift log reprint
  const handleReprint = async (txnId: number) => {
    try {
      const details = await transactionAPI.getDetails(txnId);
      if (details && details.transaction) {
        const txnType = details.transaction.type || 'STORE_PURCHASE';
        const isFees = txnType === 'FEES_CASH_COLLECTION';
        const isRegistration = txnType === 'REGISTRATION_PAYMENT';
        const isBundle = txnType === 'BUNDLE_PURCHASE' || txnType === 'ACCEPTANCE_FEE';
        // Format transaction for buildReceiptHtml with proper name/class/balance
        const printTxn = {
          ...details.transaction,
          customer_name: details.transaction.customer_name || details.transaction.student_name || details.students?.name,
          target_class: details.transaction.target_class || details.transaction.student_class || details.students?.student_class,
        };
        printReceipt(buildReceiptHtml(schoolSettings, printTxn, Number(details.transaction.amount_paid), details.items, isFees, isRegistration || isBundle));
      }
    } catch (e) { setErrorMsg('Failed to load receipt: ' + (e as Error).message); }
  };

  // Expense handlers
  const handleAddExpense = async (data: { category: string; amount: number; paymentMode: 'Cash Drawer'; description: string }) => {
    if (!activeShift) return;
    setExpenseSaving(true);
    setExpenseError('');
    try {
      const result = await expenseAPI.addExpense({
        shiftId: activeShift.id,
        category: data.category,
        amount: data.amount,
        paymentMode: 'Cash Drawer',
        description: data.description,
        createdBy: user?.id,
      });
      if (result.success) {
        setShowExpenseModal(false);
        // Reload expenses
        const expenses = await expenseAPI.getExpensesByShift(activeShift.id);
        setShiftExpenses(expenses);
      } else {
        setExpenseError(result.error || 'Failed to record expense');
      }
    } catch (e) {
      setExpenseError((e as Error).message);
    }
    setExpenseSaving(false);
  };

  // Walk-in applicant handlers
  const handleWalkInCreate = async (data: { firstName: string; lastName: string; proposedClass: string; studentStatus: 'Day' | 'Boarding' }) => {
    setWalkInSaving(true);
    setWalkInError('');
    try {
      // Duplicate guard: warn if a non-enrolled applicant with same name + class already exists
      const existingApplicants = await applicantAPI.getAll({ search: `${data.firstName} ${data.lastName}` });
      const duplicate = existingApplicants.find((a: any) =>
        a.first_name?.toLowerCase() === data.firstName.toLowerCase() &&
        a.last_name?.toLowerCase() === data.lastName.toLowerCase() &&
        a.proposed_class === data.proposedClass &&
        a.status !== 'enrolled'
      );
      if (duplicate) {
        setWalkInError(`An applicant named "${data.firstName} ${data.lastName}" for ${data.proposedClass} already exists (ID #${duplicate.id}). Use the "Pending Applicants" filter in the customer search to find and select them instead of creating a duplicate.`);
        setWalkInSaving(false);
        return;
      }
      const result = await applicantAPI.create({ firstName: data.firstName, lastName: data.lastName, proposedClass: data.proposedClass, studentStatus: data.studentStatus });
      if (result.success) {
        const applicant = await applicantAPI.getById(result.id);
        setWalkInApplicant({ ...applicant, student_status: data.studentStatus });
        setShowWalkIn(false);
        // Action menu will now appear — no auto popup
      } else setWalkInError(result.error || 'Failed to create applicant');
    } catch (e) {
      setWalkInError((e as Error).message);
    }
    setWalkInSaving(false);
  };

  // Walk-in applicant edit handler
  const handleWalkInEditSave = async () => {
    if (!walkInApplicant || !walkInEditName.trim()) return;
    setWalkInEditSaving(true);
    try {
      await applicantAPI.update(walkInApplicant.id, {
        full_name: walkInEditName.trim(),
        proposed_class: walkInEditClass,
      });
      setWalkInApplicant({ ...walkInApplicant, full_name: walkInEditName.trim(), proposed_class: walkInEditClass });
      setWalkInEditMode(false);
    } catch (e) {
      console.error('Failed to update applicant:', e);
    }
    setWalkInEditSaving(false);
  };

  const handleWalkInBundleAction = (bundleType: 'acceptance' | 'registration' | 'form') => {
    if (!walkInApplicant) return;
    setWalkInModalError('');
    if (bundleType === 'form') {
      setShowWalkInForm(true);
    } else if (bundleType === 'acceptance') {
      const bundle = bundles.find((b) => b.bundle_type === 'acceptance' && b.is_active);
      if (!bundle) { setErrorMsg('No active Acceptance Fee bundle found. Please create one in Bundle Management.'); return; }
      setWalkInAcceptanceBundle(bundle);
      setShowWalkInAcceptance(true);
    } else {
      // Registration — look up bundle by class_category + applicable_to
      const categoryGroup = classCategoryMap[walkInApplicant.proposed_class || ''] || null;
      const studentStatus = walkInApplicant.student_status || 'Day';
      const statusFilter = studentStatus === 'Day' ? 'Day Only' : 'Boarding Only';
      const regBundle = bundles.find(
        (b) => b.bundle_type === 'registration' && b.is_active && b.class_category === categoryGroup && b.applicable_to === statusFilter
      ) || null;
      setWalkInCategoryGroup(categoryGroup);
      setWalkInRegistrationBundle(regBundle);
      setShowWalkInRegistration(true);
    }
  };

  const handleWalkInFormConfirm = async (mode: 'Cash' | 'POS_Transfer', autoIssue: boolean) => {
    if (!walkInApplicant || !activeShift) return;
    setWalkInModalProcessing(true);
    setWalkInModalError('');
    try {
      const result = await bundlePaymentAPI.processFormPayment({
        applicantId: walkInApplicant.id, shiftId: activeShift.id, paymentMode: mode, autoIssue,
      });
      if (result.success) {
        setShowWalkInForm(false);
        const receiptTxn = { transaction_id: result.transactionId, timestamp: new Date().toISOString(), student_name: walkInApplicant.full_name, student_class: walkInApplicant.proposed_class || 'Applicant', payment_mode: mode, fee_type_name: 'Admission Form' };
        setLastTxn({ isFees: false, isRegistration: false, transaction: receiptTxn, total: 3000, items: result.items || [{ item_name: 'Admission Application Form', quantity: 1, total_price: 3000 }] });
        setShowReceipt(true);
        setWalkInApplicant(null);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      }
    } catch (e) { setWalkInModalError((e as Error).message); }
    setWalkInModalProcessing(false);
  };

  const handleWalkInAcceptanceConfirm = async (mode: 'Cash' | 'POS_Transfer', autoIssue: boolean) => {
    if (!walkInApplicant || !walkInAcceptanceBundle || !activeShift) return;
    setWalkInModalProcessing(true);
    setWalkInModalError('');
    try {
      const result = await bundlePaymentAPI.processBundlePayment({
        applicantId: walkInApplicant.id, bundleId: walkInAcceptanceBundle.id, shiftId: activeShift.id,
        amountPaid: walkInAcceptanceBundle.base_price, paymentMode: mode,
        minPartialFloor: schoolSettings?.min_acceptance_partial_floor || 5000,
        customerName: walkInApplicant.full_name, targetClass: walkInApplicant.proposed_class || undefined,
        autoIssue,
      });
      if (result.success) {
        setShowWalkInAcceptance(false);
        const receiptTxn = { transaction_id: result.transactionId, timestamp: new Date().toISOString(), student_name: walkInApplicant.full_name, student_class: walkInApplicant.proposed_class || 'Applicant', payment_mode: mode, fee_type_name: walkInAcceptanceBundle.name };
        setLastTxn({ isFees: false, isRegistration: true, transaction: receiptTxn, total: walkInAcceptanceBundle.base_price, items: result.items || [] });
        setShowReceipt(true);
        setWalkInApplicant(null); setWalkInAcceptanceBundle(null);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      }
    } catch (e) { setWalkInModalError((e as Error).message); }
    setWalkInModalProcessing(false);
  };

  const handleWalkInRegistrationConfirm = async (
    mode: 'Cash' | 'POS_Transfer',
    total: number,
    coachingIncluded: boolean,
    balanceDue?: number,
    autoIssue: boolean = true,
  ) => {
    if (!walkInApplicant || !activeShift) return;
    setWalkInModalProcessing(true);
    setWalkInModalError('');
    try {
      const categoryGroup = classCategoryMap[walkInApplicant.proposed_class || ''] || 'UNKNOWN';
      const studentStatus = walkInApplicant.student_status || 'Day';
      // Pass all bundle items to the API — the API's autoIssue logic handles
      // which ones to deduct from inventory vs. which go to Pending Collection.
      let bundleItems: { item_id: number; item_name: string; quantity: number; selling_price: number }[] | undefined = undefined;
      if (walkInRegistrationBundle?.items?.length) {
        bundleItems = walkInRegistrationBundle.items.map((item: any) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,       // API will cap to live stock server-side
          selling_price: item.selling_price,
        }));
      }
      const result = await bundlePaymentAPI.processDirectRegistrationPayment({
        applicantId: walkInApplicant.id, shiftId: activeShift.id,
        paymentMode: mode, amount: total, categoryGroup, studentStatus, coachingIncluded,
        customerName: walkInApplicant.full_name,
        targetClass: walkInApplicant.proposed_class || undefined,
        balanceDue,
        bundleItems,
        autoIssue,
      });
      if (result.success) {
        setShowWalkInRegistration(false);
        const receiptTxn = {
          transaction_id: result.transactionId,
          timestamp: new Date().toISOString(),
          student_name: walkInApplicant.full_name,
          student_class: walkInApplicant.proposed_class || 'Applicant',
          payment_mode: mode,
          fee_type_name: `Registration Package — ${categoryGroup}`,
          balance_due: balanceDue,
        };
        setLastTxn({ isFees: false, isRegistration: true, transaction: receiptTxn, total, items: result.items || [] });
        setShowReceipt(true);
        setWalkInApplicant(null);
        setWalkInRegistrationBundle(null);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      }
    } catch (e) { setWalkInModalError((e as Error).message); }
    setWalkInModalProcessing(false);
  };

  // Bundle payment handler
  const handleBundlePayment = async (autoIssue: boolean = true) => {
    if (!walkInApplicant || !selectedBundle || !activeShift) return;
    const amount = parseFloat(bundleAmount);
    if (isNaN(amount) || amount <= 0) { setBundleError('Enter a valid amount'); return; }

    const minFloor = selectedBundle.bundle_type === 'acceptance'
      ? schoolSettings?.min_acceptance_partial_floor || 5000
      : schoolSettings?.min_partial_payment_floor || 30000;

    setBundleProcessing(true);
    setBundleError('');
    try {
      const result = await bundlePaymentAPI.processBundlePayment({
        applicantId: walkInApplicant.id,
        bundleId: selectedBundle.id,
        shiftId: activeShift.id,
        amountPaid: amount,
        paymentMode: bundlePayMode,
        minPartialFloor: minFloor,
        customerName: walkInApplicant.full_name,
        targetClass: walkInApplicant.proposed_class || undefined,
        autoIssue,
      });
      if (result.success) {
        setShowBundlePayment(false);
        const receiptTxn = {
          transaction_id: result.transactionId,
          timestamp: new Date().toISOString(),
          student_name: walkInApplicant.full_name,
          student_class: walkInApplicant.proposed_class || 'Applicant',
          payment_mode: bundlePayMode,
          fee_type_name: selectedBundle.name,
        };
        setLastTxn({ isFees: false, isRegistration: true, transaction: receiptTxn, total: amount, items: result.items || [] });
        setShowReceipt(true);
        setWalkInApplicant(null);
        setSelectedBundle(null);
        inventoryAPI.getAll({ categoryId: activeCat, activeOnly: true }).then(setInventory);
      }
    } catch (e) {
      setBundleError((e as Error).message);
    }
    setBundleProcessing(false);
  };

  if (!activeShift) return <ShiftOpenForm userId={user?.id || 0} openShift={openShift} onLogout={logout} />;
  if (isStaleShift) return <StaleShiftLockout shift={activeShift} closeShift={closeShift} userId={user?.id || 0} onLogout={logout} />;

  const shiftCash = historyTxns.filter((t) => t.payment_mode === 'Cash').reduce((s, t) => s + Number(t.amount_paid), 0);
  const shiftPOS = historyTxns.filter((t) => t.payment_mode === 'POS_Transfer').reduce((s, t) => s + Number(t.amount_paid), 0);

  // Shift log filtered
  const filteredHistory = historyTxns.filter((t) => {
    if (historyClass !== 'all' && t.student_class !== historyClass) return false;
    if (historySearch) {
      const q = historySearch.toLowerCase();
      if (!t.student_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const studentSuggTotalPages = Math.ceil(studentSuggTotal / studentSuggPageSize);

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <aside className="w-16 bg-gray-900 flex flex-col items-center py-4 shrink-0">
        <div className="w-9 h-9 bg-success-500 rounded-lg flex items-center justify-center mb-6"><ShoppingCart className="w-5 h-5 text-white" /></div>
        {([
          { id: 'sale', icon: <ShoppingCart className="w-5 h-5" />, label: 'New Sale' },
          { id: 'history', icon: <FileText className="w-5 h-5" />, label: 'Shift Log' },
          { id: 'students', icon: <User className="w-5 h-5" />, label: 'Students' },
        ] as const).map((item) => (
          <button key={item.id} title={item.label} onClick={() => setTab(item.id)} className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-all ${tab === item.id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            {item.icon}
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button onClick={() => { setShowExpenseModal(true); setExpenseError(''); }} title="Record Expense" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-warning-600 hover:text-white transition-all"><Wallet className="w-5 h-5" /></button>
          <button onClick={handleShiftCloseRequest} title="Close Shift" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-danger-700 hover:text-white transition-all"><PowerOff className="w-5 h-5" /></button>
          <button onClick={logout} title="Log Out" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition-all"><LogOut className="w-5 h-5" /></button>
        </div>
      </aside>

      {/* ── NEW SALE TAB ────────────────────────────────────────────── */}
      {tab === 'sale' && (
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/* Center Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between shrink-0">
              <div><h1 className="font-bold text-gray-900">New Sale</h1><p className="text-xs text-gray-400">Shift #{activeShift.id} · {new Date(activeShift.opened_at).toLocaleTimeString()}</p></div>
              <span className="text-sm text-gray-600 font-medium">{user?.username}</span>
            </div>

            {/* Student Selector: name search + class filter */}
            <div className="bg-white border-b px-5 py-4 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Customer</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); setCart([]); setFeesAmount(''); setSelectedFee(null); setWalkInApplicant(null); setWalkInModalError(''); setWalkInError(''); setShowWalkInForm(false); setShowWalkInAcceptance(false); setShowWalkInRegistration(false); setWalkInAcceptanceBundle(null); setWalkInRegistrationBundle(null); setShowWalkIn(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-50 border border-warning-300 text-warning-700 hover:bg-warning-100 rounded-lg text-xs font-semibold transition-all">
                    <User className="w-3.5 h-3.5" /> Walk-In Applicant
                  </button>
                  <button onClick={() => { setShowQuickAdd(true); setQuickAddError(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-300 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-semibold transition-all">
                    <UserPlus className="w-3.5 h-3.5" /> Quick Add Student
                  </button>
                </div>
              </div>
              <div ref={studentRef} className="flex gap-2 relative">
                {/* Class filter */}
                <select value={studentClassFilter} onChange={(e) => { setStudentClassFilter(e.target.value); setSelectedStudent(null); setStudentSearch(''); setStudentSuggPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 shrink-0">
                  <option value="all">All Classes</option>
                  <option value="__pending__">Pending Applicants</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* Name search */}
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); if (selectedStudent) setSelectedStudent(null); setStudentSuggPage(1); }}
                    onFocus={() => studentSuggestions.length > 0 && setShowStudentDrop(true)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="Search by name…"
                  />
                  {selectedStudent && (
                    <button onClick={clearStudent} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  )}
                </div>
                {/* Dropdown with pagination */}
                {showStudentDrop && studentSuggestions.length > 0 && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-30">
                    <div className="max-h-60 overflow-auto">
                      {studentSuggestions.map((s) => (
                        <button key={s.student_id} onClick={() => selectStudent(s)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b last:border-0 text-left">
                          <div>
                            <div className="font-medium text-sm">{s.name}</div>
                            <div className="text-xs text-gray-400">{s.student_class} · {s.student_id}</div>
                          </div>
                          {s.current_fees_owed > 0 && <span className="text-xs font-bold text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">Owes {fmt(s.current_fees_owed)}</span>}
                        </button>
                      ))}
                    </div>
                    {studentSuggTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t bg-gray-50">
                        <button onClick={() => setStudentSuggPage((p) => Math.max(1, p - 1))} disabled={studentSuggPage <= 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs text-gray-500">{studentSuggPage}/{studentSuggTotalPages}</span>
                        <button onClick={() => setStudentSuggPage((p) => Math.min(studentSuggTotalPages, p + 1))} disabled={studentSuggPage >= studentSuggTotalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Walk-In Applicant Action Menu */}
              {walkInApplicant && !showBundlePayment && (
                <div className="mt-3 bg-warning-50 border border-warning-300 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-warning-200 rounded-lg flex items-center justify-center"><User className="w-4 h-4 text-warning-700" /></div>
                      <div className="flex-1">
                        {walkInEditMode ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={walkInEditName}
                              onChange={(e) => setWalkInEditName(e.target.value)}
                              className="text-sm font-bold text-warning-900 bg-white border border-warning-300 rounded px-2 py-1 w-40"
                              placeholder="Full name"
                            />
                            <select
                              value={walkInEditClass}
                              onChange={(e) => setWalkInEditClass(e.target.value)}
                              className="text-xs bg-white border border-warning-300 rounded px-2 py-1"
                            >
                              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-warning-900">{walkInApplicant.full_name}</div>
                            <div className="text-xs text-warning-600">{walkInApplicant.proposed_class || 'Walk-In Applicant'} · #{walkInApplicant.id}</div>
                          </>
                        )}
                      </div>
                    </div>
                    {walkInEditMode ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleWalkInEditSave}
                          disabled={walkInEditSaving || !walkInEditName.trim()}
                          className="px-2 py-1 bg-success-600 text-white text-xs font-semibold rounded hover:bg-success-700 disabled:opacity-50"
                        >
                          {walkInEditSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setWalkInEditMode(false)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setWalkInEditName(walkInApplicant.full_name || '');
                            setWalkInEditClass(walkInApplicant.proposed_class || classes[0] || '');
                            setWalkInEditMode(true);
                          }}
                          className="p-1.5 text-warning-500 hover:text-warning-700 hover:bg-warning-100 rounded"
                          title="Edit name/class"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setWalkInApplicant(null)} className="text-warning-400 hover:text-warning-600"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  {!walkInEditMode && (
                    <>
                      <p className="text-xs text-warning-700 mb-3">Applicant created. Choose a payment action:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleWalkInBundleAction('form')} className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all">
                          <span className="text-base font-extrabold">₦3k</span>
                          <span className="text-xs font-semibold">Form</span>
                        </button>
                        <button onClick={() => handleWalkInBundleAction('acceptance')} className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all">
                          <span className="text-base font-extrabold">₦</span>
                          <span className="text-xs font-semibold">Acceptance</span>
                        </button>
                        <button onClick={() => handleWalkInBundleAction('registration')} className="flex flex-col items-center gap-1 py-2.5 px-2 bg-white border border-warning-200 rounded-lg hover:bg-warning-100 text-warning-800 transition-all">
                          <span className="text-base font-extrabold">₦₦</span>
                          <span className="text-xs font-semibold">Registration</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Edit name/class for quick-added students only */}
              {selectedStudent && quickAddedStudentIds.has(selectedStudent.student_id) && (
                <div className="mt-2 flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2">
                  <span className="text-xs text-primary-700 font-medium flex-1">Quick-added this shift — name or class incorrect?</span>
                  <button
                    onClick={() => { setQuickEditName(selectedStudent.name); setQuickEditClass(selectedStudent.student_class); setQuickEditError(''); setShowQuickEditStudent(true); }}
                    className="flex items-center gap-1 px-2 py-1 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-xs font-semibold"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>
              )}

              {/* Debt Banner — locked, no X */}
              {selectedStudent && selectedStudent.current_fees_owed > 0 && (
                <div className="mt-3 flex items-center gap-3 bg-danger-600 text-white rounded-xl px-4 py-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Outstanding Fees</div>
                    <div className="text-xl font-extrabold">{fmt(selectedStudent.current_fees_owed)}</div>
                  </div>
                </div>
              )}

              {/* Mode Tabs */}
              {selectedStudent && (
                <div className="mt-3 flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setSaleMode('store')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === 'store' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Store Purchase</button>
                  <button onClick={() => setSaleMode('fees')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${saleMode === 'fees' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Collect Fees</button>
                </div>
              )}
            </div>

            {/* ─ STORE MODE ─────────────────────────────────────────── */}
            {selectedStudent && saleMode === 'store' && (
              <div className="flex-1 overflow-auto">
                {/* Category tabs */}
                <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
                  <button onClick={() => setActiveCat(null)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === null ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    <Tag className="w-3.5 h-3.5" /> All
                  </button>
                  {categories.map((c) => (
                    <button key={c.id} onClick={() => setActiveCat(c.id)} style={activeCat === c.id ? { background: c.color } : {}} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCat === c.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Search + Grid */}
                <div className="p-4">
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Search items or scan barcode…" />
                  </div>
                  <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                    {inventory.map((item) => (
                      <button key={item.item_id} onClick={() => addToCart(item)} disabled={item.stock_quantity <= 0}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${item.stock_quantity <= 0 ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white border-gray-200 hover:border-primary-400 hover:shadow-md active:scale-95'}`}
                      >
                        {item.category_name && (
                          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded text-white mb-1" style={{ background: item.category_color || '#6b7280' }}>{item.category_name}</span>
                        )}
                        <div className="font-medium text-sm text-gray-800 leading-tight mb-1">{item.item_name}</div>
                        <div className="text-base font-extrabold text-primary-600">{fmt(item.selling_price)}</div>
                        <div className={`text-xs mt-1 font-medium ${item.stock_quantity <= 5 ? 'text-danger-500' : item.stock_quantity <= 10 ? 'text-warning-600' : 'text-gray-400'}`}>
                          {item.stock_quantity <= 0 ? 'Out of stock' : `${item.stock_quantity} in stock`}
                        </div>
                      </button>
                    ))}
                  </div>
                  {inventory.length === 0 && <div className="text-center py-12 text-gray-300 text-sm">No items found</div>}
                </div>
              </div>
            )}

            {/* ─ FEES MODE ──────────────────────────────────────────── */}
            {selectedStudent && saleMode === 'fees' && (
              <div className="flex-1 overflow-auto p-4">
                <div className="max-w-lg mx-auto space-y-4 mt-2">
                  <h2 className="font-bold text-lg">Collect Fees</h2>
                  <p className="text-sm text-gray-500">Student: <strong>{selectedStudent.name}</strong> · {selectedStudent.student_class}</p>

                  {/* Outstanding bundle/registration balance card (appended, never hides standard fees) */}
                  {bundleFullyPaid ? (
                    <div className="flex items-center gap-3 bg-success-50 border border-success-300 rounded-xl p-4">
                      <CheckCircle className="w-6 h-6 text-success-600 shrink-0" />
                      <div>
                        <div className="font-bold text-success-800">Bundle Fully Paid</div>
                        <div className="text-sm text-success-600">Registration fee bundle balance has been cleared.</div>
                      </div>
                    </div>
                  ) : bundlePaymentInfo?.hasBundle && !bundlePaymentInfo?.isFullPayment && (bundlePaymentInfo?.balanceDue ?? 0) > 0 ? (
                    <div className="space-y-3">
                      <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-warning-600" />
                          <span className="font-semibold text-warning-800">Registration Fee Bundle - Outstanding Balance</span>
                        </div>
                        <p className="text-sm text-warning-700 mb-2">This student has an outstanding balance on their registration bundle.</p>
                        <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-warning-200">
                          <span className="font-medium text-gray-700">Outstanding Balance:</span>
                          <span className="text-xl font-extrabold text-danger-600">{fmt(bundlePaymentInfo?.balanceDue)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setBundleBalanceAmount(String(bundlePaymentInfo?.balanceDue)); setShowBundleBalancePayment(true); }}
                        className="w-full py-3 bg-warning-600 text-white font-bold rounded-xl hover:bg-warning-700 transition-all"
                      >
                        Collect Towards Bundle Balance
                      </button>
                    </div>
                  ) : null}

                  {(studentFees?.length ?? 0) === 0 ? (
                    !(bundlePaymentInfo?.hasBundle && !bundlePaymentInfo?.isFullPayment) && (
                      <div className="bg-success-50 border border-success-200 rounded-xl p-6 text-center">
                        <CheckCircle className="w-10 h-10 text-success-500 mx-auto mb-2" />
                        <div className="font-semibold text-success-700">No outstanding fees!</div>
                        <div className="text-sm text-success-600 mt-1">This student has no assigned fees with a balance.</div>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="space-y-2">
                        {studentFees?.map((fee) => (
                          <button key={fee?.id} onClick={() => { setSelectedFee(fee); setFeesAmount(''); setFeesDiscount(''); }} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedFee?.id === fee?.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-bold text-gray-900">{fee?.fee_name}</div>
                                {fee?.fee_description && <div className="text-xs text-gray-500 mt-0.5">{fee.fee_description}</div>}
                                <div className="text-xs text-gray-400 mt-0.5">{fee?.academic_session}</div>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className="text-xs text-gray-400">Balance</div>
                                <div className="text-lg font-extrabold text-danger-600">{fmt(fee?.balance)}</div>
                                <div className="text-xs text-gray-400">of {fmt(fee?.amount_due)}</div>
                              </div>
                            </div>
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-success-500 h-1.5 rounded-full" style={{ width: `${(fee?.amount_due ? (fee.amount_paid / fee.amount_due) * 100 : 0)}%` }} />
                            </div>
                            <div className="mt-0.5 text-xs text-gray-400">Paid: {fmt(fee?.amount_paid)}</div>
                          </button>
                        ))}
                      </div>

                      {/* Payment entry */}
                      {selectedFee && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                          <div className="font-semibold text-gray-900">Paying: {selectedFee.fee_name}</div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Enter Amount Collected</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">₦</span>
                              <input
                                type="number" min="0" step="1" max={selectedFee.balance}
                                value={feesAmount}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v) && v > selectedFee.balance) {
                                    setFeesAmount(String(selectedFee.balance));
                                  } else {
                                    setFeesAmount(e.target.value);
                                  }
                                }}
                                className="w-full pl-8 pr-3 py-3 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:outline-none focus:border-primary-400"
                                placeholder="0.00" autoFocus
                              />
                            </div>
                            {(() => {
                              const disc = feesDiscount ? (parseFloat(feesDiscount) || 0) : 0;
                              const netBal = Math.max(0, selectedFee.balance - disc);
                              return (
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => setFeesAmount(String(netBal))} className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold">Full Balance {fmt(netBal)}</button>
                                  <button onClick={() => setFeesAmount(String(Math.round(netBal / 2)))} className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">Half</button>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Optional Discount / Concession */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Discount / Concession <span className="text-gray-400 font-normal">(₦, optional)</span></label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-sm">₦</span>
                              <input
                                type="number" min="0" step="1"
                                value={feesDiscount}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v) && v >= selectedFee.balance) {
                                    setFeesDiscount(String(selectedFee.balance - 1));
                                  } else {
                                    setFeesDiscount(e.target.value);
                                  }
                                }}
                                className="w-full pl-8 pr-3 py-2.5 border border-warning-200 bg-warning-50 rounded-xl text-sm focus:outline-none focus:border-warning-400"
                                placeholder="0.00"
                              />
                            </div>
                            {feesDiscount && parseFloat(feesDiscount) > 0 && (
                              <p className="text-xs text-warning-700 mt-1 font-medium">Net balance after discount: {fmt(Math.max(0, selectedFee.balance - parseFloat(feesDiscount)))}</p>
                            )}
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setFeesPayMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${feesPayMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}><Banknote className="w-4 h-4" /> CASH</button>
                              <button onClick={() => setFeesPayMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all ${feesPayMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}><CreditCard className="w-4 h-4" /> POS</button>
                            </div>
                          </div>

                          {(() => {
                            const disc = feesDiscount ? (parseFloat(feesDiscount) || 0) : 0;
                            const netBal = Math.max(0, selectedFee.balance - disc);
                            const amt = parseFloat(feesAmount);
                            return (
                              <button
                                onClick={handleFeesPayment}
                                disabled={!feesAmount || isNaN(amt) || amt <= 0 || amt > netBal || loading}
                                className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                              >
                                {loading ? 'Processing…' : `Record ${feesAmount ? fmt(amt) : ''} Payment`}
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}

                  {/* Class Fee Types context */}
                  {(classFees?.length ?? 0) > 0 && (studentFees?.length ?? 0) === 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-500 mb-2">Available Fees for {selectedStudent?.student_class}</h3>
                      <div className="space-y-2">
                        {classFees?.map((ft: any) => (
                          <div key={ft?.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm text-gray-800">{ft?.name}</div>
                              {ft?.description && <div className="text-xs text-gray-400">{ft.description}</div>}
                            </div>
                            <span className="font-bold text-gray-700">{fmt(Number(ft?.amount))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─ BUNDLES MODE ─────────────────────────────────────────── */}
            {selectedStudent && saleMode === 'bundles' && (
              <div className="flex-1 overflow-auto p-4">
                <div className="max-w-2xl mx-auto space-y-4 mt-2">
                  <h2 className="font-bold text-lg">Bundle Packages</h2>
                  <p className="text-sm text-gray-500">Select a bundle for <strong>{selectedStudent.name}</strong></p>

                  {bundles.filter((b) => b.is_active).length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No bundles available</p>
                      <p className="text-sm mt-1">Ask admin to create bundle packages</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {bundles.filter((b) => b.is_active).map((bundle) => (
                        <button
                          key={bundle.id}
                          onClick={() => {
                            setSelectedBundle(bundle);
                            setBundleAmount(String(bundle.base_price));
                            setBundlePayMode('Cash');
                            setBundleError('');
                            // For existing students, use their ID as applicant
                            setWalkInApplicant({
                              id: null,
                              full_name: selectedStudent.name,
                              proposed_class: selectedStudent.student_class,
                              student_id: selectedStudent.student_id,
                            });
                            setShowBundlePayment(true);
                          }}
                          className="w-full text-left p-5 rounded-xl border-2 border-gray-200 bg-white hover:border-primary-400 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2 ${bundle.bundle_type === 'acceptance' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>
                                {bundle.bundle_type === 'acceptance' ? 'Acceptance Fee' : 'Registration'}
                              </span>
                              <div className="font-bold text-lg text-gray-900">{bundle.name}</div>
                              {bundle.description && <div className="text-xs text-gray-500 mt-1">{bundle.description}</div>}
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <div className="text-2xl font-extrabold text-primary-600">{fmt(bundle.base_price)}</div>
                              {bundle.items && bundle.items.length > 0 && (
                                <div className="text-xs text-gray-400 mt-1">{bundle.items.length} items included</div>
                              )}
                            </div>
                          </div>
                          {bundle.items && bundle.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="text-xs font-semibold text-gray-500 mb-1">Includes:</div>
                              <div className="flex flex-wrap gap-2">
                                {bundle.items.map((item) => (
                                  <span key={item.item_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                                    {item.item_name}
                                    {item.quantity > 1 && <span className="font-bold text-gray-500">×{item.quantity}</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!selectedStudent && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300 p-8">
                <User className="w-16 h-16 mb-4" />
                <p className="font-medium text-lg text-gray-400">Search for a student above</p>
                <p className="text-sm">Select class and type the student's name</p>
              </div>
            )}
          </div>

          {/* Mobile cart backdrop */}
          {cartOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setCartOpen(false)} />}

          {/* ── Cart Panel (right) ──────────────────────────────────── */}
          <div className={`${cartOpen ? 'fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 flex flex-col rounded-t-2xl' : 'hidden'} md:relative md:flex md:bottom-auto md:left-auto md:right-auto md:max-h-none md:z-auto md:rounded-none md:w-80 bg-white border-l md:flex-col shrink-0`}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-gray-500" /><h2 className="font-bold text-gray-900">Cart</h2></div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>}
                <button className="md:hidden p-1 text-gray-400 hover:text-gray-600" onClick={() => setCartOpen(false)}><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-3 py-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
                  <ShoppingCart className="w-10 h-10 mb-2" />
                  <p className="text-sm">{!selectedStudent ? 'Select a student first' : 'Tap items to add'}</p>
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
                      <button onClick={() => setCart((p) => p.filter((i) => i.item_id !== item.item_id))} className="text-gray-300 hover:text-danger-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart footer */}
            {cart.length > 0 && saleMode === 'store' && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-xl font-extrabold text-gray-900">{fmt(cartTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-success-400'}`}><Banknote className="w-4 h-4" /> CASH</button>
                  <button onClick={() => setPaymentMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border-2 transition-all text-sm ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}><CreditCard className="w-4 h-4" /> POS</button>
                </div>
                <button onClick={() => setShowCheckout(true)} className="w-full py-4 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 text-lg shadow-sm">
                  Charge {fmt(cartTotal)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile floating cart button (sale tab only) ──────────────── */}
      {tab === 'sale' && (
        <button
          className="md:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-success-600 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-sm"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart className="w-5 h-5" />
          {cart.length > 0 ? `${cart.length} item${cart.length > 1 ? 's' : ''} · ${fmt(cartTotal)}` : 'Cart'}
        </button>
      )}

      {/* ── SHIFT LOG TAB ────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-5">
            <div><h1 className="text-xl font-bold">Shift Log</h1><p className="text-sm text-gray-400">Shift #{activeShift.id} · {new Date(activeShift.opened_at).toLocaleString()}</p></div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowExpenseModal(true); setExpenseError(''); }} className="flex items-center gap-2 px-3 py-2 bg-warning-600 text-white rounded-lg text-sm font-semibold hover:bg-warning-700"><Wallet className="w-4 h-4" /> Record Expense</button>
              <button onClick={() => {
                transactionAPI.getHistory({}).then((d) => setHistoryTxns(d.filter((t: any) => t.shift_id === activeShift.id)));
                expenseAPI.getExpensesByShift(activeShift.id).then(setShiftExpenses);
              }} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
            </div>
          </div>

          {/* Search bar for shift log */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Search by student name…" />
            </div>
            <select value={historyClass} onChange={(e) => setHistoryClass(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Expected Cash Calculation Card */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-5">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h2 className="font-bold text-gray-900">Expected Cash Calculation</h2>
              <p className="text-xs text-gray-500">How your expected closing cash is computed</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Opening Cash (Float)</span>
                <span className="font-bold">{fmt(activeShift.opening_cash)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">+ Total Cash Sales</span>
                <span className="font-bold text-success-600">+ {fmt(shiftCash)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">= Cash in Drawer (before expenses)</span>
                <span className="font-bold">{fmt(activeShift.opening_cash + shiftCash)}</span>
              </div>
              <div className="border-t border-dashed pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">- Cash Expenses</span>
                  <span className="font-bold text-danger-600">- {fmt(shiftExpenses.filter((e: any) => e.payment_mode === 'Cash Drawer').reduce((s: number, e: any) => s + Number(e.amount), 0))}</span>
                </div>
              </div>
              <div className="border-t-2 pt-3 flex justify-between items-center bg-primary-50 -mx-5 px-5 py-3">
                <span className="font-bold text-gray-900">Expected Closing Cash</span>
                <span className="text-2xl font-extrabold text-primary-600">{fmt(activeShift.opening_cash + shiftCash - shiftExpenses.filter((e: any) => e.payment_mode === 'Cash Drawer').reduce((s: number, e: any) => s + Number(e.amount), 0))}</span>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Opening Cash', val: fmt(activeShift.opening_cash) },
              { label: 'Cash Sales', val: fmt(shiftCash), color: 'text-success-700' },
              { label: 'POS / Transfer', val: fmt(shiftPOS), color: 'text-primary-700' },
              { label: 'Cash Expenses', val: fmt(shiftExpenses.filter((e: any) => e.payment_mode === 'Cash Drawer').reduce((s: number, e: any) => s + Number(e.amount), 0)), color: 'text-danger-700' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-xs text-gray-400 font-semibold uppercase mb-1">{s.label}</div>
                <div className={`text-2xl font-extrabold ${s.color || ''}`}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Expenses list */}
          {shiftExpenses.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-5">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="font-bold">Expenses ({shiftExpenses.length})</h2>
                <span className="text-sm font-bold text-danger-600">Total: {fmt(shiftExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0))}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftExpenses.map((e: any) => (
                    <tr key={e.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{e.category}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.payment_mode === 'Cash Drawer' ? 'bg-warning-100 text-warning-700' : 'bg-primary-100 text-primary-700'}`}>
                          {e.payment_mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-danger-600">{fmt(Number(e.amount))}</td>
                      <td className="px-4 py-3 text-gray-500">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Transactions ({filteredHistory.length})</h2>
              <span className="text-sm font-bold text-gray-600">Total: {fmt(filteredHistory.reduce((s, t) => s + Number(t.amount_paid), 0))}</span>
            </div>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No transactions found</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['Time', 'Student', 'Type', 'Method', 'Amount', ''].map((h) => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 ${h === 'Amount' ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h || 'Receipt'}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredHistory.map((t) => (
                    <tr key={t.transaction_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</td>
                      <td className="px-4 py-3 font-medium">{t.student_name}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.type === 'STORE_PURCHASE' ? 'bg-primary-100 text-primary-700' : t.type === 'REGISTRATION_PAYMENT' ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>{t.type === 'STORE_PURCHASE' ? 'Store' : t.type === 'REGISTRATION_PAYMENT' ? 'Reg.' : 'Fees'}</span></td>
                      <td className="px-4 py-3"><span className={`flex items-center gap-1 text-xs font-medium ${t.payment_mode === 'Cash' ? 'text-success-700' : 'text-primary-700'}`}>{t.payment_mode === 'Cash' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}{t.payment_mode === 'Cash' ? 'Cash' : 'POS'}</span></td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(Number(t.amount_paid))}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => handleReprint(t.transaction_id)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Reprint Receipt"><Printer className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STUDENTS TAB ─────────────────────────────────────────────── */}
      {tab === 'students' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-5"><h1 className="text-xl font-bold">Students</h1><p className="text-gray-400 text-sm">View student accounts and fees balance</p></div>
          <StudentQuickList
            onSelect={(s) => { selectStudent(s); setTab('sale'); }}
            onSelectApplicant={(a) => { setWalkInApplicant({ ...a }); setTab('sale'); }}
          />
        </div>
      )}

      {/* ── Confirm Checkout Modal ──────────────────────────────────── */}
      {showCheckout && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Sale</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-3"><div className="font-bold text-gray-800">{selectedStudent.name}</div><div className="text-sm text-gray-500">{selectedStudent.student_class}</div></div>
            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.item_id} className="flex justify-between text-sm">
                  <span>{item.item_name} × {item.quantity}</span>
                  <span className="font-semibold">{fmt(item.selling_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t-2 pt-3 mb-4 flex justify-between items-center">
              <span className="font-bold text-lg">Total</span>
              <span className="font-extrabold text-xl text-success-700">{fmt(cartTotal)}</span>
            </div>
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-600 mb-2">Payment Method</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMode('Cash')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${paymentMode === 'Cash' ? 'bg-success-600 border-success-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-success-400'}`}><Banknote className="w-5 h-5" /> CASH</button>
                <button onClick={() => setPaymentMode('POS_Transfer')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${paymentMode === 'POS_Transfer' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-primary-400'}`}><CreditCard className="w-5 h-5" /> POS / TRANSFER</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleStorePurchase} disabled={loading} className="flex-1 py-3 bg-success-600 text-white rounded-xl font-bold hover:bg-success-700 disabled:opacity-50">{loading ? 'Processing…' : 'Confirm & Charge'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ────────────────────────────────────────────── */}
      {showReceipt && lastTxn && (
        <ReceiptModal
          txn={lastTxn.transaction}
          total={lastTxn.total}
          items={lastTxn.items || []}
          settings={schoolSettings}
          isFees={lastTxn.isFees}
          isRegistration={lastTxn.isRegistration}
          onClose={() => { setShowReceipt(false); setLastTxn(null); }}
        />
      )}

      {/* ── Quick Edit Student Modal (shift-scoped, quick-added only) ── */}
      {showQuickEditStudent && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center"><Pencil className="w-5 h-5 text-primary-600" /></div>
                <div>
                  <h2 className="text-lg font-bold">Edit Quick-Added Student</h2>
                  <p className="text-xs text-gray-400 font-mono">{selectedStudent.student_id}</p>
                </div>
              </div>
              <button onClick={() => setShowQuickEditStudent(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-2 mb-4 text-xs text-primary-700">
              Only available for students added during this shift. Use admin panel for other edits.
            </div>
            {quickEditError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{quickEditError}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                <input type="text" value={quickEditName} onChange={(e) => setQuickEditName(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Class *</label>
                <select value={quickEditClass} onChange={(e) => setQuickEditClass(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowQuickEditStudent(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button onClick={handleQuickEditSave} disabled={quickEditSaving || !quickEditName.trim() || !quickEditClass} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{quickEditSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Modal ────────────────────────────────────────────── */}
      {errorMsg && <ErrorModal message={errorMsg} onClose={() => setErrorMsg('')} />}

      {/* ── Shift Close Modals ─────────────────────────────────────── */}
      {shiftCloseStep === 'input' && shiftCloseResult && (
        <ShiftCloseModal
          expectedCash={shiftCloseResult.expectedCash}
          onClose={handleShiftCloseConfirm}
          onCancel={() => setShiftCloseStep('none')}
        />
      )}
      {shiftCloseStep === 'result' && shiftCloseResult && (
        <ShiftResultModal
          expectedCash={shiftCloseResult.expectedCash}
          actualCash={shiftCloseResult.actualCash}
          difference={shiftCloseResult.difference}
          onClose={() => setShiftCloseStep('none')}
        />
      )}

      {/* ── Quick Add Student Modal ─────────────────────────────────── */}
      {showQuickAdd && (
        <QuickAddStudentModal
          classes={classes}
          onSave={handleQuickAddSave}
          onCancel={() => setShowQuickAdd(false)}
          saving={quickAddSaving}
          error={quickAddError}
        />
      )}

      {/* ── Registration Flow Modal ────────────────────────────────── */}
      {showRegistration && selectedStudent && (
        <RegistrationFlowModal
          student={selectedStudent}
          registrationFeeTypes={registrationFeeTypes}
          clearanceItems={clearanceItems}
          onComplete={handleRegistrationComplete}
          onCancel={() => setShowRegistration(false)}
          processing={regProcessing}
          error={regError}
        />
      )}

      {/* ── Walk-In Applicant Modal ─────────────────────────────────── */}
      {showWalkIn && (
        <WalkInApplicantModal
          classes={classes}
          classCategoryMap={classCategoryMap}
          onSave={handleWalkInCreate}
          onCancel={() => { setShowWalkIn(false); setWalkInError(''); }}
          saving={walkInSaving}
          error={walkInError}
        />
      )}

      {/* ── Bundle Payment Modal ─────────────────────────────────────── */}
      {showBundlePayment && selectedBundle && walkInApplicant && (
        <BundlePaymentModal
          bundle={selectedBundle}
          minFloor={selectedBundle.bundle_type === 'acceptance'
            ? (schoolSettings?.min_acceptance_partial_floor || 5000)
            : (schoolSettings?.min_partial_payment_floor || 30000)}
          applicantName={walkInApplicant.full_name}
          onComplete={(_amount, _mode, ai) => handleBundlePayment(ai)}
          onCancel={() => { setShowBundlePayment(false); setSelectedBundle(null); setWalkInApplicant(null); setBundleError(''); }}
          processing={bundleProcessing}
          error={bundleError}
        />
      )}

      {/* ── Walk-In Locked Form Payment Modal ───────────────────────── */}
      {showWalkInForm && walkInApplicant && (
        <WalkInFormModal
          applicantName={walkInApplicant.full_name}
          onConfirm={handleWalkInFormConfirm}
          onCancel={() => { setShowWalkInForm(false); setWalkInModalError(''); }}
          processing={walkInModalProcessing}
          error={walkInModalError}
        />
      )}

      {/* ── Walk-In Locked Acceptance Modal ─────────────────────────── */}
      {showWalkInAcceptance && walkInApplicant && walkInAcceptanceBundle && (
        <WalkInBundleModal
          title="Acceptance Fee Payment"
          applicantName={walkInApplicant.full_name}
          bundle={walkInAcceptanceBundle}
          onConfirm={handleWalkInAcceptanceConfirm}
          onCancel={() => { setShowWalkInAcceptance(false); setWalkInAcceptanceBundle(null); setWalkInModalError(''); }}
          processing={walkInModalProcessing}
          error={walkInModalError}
        />
      )}

      {/* ── Walk-In Registration Fee Engine Modal ────────────────────── */}
      {showWalkInRegistration && walkInApplicant && (
        <WalkInRegistrationFeeModal
          applicantName={walkInApplicant.full_name}
          proposedClass={walkInApplicant.proposed_class || ''}
          studentStatus={walkInApplicant.student_status || 'Day'}
          matchedBundle={walkInRegistrationBundle}
          categoryGroup={walkInCategoryGroup}
          onConfirm={handleWalkInRegistrationConfirm}
          onCancel={() => { setShowWalkInRegistration(false); setWalkInCategoryGroup(null); setWalkInModalError(''); }}
          processing={walkInModalProcessing}
          error={walkInModalError}
        />
      )}

      {/* ── Bundle Balance Payment Modal ────────────────────────────── */}
      {showBundleBalancePayment && bundlePaymentInfo && selectedStudent && activeShift && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Collect Bundle Balance</h2>
              <button onClick={() => { setShowBundleBalancePayment(false); setBundleBalanceAmount(''); setErrorMsg(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mb-4">
              <p className="font-semibold text-warning-800">{selectedStudent.name}</p>
              <p className="text-sm text-warning-600">{selectedStudent.student_class}</p>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Outstanding Bundle Balance:</span>
                <span className="font-bold text-danger-600">{fmt(bundlePaymentInfo.balanceDue)}</span>
              </div>
            </div>
            {errorMsg && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{errorMsg}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Enter Amount to Collect</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₦</span>
                  <input
                    type="text"
                    value={bundleBalanceAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parsed = parseFloat(raw);
                      // Overflow guard: never allow entry beyond current balance
                      if (!isNaN(parsed) && parsed > bundlePaymentInfo.balanceDue) {
                        setBundleBalanceAmount(String(bundlePaymentInfo.balanceDue));
                      } else {
                        setBundleBalanceAmount(raw);
                      }
                    }}
                    className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setBundleBalanceAmount(String(bundlePaymentInfo.balanceDue))}
                  className="mt-2 w-full py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  Pay Full Balance ({fmt(bundlePaymentInfo.balanceDue)})
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeesPayMode('Cash')}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${feesPayMode === 'Cash' ? 'bg-success-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Cash
                </button>
                <button
                  onClick={() => setFeesPayMode('POS_Transfer')}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${feesPayMode === 'POS_Transfer' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  POS / Transfer
                </button>
              </div>
              <button
                onClick={handleBundleBalancePayment}
                disabled={!bundleBalanceAmount || bundleBalanceProcessing || parseFloat(bundleBalanceAmount || '0') <= 0}
                className="w-full py-3 bg-success-600 text-white font-bold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bundleBalanceProcessing ? 'Processing…' : `Record ${bundleBalanceAmount ? fmt(parseFloat(bundleBalanceAmount)) : ''} Payment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ───────────────────────────────────────── */}
      {showExpenseModal && activeShift && (
        <AddExpenseModal
          shiftId={activeShift.id}
          openingCash={activeShift.opening_cash}
          currentCashSales={shiftCash}
          onConfirm={handleAddExpense}
          onCancel={() => { setShowExpenseModal(false); setExpenseError(''); }}
          saving={expenseSaving}
          error={expenseError}
        />
      )}
    </div>
  );
};

export default CashierPOS;
