import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Package, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { bundleAPI, inventoryAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface BundleItem { id: number; item_id: number; item_name: string; selling_price: number; stock_quantity: number; quantity: number; }
interface Bundle { id: number; name: string; description: string | null; base_price: number; bundle_type: 'acceptance' | 'registration' | 'custom'; is_active: boolean; items: BundleItem[]; }
interface InventoryItem { item_id: number; item_name: string; selling_price: number; stock_quantity: number; }

const BundleManagement: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBundle, setExpandedBundle] = useState<number | null>(null);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editTarget, setEditTarget] = useState<Bundle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const emptyForm = { name: '', description: '', basePrice: '', bundleType: 'registration' as 'acceptance' | 'registration' | 'custom', items: [] as { itemId: number; quantity: number }[] };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const [bundleData, invData] = await Promise.all([bundleAPI.getAll(), inventoryAPI.getAll()]);
      setBundles(bundleData);
      setInventory(invData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setShowCreate(true);
  };

  const openEdit = (b: Bundle) => {
    setEditTarget(b);
    setForm({
      name: b.name,
      description: b.description || '',
      basePrice: String(b.base_price),
      bundleType: b.bundle_type,
      items: b.items.map((i) => ({ itemId: i.item_id, quantity: i.quantity })),
    });
    setError('');
    setShowEdit(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.basePrice || form.items.length === 0) {
      setError('Name, price, and at least one item are required.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await bundleAPI.create({
      name: form.name,
      description: form.description || undefined,
      basePrice: parseFloat(form.basePrice),
      bundleType: form.bundleType,
      items: form.items,
    });
    if (result.success) {
      setShowCreate(false);
      load();
    } else setError(result.error || 'Failed to create bundle');
    setSaving(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!form.name || !form.basePrice || form.items.length === 0) {
      setError('Name, price, and at least one item are required.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await bundleAPI.update(editTarget.id, {
      name: form.name,
      description: form.description || undefined,
      basePrice: parseFloat(form.basePrice),
      bundleType: form.bundleType,
      items: form.items,
    });
    if (result.success) {
      setShowEdit(false);
      load();
    } else setError(result.error || 'Failed to update bundle');
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await bundleAPI.delete(deleteTarget.id);
    setShowDelete(false);
    setDeleteTarget(null);
    load();
  };

  const addItemToForm = (itemId: number) => {
    const exists = form.items.find((i) => i.itemId === itemId);
    if (exists) return;
    setForm((p) => ({ ...p, items: [...p.items, { itemId, quantity: 1 }] }));
  };

  const removeItemFromForm = (itemId: number) => {
    setForm((p) => ({ ...p, items: p.items.filter((i) => i.itemId !== itemId) }));
  };

  const updateItemQty = (itemId: number, qty: number) => {
    setForm((p) => ({ ...p, items: p.items.map((i) => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i) }));
  };

  const getItemName = (itemId: number) => inventory.find((i) => i.item_id === itemId)?.item_name || 'Unknown';
  const getItemPrice = (itemId: number) => inventory.find((i) => i.item_id === itemId)?.selling_price || 0;

  const BundleForm: React.FC<{ onSubmit: (e: React.FormEvent) => void; onCancel: () => void }> = ({ onSubmit, onCancel }) => {
    const availableItems = inventory.filter((i) => !form.items.some((fi) => fi.itemId === i.item_id));
    const totalItemsValue = form.items.reduce((s, i) => s + getItemPrice(i.itemId) * i.quantity, 0);

    return (
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2">{error}</div>}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Bundle Name *</label>
          <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="e.g. Registration Fee Bundle" required />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
          <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Optional description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Base Price (Lump Sum) *</label>
            <input type="number" min="0" step="0.01" value={form.basePrice} onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Bundle Type</label>
            <select value={form.bundleType} onChange={(e) => setForm((p) => ({ ...p, bundleType: e.target.value as any }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="acceptance">Acceptance Fee</option>
              <option value="registration">Registration Fee</option>
              <option value="custom">Custom Bundle</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Bundle Items *</label>
          <div className="space-y-2 mb-3">
            {form.items.map((item) => {
              const price = getItemPrice(item.itemId);
              const name = getItemName(item.itemId);
              return (
                <div key={item.itemId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-gray-400">{fmt(price)} each</div>
                  </div>
                  <input type="number" min="1" value={item.quantity} onChange={(e) => updateItemQty(item.itemId, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 border rounded text-sm text-center" />
                  <button type="button" onClick={() => removeItemFromForm(item.itemId)} className="text-danger-500 hover:text-danger-700"><X className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
          {availableItems.length > 0 && (
            <select onChange={(e) => { if (e.target.value) addItemToForm(Number(e.target.value)); e.target.value = ''; }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="">+ Add Item</option>
              {availableItems.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name} ({fmt(i.selling_price)})</option>)}
            </select>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between mb-1"><span>Items Total Value:</span><span>{fmt(totalItemsValue)}</span></div>
          <div className="flex justify-between font-bold"><span>Lump Sum Price:</span><span className="text-primary-600">{fmt(parseFloat(form.basePrice) || 0)}</span></div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Bundle'}</button>
        </div>
      </form>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Bundle Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure admission and registration bundles with lump-sum pricing</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
          <Plus className="w-4 h-4" /> New Bundle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : bundles.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bundles configured</p>
          <p className="text-sm mt-1">Create bundles like Acceptance Fee or Registration Fee with linked inventory items</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">Create First Bundle</button>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((b) => {
            const isExpanded = expandedBundle === b.id;
            const itemsValue = b.items.reduce((s, i) => s + Number(i.selling_price) * i.quantity, 0);
            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{b.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.bundle_type === 'acceptance' ? 'bg-warning-100 text-warning-700' : b.bundle_type === 'registration' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600'}`}>{b.bundle_type}</span>
                        {!b.is_active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                      </div>
                      {b.description && <p className="text-sm text-gray-500 mb-2">{b.description}</p>}
                      <div className="flex items-center gap-4 text-sm">
                        <span><span className="text-gray-400">Lump Sum:</span> <span className="font-bold text-primary-600">{fmt(b.base_price)}</span></span>
                        <span><span className="text-gray-400">Items:</span> <span>{b.items.length} items</span></span>
                        <span><span className="text-gray-400">Items Value:</span> <span>{fmt(itemsValue)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setExpandedBundle(isExpanded ? null : b.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(b)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100 font-medium">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => { setDeleteTarget(b); setShowDelete(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-danger-50 text-danger-600 rounded-lg text-sm hover:bg-danger-100 font-medium">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                {isExpanded && b.items.length > 0 && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {b.items.map((item) => (
                        <div key={item.id} className="bg-white rounded-lg p-3 border">
                          <div className="font-medium text-sm text-gray-800">{item.item_name}</div>
                          <div className="text-xs text-gray-400 mt-1">Qty: {item.quantity} · {fmt(item.selling_price)} each</div>
                          <div className="text-sm font-semibold text-primary-600 mt-1">{fmt(item.selling_price * item.quantity)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create Bundle</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <BundleForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Edit: {editTarget.name}</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <BundleForm onSubmit={handleEdit} onCancel={() => setShowEdit(false)} />
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Delete Bundle?</h2>
            <p className="text-sm text-gray-500 mb-5">Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDelete(false); setDeleteTarget(null); }} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleManagement;
