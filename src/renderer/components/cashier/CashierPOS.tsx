import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { studentAPI, inventoryAPI, transactionAPI } from '../../lib/api';

interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; }
interface InventoryItem { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; }
interface CartItem { item_id: number; item_name: string; selling_price: number; quantity: number; }

const CashierPOS: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeShift, openShift, closeShift } = useShift();
  const [view, setView] = useState<'store' | 'fees'>('store');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'POS_Transfer'>('Cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [feesAmount, setFeesAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [showQuickAddStudent, setShowQuickAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', studentClass: '' });

  useEffect(() => {
    studentAPI.getAll({ search: studentSearch }).then(setStudents).catch(console.error);
  }, [studentSearch]);

  useEffect(() => {
    inventoryAPI.getAll({ search: itemSearch }).then(setInventory).catch(console.error);
  }, [itemSearch]);

  const addToCart = useCallback((item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing) {
        if (existing.quantity >= item.stock_quantity) return prev;
        return prev.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item_id: item.item_id, item_name: item.item_name, selling_price: item.selling_price, quantity: 1 }];
    });
  }, []);

  const updateCartQuantity = (itemId: number, delta: number) => {
    setCart(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);

  const handleStoreCheckout = async () => {
    if (!selectedStudent || cart.length === 0 || !activeShift) return;
    setLoading(true);
    try {
      const result = await transactionAPI.createPurchase(selectedStudent.student_id, activeShift.id, cart, paymentMode);
      if (result.success) {
        setLastTransaction(result);
        setShowCheckout(false);
        setShowReceipt(true);
        setCart([]);
        setItemSearch('');
        inventoryAPI.getAll({}).then(setInventory);
      } else {
        alert(result.error || 'Failed to process transaction');
      }
    } catch (err) {
      alert('An error occurred: ' + (err as Error).message);
    }
    setLoading(false);
  };

  const handleFeesCollection = async () => {
    if (!selectedStudent || !activeShift) return;
    const amount = parseFloat(feesAmount);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
    setLoading(true);
    try {
      const result = await transactionAPI.createFees(selectedStudent.student_id, activeShift.id, amount, paymentMode);
      if (result.success) {
        const updated = await studentAPI.getById(selectedStudent.student_id);
        setSelectedStudent(updated);
        setFeesAmount('');
        alert(`Payment of N${amount.toLocaleString()} recorded successfully!`);
      } else {
        alert('Failed to process fees collection');
      }
    } catch (err) {
      alert('An error occurred: ' + (err as Error).message);
    }
    setLoading(false);
  };

  const handleQuickAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name.trim() || !newStudent.studentClass) { alert('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const result = await studentAPI.create({ name: newStudent.name, studentClass: newStudent.studentClass });
      if (result.success) {
        const created = await studentAPI.getById(result.studentId);
        if (created) { setSelectedStudent(created); setStudentSearch(created.name); }
        setShowQuickAddStudent(false);
        setNewStudent({ name: '', studentClass: '' });
      } else {
        alert(result.error || 'Failed to add student');
      }
    } catch (err) {
      alert('An error occurred: ' + (err as Error).message);
    }
    setLoading(false);
  };

  const printReceipt = () => {
    if (!lastTransaction) return;
    const receiptWindow = window.open('', '_blank', 'width=300,height=600');
    if (!receiptWindow) return;
    receiptWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:monospace;width:80mm;margin:0;padding:4mm;font-size:12px;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;}.item{display:flex;justify-content:space-between;margin:4px 0;}.total{border-top:2px solid #000;padding-top:8px;margin-top:8px;font-weight:bold;}</style></head><body><div class="header"><strong>SCHOOL STORE</strong><br/>Receipt #${lastTransaction.transaction.transaction_id}<br/>${new Date(lastTransaction.transaction.timestamp).toLocaleString()}</div><div><strong>Student:</strong> ${lastTransaction.transaction.student_name}<br/><strong>Class:</strong> ${lastTransaction.transaction.student_class}</div><hr/>${lastTransaction.items.map((item: any) => `<div class="item"><span>${item.item_name} x${item.quantity}</span><span>N${item.total_price.toLocaleString()}</span></div>`).join('')}<div class="total"><div class="item"><strong>TOTAL</strong><strong>N${lastTransaction.total.toLocaleString()}</strong></div><div class="item"><span>Payment:</span><span>${lastTransaction.transaction.payment_mode}</span></div></div><div style="text-align:center;margin-top:16px;font-size:10px;">Thank you for your purchase!<br/>*** END OF RECEIPT ***</div></body></html>`);
    receiptWindow.document.close();
    receiptWindow.print();
  };

  const handleLogout = async () => { logout(); };

  if (!activeShift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4 text-center">No Active Shift</h2>
          <p className="text-gray-600 text-center mb-4">Enter opening cash to start your shift</p>
          <ShiftLoginForm userId={user?.id || 0} openShift={openShift} />
          <button onClick={handleLogout} className="w-full mt-4 py-2 text-gray-600 hover:text-gray-800">Log Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-success-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h1 className="font-semibold">Point of Sale</h1>
              <p className="text-xs text-gray-500">Shift #{activeShift.id} Active since {new Date(activeShift.opened_at).toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">Welcome, {user?.username}</span>
            <button onClick={handleLogout} className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300">Log Out</button>
          </div>
        </div>

        {/* Student Selection */}
        <div className="bg-white border-b p-4">
          <label className="block text-sm font-medium mb-2">Select Student (Required)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="Search by name or ID..." />
              {students.length > 0 && !selectedStudent && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-64 overflow-auto z-10">
                  {students.slice(0, 8).map((s) => (
                    <button key={s.student_id} onClick={() => { setSelectedStudent(s); setStudentSearch(s.name); }} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-0">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-gray-500">{s.student_class} - {s.student_id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowQuickAddStudent(true)} className="px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 flex items-center gap-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Quick Add
            </button>
          </div>

          {selectedStudent && (
            <div className={`mt-3 p-4 rounded-lg ${selectedStudent.current_fees_owed > 0 ? 'bg-danger-50 border-2 border-danger-200' : 'bg-success-50 border-2 border-success-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{selectedStudent.name}</span>
                  <span className="ml-2 text-sm text-gray-600">{selectedStudent.student_class}</span>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              {selectedStudent.current_fees_owed > 0 && (
                <div className="mt-2 text-danger-700 font-bold text-lg animate-pulse">OUTSTANDING FEES: N{selectedStudent.current_fees_owed.toLocaleString()}</div>
              )}
            </div>
          )}

          {selectedStudent && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => setView('store')} className={`flex-1 py-2 rounded-lg font-medium ${view === 'store' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>Store Purchase</button>
              <button onClick={() => setView('fees')} disabled={selectedStudent.current_fees_owed === 0} className={`flex-1 py-2 rounded-lg font-medium ${view === 'fees' ? 'bg-primary-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}>Collect School Fees</button>
            </div>
          )}
        </div>

        {/* Items Grid or Fees Collection */}
        <div className="flex-1 overflow-auto p-4">
          {selectedStudent && view === 'store' ? (
            <>
              <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="w-full px-3 py-2 border rounded-md mb-4" placeholder="Search items..." />
              <div className="grid grid-cols-3 gap-3">
                {inventory.map((item) => (
                  <button key={item.item_id} onClick={() => addToCart(item)} disabled={item.stock_quantity <= 0} className={`p-4 rounded-lg border-2 text-left ${item.stock_quantity <= 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:border-primary-400 hover:shadow-md'}`}>
                    <div className="font-medium truncate">{item.item_name}</div>
                    <div className="text-lg font-bold text-primary-600">N{item.selling_price.toLocaleString()}</div>
                    <div className={`text-xs ${item.stock_quantity <= 5 ? 'text-danger-500' : 'text-gray-400'}`}>Stock: {item.stock_quantity}</div>
                  </button>
                ))}
              </div>
            </>
          ) : selectedStudent && view === 'fees' ? (
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-2">Collect School Fees</h2>
              <div className="mb-6">
                <div className="text-gray-600">Current Outstanding:</div>
                <div className="text-3xl font-bold text-danger-600">N{selectedStudent.current_fees_owed.toLocaleString()}</div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Amount to Collect</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">N</span>
                  <input type="number" value={feesAmount} onChange={(e) => setFeesAmount(e.target.value)} className="w-full pl-8 pr-3 py-2 border rounded-md text-xl font-semibold" />
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                {['All', 'Half'].map((preset) => (
                  <button key={preset} onClick={() => setFeesAmount(preset === 'All' ? String(selectedStudent.current_fees_owed) : String(selectedStudent.current_fees_owed / 2))} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">{preset}</button>
                ))}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <div className="flex gap-2">
                  {['Cash', 'POS_Transfer'].map((mode) => (
                    <button key={mode} onClick={() => setPaymentMode(mode as any)} className={`flex-1 py-3 rounded-lg font-medium ${paymentMode === mode ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>{mode === 'POS_Transfer' ? 'POS/Transfer' : mode}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleFeesCollection} disabled={!feesAmount || loading} className="w-full py-4 bg-success-600 text-white rounded-lg font-semibold disabled:opacity-50">{loading ? 'Processing...' : 'Record Payment'}</button>
            </div>
          ) : null}
        </div>

        {/* Cart Sidebar */}
        {selectedStudent && view === 'store' && (
          <div className="w-96 bg-white border-l flex flex-col">
            <div className="p-4 border-b font-bold text-lg">Current Cart</div>
            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center text-gray-400 py-12">Cart is empty</div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-gray-500">N{item.selling_price.toLocaleString()} each</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQuantity(item.item_id, -1)} className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300">-</button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.item_id, 1)} className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300">+</button>
                      </div>
                      <div className="font-bold">N{(item.selling_price * item.quantity).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between text-xl font-bold mb-4"><span>Total</span><span>N{cartTotal.toLocaleString()}</span></div>
                <div className="flex gap-2 mb-4">
                  {['Cash', 'POS_Transfer'].map((mode) => (
                    <button key={mode} onClick={() => setPaymentMode(mode as any)} className={`flex-1 py-2 rounded font-medium ${paymentMode === mode ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>{mode === 'POS_Transfer' ? 'POS' : mode}</button>
                  ))}
                </div>
                <button onClick={() => setShowCheckout(true)} className="w-full py-4 bg-success-600 text-white rounded-lg font-bold hover:bg-success-700">Checkout (N{cartTotal.toLocaleString()})</button>
                <button onClick={() => setShowCloseShift(true)} className="w-full mt-2 py-2 bg-gray-200 rounded hover:bg-gray-300">Close Shift</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Transaction</h2>
            <div className="mb-4 bg-gray-50 rounded-lg p-4"><span className="font-medium">{selectedStudent?.name}</span> - {selectedStudent?.student_class}</div>
            <div className="border-t pt-4 mb-4">
              <div className="flex justify-between mb-2"><span>Items:</span><span>{cart.length} items</span></div>
              <div className="flex justify-between mb-2"><span>Payment:</span><span>{paymentMode}</span></div>
              <div className="flex justify-between text-xl font-bold"><span>Total:</span><span>N{cartTotal.toLocaleString()}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={handleStoreCheckout} disabled={loading} className="flex-1 py-2 bg-success-600 text-white rounded hover:bg-success-700">{loading ? 'Processing...' : 'Confirm & Print'}</button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xs w-full mx-4 p-4 text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
            <h2 className="text-xl font-bold mb-2">Transaction Complete!</h2>
            <p className="text-gray-600 mb-4">Receipt #{lastTransaction.transaction.transaction_id}</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <div className="flex justify-between mb-2"><span>Total:</span><span className="font-bold">N{lastTransaction.total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Payment:</span><span>{lastTransaction.transaction.payment_mode}</span></div>
            </div>
            <button onClick={printReceipt} className="w-full py-2 bg-primary-600 text-white rounded mb-2 hover:bg-primary-700">Print Receipt</button>
            <button onClick={() => { setShowReceipt(false); setLastTransaction(null); }} className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300">Done</button>
          </div>
        </div>
      )}

      {showCloseShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Close Shift</h2>
            <p className="text-gray-600 mb-6">Count the cash in the drawer and enter the total to close the shift.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCloseShift(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={async () => { const input = prompt('Enter closing cash amount:'); if (!input) return; const cash = parseFloat(input); if (isNaN(cash)) { alert('Invalid amount'); return; } const result = await closeShift(cash, user?.id || 0); if (result) alert(`Shift Closed!\n\nExpected: N${result.expectedCash.toLocaleString()}\nDifference: N${result.difference.toLocaleString()}`); setShowCloseShift(false); }} className="flex-1 py-2 bg-danger-600 text-white rounded hover:bg-danger-700">Close Shift</button>
            </div>
          </div>
        </div>
      )}

      {showQuickAddStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Quick Add Student</h2>
              <button onClick={() => setShowQuickAddStudent(false)} className="text-2xl">&times;</button>
            </div>
            <form onSubmit={handleQuickAddStudent}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Student Name</label>
                <input type="text" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" autoFocus />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Class</label>
                <select value={newStudent.studentClass} onChange={(e) => setNewStudent({ ...newStudent, studentClass: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                  <option value="">Select Class</option>
                  <optgroup label="Junior Secondary"><option value="JSS1A">JSS 1A</option><option value="JSS1B">JSS 1B</option><option value="JSS2A">JSS 2A</option><option value="JSS2B">JSS 2B</option><option value="JSS3A">JSS 3A</option><option value="JSS3B">JSS 3B</option></optgroup>
                  <optgroup label="Senior Secondary"><option value="SS1A">SS 1A</option><option value="SS1B">SS 1B</option><option value="SS2A">SS 2A</option><option value="SS2B">SS 2B</option><option value="SS3A">SS 3A</option><option value="SS3B">SS 3B</option></optgroup>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowQuickAddStudent(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-success-600 text-white rounded hover:bg-success-700">{loading ? 'Adding...' : 'Save & Select'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ShiftLoginForm: React.FC<{ userId: number; openShift: (cash: number, userId: number) => Promise<boolean> }> = ({ userId, openShift }) => {
  const [openingCash, setOpeningCash] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) { alert('Invalid amount'); return; }
    setLoading(true);
    const success = await openShift(cash, userId);
    if (!success) alert('Failed to open shift');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Opening Cash (N)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">N</span>
          <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="w-full pl-8 pr-3 py-2 border rounded-md text-xl font-semibold" placeholder="0.00" autoFocus />
        </div>
      </div>
      <button type="submit" disabled={loading} className="w-full py-3 bg-success-600 text-white font-medium rounded-md hover:bg-success-700">{loading ? 'Opening...' : 'Open Shift'}</button>
    </form>
  );
};

export default CashierPOS;
