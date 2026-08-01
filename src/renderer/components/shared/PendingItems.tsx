import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle, Package } from 'lucide-react';
import { issuanceAPI } from '../../lib/api';

interface PendingItem {
  id: number;
  book_name: string;
  quantity: number;
  status: string;
  created_at: string;
}

interface PendingItemsProps {
  studentId?: string;
  applicantId?: number;
  variant?: 'badge' | 'full';
  onFulfilled?: () => void;
}

const PendingItems: React.FC<PendingItemsProps> = ({ studentId, applicantId, variant = 'full', onFulfilled }) => {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fulfillingId, setFulfillingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!studentId && !applicantId) return;
    setLoading(true);
    try {
      const data = studentId
        ? await issuanceAPI.getPendingByStudent(studentId)
        : await issuanceAPI.getPendingByApplicant(applicantId!);
      setItems(data);
    } catch (err) {
      console.error('Failed to load pending items:', err);
    }
    setLoading(false);
  }, [studentId, applicantId]);

  useEffect(() => { load(); }, [load]);

  const handleFulfill = async (id: number) => {
    setFulfillingId(id);
    setError('');
    try {
      const result = await issuanceAPI.fulfill(id, 0);
      if (result.success) {
        await load();
        onFulfilled?.();
      } else {
        setError(result.error || 'Failed to fulfill item');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fulfill item');
    }
    setFulfillingId(null);
  };

  if (loading || items.length === 0) return null;

  if (variant === 'badge') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        <Package className="w-3 h-3" />
        {items.length} Pending Item{items.length > 1 ? 's' : ''}
      </span>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-amber-800 text-sm">Pending Items / Books Owed</h3>
      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-sm font-medium text-gray-800">{item.book_name}</div>
                <div className="text-xs text-gray-500">Qty: {item.quantity} · Paid, awaiting stock</div>
              </div>
            </div>
            <button
              onClick={() => handleFulfill(item.id)}
              disabled={fulfillingId === item.id}
              className="flex items-center gap-1 px-3 py-1.5 bg-success-600 text-white text-xs font-semibold rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {fulfillingId === item.id ? 'Assigning…' : 'Mark Delivered'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingItems;
