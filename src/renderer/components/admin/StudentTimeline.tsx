import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Receipt, Tag, Loader2 } from 'lucide-react';
import { studentFeeAPI, transactionAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

interface Props {
  studentId: string;
  studentName: string;
  studentClass: string;
  currentSession: string;
  currentTerm: string;
  onClose: () => void;
  onManageFees?: () => void;
}

type EventKind = 'fee_charge' | 'fee_payment' | 'store_purchase';
interface TEvent {
  id: string;
  kind: EventKind;
  date: string;
  amount: number;
  fee_name?: string;
  term?: string | null;
  session?: string;
  amount_paid_on_fee?: number;
  balance?: number;
  fee_type_name?: string | null;
  ref?: number;
  payment_mode?: string;
  items?: { item_name: string; quantity: number; unit_price: number; total_price: number }[];
  txnType?: string;
}

const TERM_OPTIONS = ['', 'First Term', 'Second Term', 'Third Term'];

const StudentTimeline: React.FC<Props> = ({ studentId, studentName, studentClass, currentSession, currentTerm, onClose, onManageFees }) => {
  const [loading, setLoading] = useState(true);
  const [studentFees, setStudentFees] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [termFilter, setTermFilter] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | 'fees' | 'store'>('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      studentFeeAPI.getForStudent(studentId),
      transactionAPI.getForStudent(studentId),
    ]).then(([fees, txns]) => {
      setStudentFees(fees);
      setTransactions(txns);
    }).catch(console.error).finally(() => setLoading(false));
  }, [studentId]);

  const totalBalanceOwed = studentFees.reduce((s, sf) => s + Math.max(0, Number(sf.amount_due) - Number(sf.amount_paid)), 0);
  const totalPaidInTerm = studentFees
    .filter((sf) => !termFilter || sf.term === termFilter)
    .reduce((s, sf) => s + Number(sf.amount_paid), 0);

  const events: TEvent[] = [];

  for (const sf of studentFees) {
    if (termFilter && sf.term !== termFilter) continue;
    events.push({
      id: `fee_${sf.id}`,
      kind: 'fee_charge',
      date: sf.created_at,
      amount: Number(sf.amount_due),
      fee_name: sf.fee_name,
      term: sf.term,
      session: sf.academic_session,
      amount_paid_on_fee: Number(sf.amount_paid),
      balance: Number(sf.amount_due) - Number(sf.amount_paid),
    });
  }

  for (const txn of transactions) {
    if (txn.type === 'FEES_CASH_COLLECTION') {
      if (catFilter === 'store') continue;
      events.push({
        id: `txn_${txn.transaction_id}`,
        kind: 'fee_payment',
        date: txn.timestamp,
        amount: Number(txn.amount_paid),
        fee_type_name: txn.fee_type_name,
        ref: txn.transaction_id,
        payment_mode: txn.payment_mode,
      });
    } else {
      if (catFilter === 'fees') continue;
      if (termFilter) continue;
      events.push({
        id: `txn_${txn.transaction_id}`,
        kind: 'store_purchase',
        date: txn.timestamp,
        amount: Number(txn.amount_paid),
        payment_mode: txn.payment_mode,
        ref: txn.transaction_id,
        items: txn.items || [],
        txnType: txn.type,
      });
    }
  }

  const filtered = events
    .filter((e) => {
      if (catFilter === 'fees') return e.kind === 'fee_charge' || e.kind === 'fee_payment';
      if (catFilter === 'store') return e.kind === 'store_purchase';
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{studentName}</h2>
            <p className="text-sm text-gray-400">{studentClass} · {studentId}</p>
          </div>
          <div className="flex items-center gap-2">
            {onManageFees && (
              <button onClick={onManageFees} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-100">
                + Manage Fees
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 shrink-0 border-b border-gray-100">
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-3 text-center">
            <div className="text-xs text-danger-500 font-semibold uppercase tracking-wider mb-0.5">Balance Owed</div>
            <div className="text-xl font-extrabold text-danger-700">{fmt(totalBalanceOwed)}</div>
          </div>
          <div className="bg-success-50 border border-success-200 rounded-xl p-3 text-center">
            <div className="text-xs text-success-500 font-semibold uppercase tracking-wider mb-0.5">
              {termFilter ? `${termFilter} Paid` : 'Total Fees Paid'}
            </div>
            <div className="text-xl font-extrabold text-success-700">{fmt(totalPaidInTerm)}</div>
          </div>
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-center">
            <div className="text-xs text-primary-500 font-semibold uppercase tracking-wider mb-0.5">Class / Term</div>
            <div className="text-sm font-bold text-primary-700 leading-tight mt-0.5">{studentClass}</div>
            <div className="text-xs text-primary-500">{currentTerm || '—'}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 py-3 shrink-0 border-b border-gray-100 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs">
            {TERM_OPTIONS.map((t) => (
              <button key={t} onClick={() => setTermFilter(t)} className={`px-2.5 py-1 rounded-md font-semibold transition-all ${termFilter === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === '' ? 'All Terms' : t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs ml-auto">
            {([['all', 'All'], ['fees', 'Fee Payments'], ['store', 'Store Purchases']] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setCatFilter(val)} className={`px-2.5 py-1 rounded-md font-semibold transition-all ${catFilter === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Receipt className="w-5 h-5" />
              </div>
              <p className="font-medium text-sm">No transaction activity recorded{termFilter ? ` for ${termFilter}` : ''}.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
              <div className="space-y-4">
                {filtered.map((e) => (
                  <div key={e.id} className="relative flex gap-4">
                    {/* Icon */}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      e.kind === 'fee_charge' ? 'bg-warning-100 text-warning-700' :
                      e.kind === 'fee_payment' ? 'bg-success-100 text-success-700' :
                      'bg-primary-100 text-primary-700'
                    }`}>
                      {e.kind === 'fee_charge' && <Tag className="w-3.5 h-3.5" />}
                      {e.kind === 'fee_payment' && <Receipt className="w-3.5 h-3.5" />}
                      {e.kind === 'store_purchase' && <ShoppingCart className="w-3.5 h-3.5" />}
                    </div>

                    {/* Card */}
                    <div className={`flex-1 rounded-xl border p-3.5 ${
                      e.kind === 'fee_charge' ? 'bg-warning-50 border-warning-200' :
                      e.kind === 'fee_payment' ? 'bg-success-50 border-success-200' :
                      'bg-white border-gray-200'
                    }`}>
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          {e.kind === 'fee_charge' && (
                            <>
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 bg-warning-200 text-warning-800 rounded uppercase tracking-wide mb-1">Fee Assigned</span>
                              <div className="font-semibold text-sm text-gray-900">{e.fee_name}</div>
                              <div className="text-xs text-gray-500">{e.session}{e.term ? ` · ${e.term}` : ''}</div>
                            </>
                          )}
                          {e.kind === 'fee_payment' && (
                            <>
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 bg-success-200 text-success-800 rounded uppercase tracking-wide mb-1">Fee Payment</span>
                              <div className="font-semibold text-sm text-gray-900">{e.fee_type_name || 'Fee Payment'}</div>
                              <div className="text-xs text-gray-500">Ref #{e.ref} · {e.payment_mode}</div>
                            </>
                          )}
                          {e.kind === 'store_purchase' && (
                            <>
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 bg-primary-200 text-primary-800 rounded uppercase tracking-wide mb-1">
                                {e.txnType === 'REGISTRATION_PAYMENT' ? 'Registration' : 'Store Purchase'}
                              </span>
                              <div className="font-semibold text-sm text-gray-900">
                                {(e.items || []).length > 0
                                  ? (e.items || []).map((i) => `${i.quantity}× ${i.item_name}`).join(', ')
                                  : 'Store Purchase'}
                              </div>
                              <div className="text-xs text-gray-500">Ref #{e.ref} · {e.payment_mode}</div>
                            </>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-bold text-sm ${e.kind === 'fee_payment' ? 'text-success-700' : e.kind === 'fee_charge' ? 'text-warning-700' : 'text-gray-800'}`}>
                            {e.kind === 'fee_payment' ? '+' : ''}{fmt(e.amount)}
                          </div>
                          {e.kind === 'fee_charge' && (
                            <div className={`text-xs font-medium mt-0.5 ${e.balance! <= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                              {e.balance! <= 0 ? '✓ Cleared' : `${fmt(e.balance!)} owing`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">{fmtDate(e.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentTimeline;
