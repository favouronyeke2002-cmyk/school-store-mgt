import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Package, X, Tag } from 'lucide-react';
import { inventoryAPI, categoryAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Item { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; category_id: number | null; category_name: string | null; category_color: string | null; }
interface Category { id: number; name: string; color: string; }
type FormData = { itemName: string; costPrice: string; sellingPrice: string; stockQuantity: string; barcode: string; categoryId: string; };
const emptyForm: FormData = { itemName: '', costPrice: '', sellingPrice: '', stockQuantity: '', barcode: '', categoryId: '' };

const InventoryManagement: React.FC = () => {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [catFilter, setCatFilter] = useState<string>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Category manager state
  const [catForm, setCatForm] = useState({ name: '', color: '#3b82f6' });
  const [editCat, setEditCat] = useState<Category | null>(null);

  // Adjust stock state
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const reload = () => {
    setLoading(true);
    Promise.all([
      inventoryAPI.getAll({ search, lowStock, categoryId: catFilter !== 'all' ? Number(catFilter) : null }),
      categoryAPI.getAll(),
    ]).then(([inv, cats]) => { setInventory(inv); setCategories(cats); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [search, lowStock, catFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await inventoryAPI.create({ itemName: form.itemName, costPrice: parseFloat(form.costPrice), sellingPrice: parseFloat(form.sellingPrice), stockQuantity: parseInt(form.stockQuantity) || 0, barcode: form.barcode || undefined, categoryId: form.categoryId ? Number(form.categoryId) : null });
    if (result.success) { setShowAdd(false); setForm(emptyForm); reload(); }
    else alert(result.error);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await inventoryAPI.update(selected.item_id, { itemName: form.itemName, costPrice: parseFloat(form.costPrice), sellingPrice: parseFloat(form.sellingPrice), barcode: form.barcode || undefined, categoryId: form.categoryId ? Number(form.categoryId) : null });
    setShowEdit(false);
    reload();
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty === 0) { alert('Enter a non-zero quantity'); return; }
    if (!adjReason.trim()) { alert('Please enter a reason'); return; }
    await inventoryAPI.adjustStock(selected.item_id, qty, adjReason);
    setShowAdjust(false);
    setAdjQty('');
    setAdjReason('');
    reload();
  };

  const openEdit = (item: Item) => {
    setSelected(item);
    setForm({ itemName: item.item_name, costPrice: String(item.cost_price), sellingPrice: String(item.selling_price), stockQuantity: String(item.stock_quantity), barcode: item.barcode || '', categoryId: item.category_id ? String(item.category_id) : '' });
    setShowEdit(true);
  };

  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editCat) {
      await categoryAPI.update(editCat.id, catForm.name, catForm.color);
    } else {
      const r = await categoryAPI.create(catForm.name, catForm.color);
      if (!r.success) { alert(r.error); return; }
    }
    setCatForm({ name: '', color: '#3b82f6' });
    setEditCat(null);
    categoryAPI.getAll().then(setCategories);
  };

  const totalValue = inventory.reduce((s, i) => s + i.stock_quantity * i.selling_price, 0);

  const FormFields: React.FC<{ onSubmit: (e: React.FormEvent) => void; submitLabel: string; onCancel: () => void }> = ({ onSubmit, submitLabel, onCancel }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Item Name *</label>
        <input type="text" value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
        <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="">No Category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Barcode (optional)</label>
        <input type="text" value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Cost Price *</label>
          <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Selling Price *</label>
          <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => setForm((p) => ({ ...p, sellingPrice: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">Initial Stock</label>
        <input type="number" min="0" value={form.stockQuantity} onChange={(e) => setForm((p) => ({ ...p, stockQuantity: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>
      {form.costPrice && form.sellingPrice && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
          Profit per unit: <strong className="text-success-600">{fmt(parseFloat(form.sellingPrice || '0') - parseFloat(form.costPrice || '0'))}</strong>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
        <button type="submit" className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">{submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">{inventory.length} items · {fmt(totalValue)} total retail value</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatMgr(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Tag className="w-4 h-4" /> Categories
          </button>
          <button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'SKUs', value: inventory.length },
          { label: 'Total Units', value: inventory.reduce((s, i) => s + i.stock_quantity, 0).toLocaleString() },
          { label: 'Retail Value', value: fmt(totalValue) },
          { label: 'Low Stock (≤10)', value: inventory.filter((i) => i.stock_quantity <= 10).length, danger: true },
        ].map((s, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-xs text-gray-400 font-semibold uppercase mb-1">{s.label}</div>
            <div className={`text-2xl font-extrabold ${s.danger && Number(s.value) > 0 ? 'text-danger-600' : 'text-gray-900'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex items-center gap-3 flex-wrap">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Search items or barcode…" />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="rounded" />
          Low stock only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Item Name', 'Category', 'Barcode', 'Cost', 'Selling Price', 'Stock', 'Profit/Unit', 'Actions'].map((h) => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${h === 'Actions' ? 'text-center' : h === 'Cost' || h === 'Selling Price' || h === 'Stock' || h === 'Profit/Unit' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No items found</td></tr>
            ) : inventory.map((item) => (
              <tr key={item.item_id} className={`border-t hover:bg-gray-50 ${item.stock_quantity <= 10 && item.stock_quantity > 0 ? 'bg-warning-50' : item.stock_quantity <= 0 ? 'bg-danger-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{item.item_name}</td>
                <td className="px-4 py-3">
                  {item.category_name ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: item.category_color || '#6b7280' }}>{item.category_name}</span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.barcode || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(item.cost_price)}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary-600">{fmt(item.selling_price)}</td>
                <td className={`px-4 py-3 text-right font-bold ${item.stock_quantity <= 0 ? 'text-danger-600' : item.stock_quantity <= 10 ? 'text-warning-600' : 'text-gray-900'}`}>{item.stock_quantity}</td>
                <td className="px-4 py-3 text-right text-success-600 font-medium">{fmt(item.selling_price - item.cost_price)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg mr-1 transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { setSelected(item); setAdjQty(''); setAdjReason(''); setShowAdjust(true); }} className="px-2 py-1 text-xs bg-warning-100 text-warning-700 rounded-lg hover:bg-warning-200 font-medium">Stock</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold">Add New Item</h2><button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <FormFields onSubmit={handleCreate} submitLabel="Add Item" onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold">Edit: {selected.item_name}</h2><button onClick={() => setShowEdit(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <FormFields onSubmit={handleUpdate} submitLabel="Update Item" onCancel={() => setShowEdit(false)} />
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Adjust Stock</h2><button onClick={() => setShowAdjust(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
              <div className="font-bold text-gray-900">{selected.item_name}</div>
              <div className="text-3xl font-extrabold mt-1">{selected.stock_quantity}</div>
              <div className="text-xs text-gray-400">current units</div>
            </div>
            <form onSubmit={handleAdjust} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity Change (use - for removals)</label>
                <input type="number" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} placeholder="e.g. +50 or -5" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
                {adjQty && !isNaN(parseInt(adjQty)) && (
                  <div className="mt-1 text-sm">New stock will be: <strong>{selected.stock_quantity + parseInt(adjQty)}</strong></div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Reason *</label>
                <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. Received new stock, Damaged items" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdjust(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-semibold hover:bg-warning-600">Apply</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCatMgr && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Manage Categories</h2><button onClick={() => setShowCatMgr(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <form onSubmit={saveCat} className="flex gap-2 mb-4">
              <input type="text" value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} placeholder="Category name" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              <input type="color" value={catForm.color} onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" title="Category color" />
              <button type="submit" className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">{editCat ? 'Save' : 'Add'}</button>
              {editCat && <button type="button" onClick={() => { setEditCat(null); setCatForm({ name: '', color: '#3b82f6' }); }} className="px-3 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">Cancel</button>}
            </form>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <button onClick={() => { setEditCat(c); setCatForm({ name: c.name, color: c.color }); }} className="p-1 text-gray-400 hover:text-primary-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={async () => { await categoryAPI.delete(c.id); categoryAPI.getAll().then(setCategories); }} className="p-1 text-gray-400 hover:text-danger-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
