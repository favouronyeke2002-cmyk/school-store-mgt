import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Package, CheckCircle, Search, AlertCircle, Users } from 'lucide-react';
import { issuanceAPI } from '../../lib/api';

interface Issuance {
  id: number;
  student_id: string | null;
  applicant_id: number | null;
  item_id: number | null;
  book_name: string;
  item_name: string | null;
  bundle_name: string | null;
  quantity: number;
  status: string;
  stock_deducted: boolean;
  stock_quantity: number;
  created_at: string;
  assigned_at: string | null;
  student_name?: string;
  student_class?: string;
}

type Filter = 'all' | 'unassigned' | 'assigned';

const FulfillmentManagement: React.FC = () => {
  const [items, setItems] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('unassigned');
  const [classFilter, setClassFilter] = useState('all');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [fulfillingId, setFulfillingId] = useState<number | null>(null);
  const [fulfillingGroup, setFulfillingGroup] = useState<string | null>(null);
  const [fulfillError, setFulfillError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data = filter === 'unassigned' ? await issuanceAPI.getAllPending() : await issuanceAPI.getAll();
      if (filter === 'assigned') data = data.filter((item: Issuance) => item.status === 'assigned');
      setItems(data as Issuance[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load fulfillment items');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleFulfill = async (id: number) => {
    setFulfillingId(id);
    setFulfillError('');
    try {
      const result = await issuanceAPI.fulfill(id, 0);
      if (result.success) await load();
      else setFulfillError(result.error || 'Failed to fulfill item');
    } catch (err: any) {
      setFulfillError(err.message || 'Failed to fulfill item');
    } finally {
      setFulfillingId(null);
    }
  };

  const isPending = (item: Issuance) => item.status === 'unassigned' || item.status === 'pending';
  const isInStock = (item: Issuance) => item.stock_deducted || item.stock_quantity > 0;
  const searchable = (item: Issuance) => [item.student_name, item.student_id, item.item_name, item.book_name, item.bundle_name]
    .filter(Boolean).join(' ').toLowerCase();

  const filtered = items.filter((item) => {
    const matchesSearch = !search.trim() || searchable(item).includes(search.trim().toLowerCase());
    const matchesClass = classFilter === 'all' || item.student_class === classFilter;
    return matchesSearch && matchesClass;
  });

  const groups = useMemo(() => {
    const grouped = new Map<string, Issuance[]>();
    filtered.forEach((item) => {
      const key = item.student_id ? `student:${item.student_id}` : `applicant:${item.applicant_id}`;
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });
    return Array.from(grouped.entries()).map(([key, groupItems]) => ({ key, items: groupItems }));
  }, [filtered]);

  const classes = Array.from(new Set(items.map((item) => item.student_class).filter(Boolean))).sort();
  const fmtDate = (date: string) => new Date(date).toLocaleDateString();
  const toggleGroup = (key: string) => setOpenGroups((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const fulfillAllInStock = async (key: string, groupItems: Issuance[]) => {
    const ready = groupItems.filter((item) => isPending(item) && isInStock(item));
    if (!ready.length) return;
    setFulfillingGroup(key);
    setFulfillError('');
    try {
      for (const item of ready) {
        const result = await issuanceAPI.fulfill(item.id, 0);
        if (!result.success) throw new Error(result.error || 'Failed to fulfill item');
      }
      await load();
    } catch (err: any) {
      setFulfillError(err.message || 'Failed to fulfill items');
    } finally {
      setFulfillingGroup(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Fulfillment</h1>
          <p className="text-gray-500">{items.filter((item) => isPending(item)).length} pending · {items.length} total items tracked</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {fulfillError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" /> {fulfillError}</div>}

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
            {(['unassigned', 'assigned', 'all'] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === value ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {value === 'unassigned' ? 'Pending' : value === 'assigned' ? 'Fulfilled' : 'All'}
              </button>
            ))}
          </div>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="border rounded-md px-3 py-2 text-sm text-gray-700 bg-white">
            <option value="all">All Classes</option>
            {classes.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-md text-sm" placeholder="Search student, applicant, item, or bundle..." />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm text-center py-12 text-gray-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm text-center py-12 text-gray-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-30" />No items found</div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ key, items: groupItems }) => {
            const first = groupItems[0];
            const fulfilled = groupItems.filter((item) => item.status === 'assigned').length;
            const readyCount = groupItems.filter((item) => isPending(item) && isInStock(item)).length;
            const isOpen = openGroups.has(key);
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <button onClick={() => toggleGroup(key)} className="flex items-center gap-3 text-left min-w-0 flex-1">
                    {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{first.student_name || 'Unnamed applicant'}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-[#4B5563]">{first.applicant_id ? 'Applicant' : 'Student'}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{first.student_class || 'Class not set'} · {first.bundle_name || 'Individual items'}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{fulfilled}/{groupItems.length} Items Fulfilled</span>
                    <button onClick={() => fulfillAllInStock(key, groupItems)} disabled={readyCount === 0 || fulfillingGroup === key} className="inline-flex items-center gap-1.5 px-3 py-2 bg-success-600 text-white text-xs font-semibold rounded-lg hover:bg-success-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">
                      <CheckCircle className="w-3.5 h-3.5" />{fulfillingGroup === key ? 'Fulfilling…' : 'Fulfill All In-Stock'}
                    </button>
                  </div>
                </div>
                {isOpen && <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {groupItems.map((item) => {
                    const outOfStock = !isInStock(item);
                    return <div key={item.id} className="px-5 py-3 pl-12 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 min-w-0"><div className="font-medium text-sm text-gray-800">{item.item_name || item.book_name}</div><div className="text-xs text-gray-500">{item.quantity} item{item.quantity === 1 ? '' : 's'} · {fmtDate(item.created_at)}{item.bundle_name ? ` · ${item.bundle_name}` : ''}</div></div>
                      <span className={`px-2 py-0.5 rounded text-xs ${outOfStock ? 'bg-gray-100 text-gray-600' : item.stock_deducted ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'}`}>{outOfStock ? 'Awaiting stock' : item.stock_deducted ? 'Stock ready' : `${item.stock_quantity} in stock`}</span>
                      {item.status === 'assigned' ? <span className="text-xs text-green-700 font-medium">Fulfilled</span> : <span title={outOfStock ? 'Item Out of Stock' : undefined}><button onClick={() => handleFulfill(item.id)} disabled={outOfStock || fulfillingId === item.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-success-600 text-white text-xs font-semibold rounded-lg hover:bg-success-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"><CheckCircle className="w-3.5 h-3.5" />{fulfillingId === item.id ? 'Assigning…' : 'Assign / Mark Delivered'}</button></span>}
                    </div>;
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FulfillmentManagement;
