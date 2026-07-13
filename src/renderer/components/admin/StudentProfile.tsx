import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, ShoppingCart, Receipt, Tag, Loader2,
  CheckCircle2, Clock, AlertTriangle, Package, Zap, FileText,
} from 'lucide-react';
import { studentFeeAPI, transactionAPI, inventoryAPI, settingsAPI } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const fmt = (n: number) =>
  `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
};

interface Props {
  studentId: string;
  studentName: string;
  studentClass: string;
  onBack: () => void;
  onManageFees?: () => void;
}

type StoreTab = 'financial' | 'store';

const TERM_OPTIONS = ['', 'First Term', 'Second Term', 'Third Term'];

const StudentProfile: React.FC<Props> = ({
  studentId, studentName, studentClass, onBack, onManageFees,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [activeTab, setActiveTab] = useState<StoreTab>('financial');
  const [loading, setLoading] = useState(true);
  const [studentFees, setStudentFees] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Financial tab filters
  const [termFilter, setTermFilter] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | 'fees' | 'store'>('all');

  // Distribution tracking state
  const [stockLevels, setStockLevels] = useState<Record<number, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [issuingIds, setIssuingIds] = useState<Set<number>>(new Set());
  const [issueError, setIssueError] = useState('');
  const [bulkIssuing, setBulkIssuing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fees, txns, s] = await Promise.all([
        studentFeeAPI.getForStudent(studentId),
        transactionAPI.getForStudent(studentId),
        settingsAPI.get(),
      ]);
      setStudentFees(fees);
      setTransactions(txns);
      setSettings(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // Load stock levels for all pending store items whenever transactions change
  useEffect(() => {
    const storeTxns = transactions.filter(t =>
      t.type === 'STORE_PURCHASE' || t.type === 'BUNDLE_PURCHASE' || t.type === 'ACCEPTANCE_FEE'
    );
    const pendingItemIds: number[] = [];
    for (const txn of storeTxns) {
      for (const item of txn.items || []) {
        if (!item.issued_at && item.item_id) {
          pendingItemIds.push(item.item_id);
        }
      }
    }
    if (pendingItemIds.length === 0) return;
    setStockLoading(true);
    inventoryAPI.getStockLevels(pendingItemIds)
      .then(setStockLevels)
      .catch(console.error)
      .finally(() => setStockLoading(false));
  }, [transactions]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalBalanceOwed = studentFees.reduce(
    (s, sf) => s + Math.max(0, Number(sf.amount_due) - Number(sf.amount_paid)), 0
  );
  const currentSession = settings?.academic_session || '';
  const currentTerm = settings?.current_term || '';
  const arrearsForward = studentFees
    .filter(sf => sf.academic_session !== currentSession)
    .reduce((s, sf) => s + Math.max(0, Number(sf.amount_due) - Number(sf.amount_paid)), 0);
  const currentTermPaid = studentFees
    .filter(sf => !termFilter || sf.term === termFilter)
    .reduce((s, sf) => s + Number(sf.amount_paid), 0);

  // ── Financial statement events ────────────────────────────────────────────
  type EventKind = 'fee_charge' | 'fee_payment' | 'store_purchase';
  interface TEvent {
    id: string; kind: EventKind; date: string; amount: number;
    fee_name?: string; term?: string | null; session?: string;
    amount_paid_on_fee?: number; balance?: number; fee_type_name?: string | null;
    ref?: number; payment_mode?: string;
    items?: { item_name: string; quantity: number; unit_price: number; total_price: number }[];
    txnType?: string;
  }

  const events: TEvent[] = [];
  for (const sf of studentFees) {
    if (termFilter && sf.term !== termFilter) continue;
    events.push({
      id: `fee_${sf.id}`, kind: 'fee_charge', date: sf.created_at,
      amount: Number(sf.amount_due), fee_name: sf.fee_name, term: sf.term,
      session: sf.academic_session, amount_paid_on_fee: Number(sf.amount_paid),
      balance: Number(sf.amount_due) - Number(sf.amount_paid),
    });
  }
  for (const txn of transactions) {
    if (txn.type === 'FEES_CASH_COLLECTION') {
      if (catFilter === 'store') continue;
      events.push({
        id: `txn_${txn.transaction_id}`, kind: 'fee_payment', date: txn.timestamp,
        amount: Number(txn.amount_paid), fee_type_name: txn.fee_type_name,
        ref: txn.transaction_id, payment_mode: txn.payment_mode,
      });
    } else {
      if (catFilter === 'fees') continue;
      if (termFilter) continue;
      events.push({
        id: `txn_${txn.transaction_id}`, kind: 'store_purchase', date: txn.timestamp,
        amount: Number(txn.amount_paid), payment_mode: txn.payment_mode,
        ref: txn.transaction_id, items: txn.items || [], txnType: txn.type,
      });
    }
  }
  const filteredEvents = events
    .filter(e => {
      if (catFilter === 'fees') return e.kind === 'fee_charge' || e.kind === 'fee_payment';
      if (catFilter === 'store') return e.kind === 'store_purchase';
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Store purchases (for distribution tab) ────────────────────────────────
  const storeTxns = transactions
    .filter(t => t.type === 'STORE_PURCHASE' || t.type === 'BUNDLE_PURCHASE' || t.type === 'ACCEPTANCE_FEE')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // ── Issue helpers ─────────────────────────────────────────────────────────
  const handleIssueItem = async (transactionItemId: number) => {
    if (!isAdmin) return;
    setIssuingIds(prev => new Set(prev).add(transactionItemId));
    setIssueError('');
    try {
      const { error } = await (transactionAPI as any).markItemsIssued(
        [transactionItemId], user?.username || 'Admin'
      );
      if (error) {
        setIssueError(error.includes('column') ? 'DB migration needed: add issued_at / issued_by to transaction_items.' : error);
      } else {
        await load();
      }
    } catch (e: any) {
      setIssueError(e.message || 'Failed to issue item');
    } finally {
      setIssuingIds(prev => { const s = new Set(prev); s.delete(transactionItemId); return s; });
    }
  };

  const handleBulkIssue = async () => {
    if (!isAdmin) return;
    setBulkIssuing(true);
    setIssueError('');
    const pendingIds: number[] = [];
    for (const txn of storeTxns) {
      for (const item of txn.items || []) {
        if (!item.issued_at && item.item_id && (stockLevels[item.item_id] ?? 0) > 0 && item.id) {
          pendingIds.push(item.id);
        }
      }
    }
    if (pendingIds.length === 0) { setBulkIssuing(false); return; }
    try {
      const { error } = await (transactionAPI as any).markItemsIssued(
        pendingIds, user?.username || 'Admin'
      );
      if (error) {
        setIssueError(error.includes('column') ? 'DB migration needed: add issued_at / issued_by to transaction_items.' : error);
      } else {
        await load();
      }
    } catch (e: any) {
      setIssueError(e.message || 'Failed to issue items');
    }
    setBulkIssuing(false);
  };

  const pendingAvailableCount = storeTxns.reduce((count, txn) => {
    return count + (txn.items || []).filter((item: any) =>
      !item.issued_at && item.item_id && (stockLevels[item.item_id] ?? 0) > 0
    ).length;
  }, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Ledger
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="font-bold text-gray-900">{studentName}</h1>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left panel ─────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {/* Profile card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-3">
                <User className="w-8 h-8 text-primary-500" />
              </div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">{studentName}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{studentClass}</p>
              <p className="text-xs font-mono text-gray-400 mt-1">{studentId}</p>
            </div>

            <div className="space-y-2">
              <div className={`rounded-xl px-4 py-3 border text-center ${
                totalBalanceOwed > 0
                  ? 'bg-danger-50 border-danger-200'
                  : 'bg-success-50 border-success-200'
              }`}>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                  totalBalanceOwed > 0 ? 'text-danger-500' : 'text-success-500'
                }`}>Outstanding Balance</div>
                <div className={`text-xl font-extrabold ${
                  totalBalanceOwed > 0 ? 'text-danger-700' : 'text-success-700'
                }`}>{fmt(totalBalanceOwed)}</div>
              </div>

              {arrearsForward > 0 && (
                <div className="rounded-xl px-4 py-3 bg-warning-50 border border-warning-200 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wider mb-0.5 text-warning-500">Arrears B/F</div>
                  <div className="text-lg font-extrabold text-warning-700">{fmt(arrearsForward)}</div>
                  <div className="text-xs text-warning-400 mt-0.5">from prior sessions</div>
                </div>
              )}

              <div className="rounded-xl px-4 py-3 bg-primary-50 border border-primary-200 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider mb-0.5 text-primary-500">Term Paid</div>
                <div className="text-lg font-extrabold text-primary-700">{fmt(currentTermPaid)}</div>
                <div className="text-xs text-primary-400 mt-0.5">{currentTerm || '—'} · {currentSession}</div>
              </div>
            </div>
          </div>

          {onManageFees && (
            <button
              onClick={onManageFees}
              className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              + Manage Fees
            </button>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-w-0 min-h-0">
          {/* Tab bar */}
          <div className="flex gap-1 p-3 border-b border-gray-100 shrink-0">
            <button
              onClick={() => setActiveTab('financial')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'financial'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" /> Financial Statement
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'store'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Store Purchases
              {storeTxns.length > 0 && (
                <span className="ml-1 bg-gray-200 text-gray-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {storeTxns.length}
                </span>
              )}
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
          ) : activeTab === 'financial' ? (
            /* ── Financial Statement Tab ───────────────────────────────── */
            <div className="flex flex-col flex-1 min-h-0">
              {/* Filters */}
              <div className="flex items-center gap-2 px-5 py-3 shrink-0 border-b border-gray-100 flex-wrap">
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs">
                  {TERM_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTermFilter(t)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        termFilter === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t === '' ? 'All Terms' : t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg text-xs ml-auto">
                  {([['all', 'All'], ['fees', 'Fee Payments'], ['store', 'Store Purchases']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setCatFilter(val)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        catFilter === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-auto px-6 py-5">
                {filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <p className="font-medium text-sm">No activity recorded{termFilter ? ` for ${termFilter}` : ''}.</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {filteredEvents.map(e => (
                        <div key={e.id} className="relative flex gap-4">
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            e.kind === 'fee_charge' ? 'bg-warning-100 text-warning-700' :
                            e.kind === 'fee_payment' ? 'bg-success-100 text-success-700' :
                            'bg-primary-100 text-primary-700'
                          }`}>
                            {e.kind === 'fee_charge' && <Tag className="w-3.5 h-3.5" />}
                            {e.kind === 'fee_payment' && <Receipt className="w-3.5 h-3.5" />}
                            {e.kind === 'store_purchase' && <ShoppingCart className="w-3.5 h-3.5" />}
                          </div>
                          <div className={`flex-1 rounded-xl border p-4 ${
                            e.kind === 'fee_charge' ? 'bg-warning-50 border-warning-200' :
                            e.kind === 'fee_payment' ? 'bg-success-50 border-success-200' :
                            'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-start justify-between gap-4 mb-1">
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
                                      {e.txnType === 'BUNDLE_PURCHASE' ? 'Bundle' : e.txnType === 'ACCEPTANCE_FEE' ? 'Acceptance' : 'Store Purchase'}
                                    </span>
                                    <div className="font-semibold text-sm text-gray-900">
                                      {(e.items || []).length > 0
                                        ? (e.items || []).map(i => `${i.quantity}× ${i.item_name}`).join(', ')
                                        : 'Store Purchase'}
                                    </div>
                                    <div className="text-xs text-gray-500">Ref #{e.ref} · {e.payment_mode}</div>
                                  </>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`font-bold text-sm ${
                                  e.kind === 'fee_payment' ? 'text-success-700' :
                                  e.kind === 'fee_charge' ? 'text-warning-700' : 'text-gray-800'
                                }`}>
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
          ) : (
            /* ── Store Purchases / Distribution Tab ────────────────────── */
            <div className="flex flex-col flex-1 min-h-0">
              {/* Bulk action bar */}
              {isAdmin && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0 bg-gray-50">
                  <div className="text-sm text-gray-500">
                    {stockLoading
                      ? <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking stock…</span>
                      : <span><strong>{pendingAvailableCount}</strong> item{pendingAvailableCount !== 1 ? 's' : ''} ready to issue</span>
                    }
                  </div>
                  <button
                    onClick={handleBulkIssue}
                    disabled={bulkIssuing || pendingAvailableCount === 0 || stockLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    {bulkIssuing ? 'Issuing…' : 'Issue All Available Items'}
                  </button>
                </div>
              )}

              {issueError && (
                <div className="mx-5 mt-3 px-4 py-2 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700 flex items-start gap-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {issueError}
                </div>
              )}

              <div className="flex-1 overflow-auto px-5 py-4">
                {storeTxns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <p className="font-medium text-sm">No store purchases yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {storeTxns.map(txn => {
                      const items: any[] = txn.items || [];
                      const typeLabel = txn.type === 'BUNDLE_PURCHASE' ? 'Bundle'
                        : txn.type === 'ACCEPTANCE_FEE' ? 'Acceptance Fee' : 'Store Purchase';
                      return (
                        <div key={txn.transaction_id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                          {/* Transaction header */}
                          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                txn.type === 'STORE_PURCHASE' ? 'bg-primary-100 text-primary-700' :
                                txn.type === 'BUNDLE_PURCHASE' ? 'bg-purple-100 text-purple-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{typeLabel}</span>
                              <span className="text-sm font-mono text-gray-500">#{txn.transaction_id}</span>
                              <span className="text-sm text-gray-400">{fmtDate(txn.timestamp)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400">{txn.payment_mode}</span>
                              <span className="font-bold text-gray-800">{fmt(Number(txn.amount_paid))}</span>
                            </div>
                          </div>

                          {/* Item rows */}
                          {items.length === 0 ? (
                            <div className="px-5 py-3 text-sm text-gray-400 italic">No item details recorded.</div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {items.map((item: any, idx: number) => {
                                const issued = !!item.issued_at;
                                const stock = item.item_id ? (stockLevels[item.item_id] ?? null) : null;
                                const issuable = !issued && stock !== null && stock > 0;
                                const outOfStock = !issued && stock !== null && stock === 0;
                                const issuingThis = item.id && issuingIds.has(item.id);
                                return (
                                  <div key={item.id ?? idx} className="flex items-center gap-4 px-5 py-3">
                                    {/* Item name + qty */}
                                    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
                                      <Package className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm text-gray-900 truncate">{item.item_name}</div>
                                      <div className="text-xs text-gray-400">
                                        Qty {item.quantity} · {fmt(item.unit_price)} each · Total {fmt(item.total_price)}
                                      </div>
                                    </div>

                                    {/* Status badge */}
                                    <div className="shrink-0 flex items-center gap-2">
                                      {issued ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="flex items-center gap-1 px-2.5 py-1 bg-success-100 text-success-700 rounded-full text-xs font-bold">
                                            <CheckCircle2 className="w-3 h-3" /> Issued
                                          </span>
                                          <div className="text-right">
                                            <div className="text-xs text-gray-400">{fmtDate(item.issued_at)}</div>
                                            {item.issued_by && (
                                              <div className="text-xs text-gray-400">by {item.issued_by}</div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                                            <Clock className="w-3 h-3" /> Pending Collection
                                          </span>
                                          {stockLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />
                                          ) : outOfStock ? (
                                            <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                                              <AlertTriangle className="w-3 h-3" /> Out of Stock
                                            </span>
                                          ) : issuable && isAdmin ? (
                                            <button
                                              onClick={() => handleIssueItem(item.id)}
                                              disabled={issuingThis}
                                              className="flex items-center gap-1 px-3 py-1 bg-success-600 text-white rounded-full text-xs font-bold hover:bg-success-700 disabled:opacity-50 transition-colors"
                                            >
                                              {issuingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                              {issuingThis ? '…' : 'Issue'}
                                            </button>
                                          ) : stock !== null && (
                                            <span className="text-xs text-gray-400">{stock} in stock</span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
