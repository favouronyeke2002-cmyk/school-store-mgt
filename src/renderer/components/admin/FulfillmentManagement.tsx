import React, { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { issuanceAPI } from '../../lib/api';

interface Issuance {
  id: number;
  student_id: string | null;
  applicant_id: number | null;
  transaction_id: number | null;
  item_id: number | null;
  book_name: string;
  item_name: string | null;
  bundle_name: string | null;
  quantity: number;
  status: string;
  stock_deducted: boolean;
  created_at: string;
  assigned_at: string | null;
  student_name?: string;
  student_class?: string;
}

const FulfillmentManagement: React.FC = () => {
  const [items, setItems] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('unassigned');
  const [fulfillingId, setFulfillingId] = useState<number | null>(null);
  const [fulfillError, setFulfillError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data: Issuance[];
      if (filter === 'unassigned') {
        data = await issuanceAPI.getAllPending();
      } else {
        data = await issuanceAPI.getAll();
        if (filter === 'assigned') {
          data = data.filter((i) => i.status === 'assigned');
        }
      }
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load fulfillment items');
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleFulfill = async (id: number) => {
    setFulfillingId(id);
    setFulfillError('');
    try {
      const result = await issuanceAPI.fulfill(id, 0);
      if (result.success) {
        await load();
      } else {
        setFulfillError(result.error || 'Failed to fulfill item');
      }
    } catch (err: any) {
      setFulfillError(err.message || 'Failed to fulfill item');
    }
    setFulfillingId(null);
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const name = (i.item_name || i.book_name || '').toLowerCase();
    const bundle = (i.bundle_name || '').toLowerCase();
    const sid = (i.student_id || '').toLowerCase();
    const studentName = (i.student_name || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || bundle.includes(q) || sid.includes(q) || studentName.includes(q);
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Store Fulfillment</h1>
          <p className="text-gray-500">
            {items.filter((i) => i.status === 'unassigned').length} unassigned · {items.length} total items tracked
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {fulfillError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {fulfillError}
        </div>
      )}

      {/* Filter + Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['unassigned', 'assigned', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === f ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {f === 'unassigned' ? 'Pending' : f === 'assigned' ? 'Fulfilled' : 'All'}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
              placeholder="Search by item, bundle, or student ID..."
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Student', 'Item', 'Bundle', 'Qty', 'Stock Status', 'Fulfillment Status', 'Action'].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${i >= 6 ? 'text-right' : 'text-left'} ${i === 7 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No items found
                </td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(item.created_at)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-800">{item.student_name || '—'}</div>
                    <div className="text-xs text-gray-400 font-mono">{item.student_id || `Applicant #${item.applicant_id}`}{item.student_class ? ` · ${item.student_class}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.item_name || item.book_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.bundle_name || '—'}</td>
                  <td className="px-4 py-3 text-sm">{item.quantity}</td>
                  <td className="px-4 py-3">
                    {item.stock_deducted ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Deducted at sale</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Awaiting stock</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'assigned' ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-success-100 text-success-700 font-medium">Fulfilled</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.status === 'unassigned' ? (
                      <button
                        onClick={() => handleFulfill(item.id)}
                        disabled={fulfillingId === item.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-success-600 text-white text-xs font-semibold rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {fulfillingId === item.id ? 'Assigning…' : 'Assign / Mark Delivered'}
                      </button>
                    ) : item.assigned_at ? (
                      <span className="text-xs text-gray-400">Fulfilled {fmtDate(item.assigned_at)}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FulfillmentManagement;
