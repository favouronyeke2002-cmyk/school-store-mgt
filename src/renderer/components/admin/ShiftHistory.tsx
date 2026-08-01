import React, { useState, useEffect } from 'react';
import { shiftAPI } from '../../lib/api';
import { transactionAPI } from '../../lib/api';

interface Shift {
  id: number;
  user_id: number;
  opening_cash: number;
  expected_closing_cash: number | null;
  closing_cash: number | null;
  cash_difference: number | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
  username?: string;
}

const ShiftHistory: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    shiftAPI.getHistory().then(setShifts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const viewDetails = async (s: Shift) => {
    setSelected(s);
    const txns = await transactionAPI.getHistory({ shiftId: s.id });
    setTransactions(txns);
  };

  const formatCurrency = (n: number | null) => n !== null ? `₦${(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
  const totalOpened = shifts.reduce((s, sh) => s + sh.opening_cash, 0);
  const closedShifts = shifts.filter(s => s.status === 'closed');
  const totalClosed = closedShifts.reduce((s, sh) => s + (sh.closing_cash || 0), 0);
  const totalDiff = shifts.reduce((s, sh) => s + (sh.cash_difference || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Shift History</h1>
        <p className="text-gray-500">Track cashier shift openings and closings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Shifts', value: shifts.length },
          { label: 'Open Shifts', value: shifts.filter(s => s.status === 'open').length },
          { label: 'Total Opening Cash', value: formatCurrency(totalOpened) },
          { label: 'Total Difference', value: formatCurrency(totalDiff), color: totalDiff >= 0 ? 'text-success-600' : 'text-danger-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cashier</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Opened</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Closed</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Opening</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Closing</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expected</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Diff</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">No shifts found</td></tr>
            ) : shifts.map((s) => (
              <tr key={s.id} className={`border-t ${s.status === 'open' ? 'bg-warning-50' : ''}`}>
                <td className="px-4 py-3 font-mono">#{s.id}</td>
                <td className="px-4 py-3">{s.username}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${s.status === 'open' ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>{s.status}</span></td>
                <td className="px-4 py-3 text-sm">
                  <div>{new Date(s.opened_at).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-500">{new Date(s.opened_at).toLocaleTimeString()}</div>
                </td>
                <td className="px-4 py-3 text-sm">{s.closed_at ? (
                  <><div>{new Date(s.closed_at).toLocaleDateString()}</div><div className="text-xs text-gray-500">{new Date(s.closed_at).toLocaleTimeString()}</div></>
                ) : <span className="text-gray-400">-</span>}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.opening_cash)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.closing_cash)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.expected_closing_cash)}</td>
                <td className={`px-4 py-3 text-right font-bold ${s.cash_difference !== null ? (s.cash_difference >= 0 ? 'text-success-600' : 'text-danger-600') : 'text-gray-400'}`}>{formatCurrency(s.cash_difference)}</td>
                <td className="px-4 py-3 text-center"><button onClick={() => viewDetails(s)} className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Details Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Shift #{selected.id} Details</h2>
              <button onClick={() => setSelected(null)} className="text-2xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4"><div className="text-sm text-gray-500">Cashier</div><div className="font-semibold">{selected.username}</div></div>
              <div className="bg-gray-50 rounded-lg p-4"><div className="text-sm text-gray-500">Status</div><span className={`px-2 py-1 rounded text-xs ${selected.status === 'open' ? 'bg-warning-100' : 'bg-success-100'}`}>{selected.status}</span></div>
              <div className="bg-gray-50 rounded-lg p-4"><div className="text-sm text-gray-500">Opened</div><div>{new Date(selected.opened_at).toLocaleString()}</div></div>
              <div className="bg-gray-50 rounded-lg p-4"><div className="text-sm text-gray-500">Closed</div><div>{selected.closed_at ? new Date(selected.closed_at).toLocaleString() : 'Still Open'}</div></div>
            </div>
            <div className="bg-primary-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold mb-3">Financial Summary</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><div className="text-xs text-gray-500">Opening Cash</div><div className="text-lg font-bold">{formatCurrency(selected.opening_cash)}</div></div>
                <div><div className="text-xs text-gray-500">Expected</div><div className="text-lg font-bold">{formatCurrency(selected.expected_closing_cash)}</div></div>
                <div><div className="text-xs text-gray-500">Actual</div><div className="text-lg font-bold">{formatCurrency(selected.closing_cash)}</div></div>
                <div><div className="text-xs text-gray-500">Difference</div><div className={`text-lg font-bold ${selected.cash_difference !== null ? (selected.cash_difference >= 0 ? 'text-success-700' : 'text-danger-700') : ''}`}>{formatCurrency(selected.cash_difference)}</div></div>
              </div>
            </div>
            <div>
              <h3 className="font-bold mb-3">Transactions ({transactions.length})</h3>
              {transactions.length === 0 ? (
                <div className="text-center text-gray-400 py-4">No transactions</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr><th className="py-2 text-left">ID</th><th className="py-2 text-left">Student</th><th className="py-2 text-left">Type</th><th className="py-2 text-left">Payment</th><th className="py-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.transaction_id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">#{t.transaction_id}</td>
                        <td className="py-2">{t.student_name}</td>
                        <td className="py-2"><span className={`px-2 py-1 rounded text-xs ${t.type === 'STORE_PURCHASE' ? 'bg-primary-100' : 'bg-success-100'}`}>{t.type === 'STORE_PURCHASE' ? 'Store' : 'Fees'}</span></td>
                        <td className="py-2">{t.payment_mode}</td>
                        <td className="py-2 text-right font-semibold">{formatCurrency(t.amount_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-bold border-t">
                    <tr><td colSpan={4} className="py-2">Total Cash Sales</td><td className="py-2 text-right">{formatCurrency(transactions.filter((t: any) => t.payment_mode === 'Cash').reduce((s: number, t: any) => s + t.amount_paid, 0))}</td></tr>
                  </tfoot>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftHistory;
