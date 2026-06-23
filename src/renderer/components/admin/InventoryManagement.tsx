import React, { useState, useEffect } from 'react';
import { Plus, Pencil, X, Tag, AlertCircle, Trash2, Archive } from 'lucide-react';
import { inventoryAPI, categoryAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Item { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; category_id: number | null; category_name: string | null; category_color: string | null; is_active: boolean; }
interface Category { id: number; name: string; color: string; }
type FormData = { itemName: string; costPrice: string; sellingPrice: string; stockQuantity: string; barcode: string; categoryId: string; };
const emptyForm: FormData = { itemName: '', costPrice: '', sellingPrice: '', stockQuantity: '', barcode: '', categoryId: '' };

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';
const labelCls = 'text-sm font-medium text-gray-700 mb-1 block';

const InventoryManagement: React.FC = () => {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  const [addForm, setAddForm] = useState<FormData>(emptyForm);
  const [editForm, setEditForm] = useState<FormData>(emptyForm);
  const [addError, setAddError] = useState('');

  const [adjNewQty, setAdjNewQty] = useState('');
  const [adjError, setAdjError] = useState('');

  const [catForm, setCatForm] = useState({ name: '', color: '#3b82f6' });
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<Item | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [archiveToast, setArchiveToast] = useState('');

  const reload = () => {
    setLoading(true);
    Promise.all([
      inventoryAPI.getAll({
        search,
        lowStock,
        categoryId: catFilter !== 'all' ? Number(catFilter) : null,
        ...(showArchived ? { archivedOnly: true } : { activeOnly: true }),
      }),
      categoryAPI.getAll(),
    ]).then(([inv, cats]) => { setInventory(inv); setCategories(cats); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [search, lowStock, catFilter, showArchived]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const result = await inventoryAPI.create({
      itemName: addForm.itemName, costPrice: parseFloat(addForm.costPrice), sellingPrice: parseFloat(addForm.sellingPrice),
      stockQuantity: parseInt(addForm.stockQuantity) || 0, barcode: addForm.barcode || undefined,
      categoryId: addForm.categoryId ? Number(addForm.categoryId) : null,
    });
    if (result.success) { setShowAdd(false); setAddForm(emptyForm); reload(); }
    else setAddError(result.error || 'Failed to create item');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await inventoryAPI.update(selected.item_id, {
      itemName: editForm.itemName, costPrice: parseFloat(editForm.costPrice), sellingPrice: parseFloat(editForm.sellingPrice),
      barcode: editForm.barcode || undefined, categoryId: editForm.categoryId ? Number(editForm.categoryId) : null,
    });
    setShowEdit(false);
    reload();
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const qty = parseInt(adjNewQty);
    if (isNaN(qty) || qty < 0) { setAdjError('Enter a valid stock total (≥ 0)'); return; }
    setAdjError('');
    await inventoryAPI.setStock(selected.item_id, qty);
    setShowAdjust(false);
    setAdjNewQty('');
    reload();
  };

  const handleSmartDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteProcessing(true);
    const result = await inventoryAPI.smartDelete(deleteConfirm.item_id);
    setDeleteProcessing(false);
    setDeleteConfirm(null);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.archived) {
      setArchiveToast(`"${deleteConfirm.item_name}" has been archived and hidden from the POS terminal. Its transaction history is preserved.`);
      setTimeout(() => setArchiveToast(''), 7000);
    }
    reload();
  };

  const openEdit = (item: Item) => {
    setSelected(item);
    setEditForm({ itemName: item.item_name, costPrice: String(item.cost_price), sellingPrice: String(item.selling_price), stockQuantity: String(item.stock_quantity), barcode: item.barcode || '', categoryId: item.category_id ? String(item.category_id) : '' });
    setShowEdit(true);
  };

  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editCat) {
      await categoryAPI.update(editCat.id, catForm.name, catForm.color);
    } else {
      const r = await categoryAPI.create(catForm.name, catForm.color);
      if (!r.success) { setErrorMsg(r.error || 'Failed to create category'); return; }
    }
    setCatForm({ name: '', color: '#3b82f6' });
    setEditCat(null);
    categoryAPI.getAll().then(setCategories);
  };

  const activeInventory = inventory.filter((i) => i.is_active !== false);
  const totalValue = inventory.reduce((s, i) => s + i.stock_quantity * i.selling_price, 0);

  return (
    <div>
      {/* Archive Toast */}
      {archiveToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full mx-4">
          <div className="bg-warning-900 text-white rounded-xl shadow-2xl px-5 py-4 flex items-start gap-3">
            <Archive className="w-5 h-5 mt-0.5 shrink-0 text-warning-300" />
            <div className="flex-1">
              <div className="font-semibold text-sm mb-0.5">Item Archived — Not Deleted</div>
              <div className="text-warning-200 text-xs leading-relaxed">{archiveToast}</div>
            </div>
            <button onClick={() => setArchiveToast('')} className="text-warning-400 hover:text-white ml-2"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Error</h2>
            <p className="text-gray-600 text-sm mb-5">{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="w-full py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 font-medium">OK</button>
          </div>
        </div>
      )}

      {/* Smart Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-1">Delete Item?</h2>
            <p className="text-gray-500 text-sm mb-1"><strong>{deleteConfirm.item_name}</strong></p>
            <p className="text-gray-400 text-xs mb-5">If this item has no sales history it will be permanently deleted. If it has transaction history it will be archived and hidden from the POS instead.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleteProcessing} className="flex-1 py-2.5 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button onClick={handleSmartDelete} disabled={deleteProcessing} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl font-bold hover:bg-danger-700 disabled:opacity-50">{deleteProcessing ? 'Processing…' : 'Delete / Archive'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">{inventory.length} items · {fmt(totalValue)} total retail value</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatMgr(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Tag className="w-4 h-4" /> Categories
          </button>
          <button onClick={() => { setAddForm(emptyForm); setAddError(''); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

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
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${showArchived ? 'bg-warning-100 border-warning-400 text-warning-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">{showArchived ? 'No archived items' : 'No items found'}</td></tr>
            ) : inventory.map((item) => (
              <tr key={item.item_id} className={`border-t transition-colors ${item.is_active === false ? 'bg-gray-50 opacity-60' : item.stock_quantity <= 0 ? 'bg-danger-50' : item.stock_quantity <= 10 ? 'bg-warning-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {item.item_name}
                  {item.is_active === false && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded uppercase tracking-wide">Archived</span>}
                </td>
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
                  {item.is_active !== false && (
                    <>
                      <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg mr-1 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => { setSelected(item); setAdjNewQty(String(item.stock_quantity)); setAdjError(''); setShowAdjust(true); }} className="px-2 py-1 text-xs bg-warning-100 text-warning-700 rounded-lg hover:bg-warning-200 font-medium mr-1">Stock</button>
                    </>
                  )}
                  <button onClick={() => setDeleteConfirm(item)} className="p-1.5 text-danger-400 hover:text-white hover:bg-danger-600 rounded-lg transition-colors" title={item.is_active === false ? 'Permanently Delete' : 'Delete / Archive'}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold">Add New Item</h2><button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            {addError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{addError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={labelCls}>Item Name *</label>
                <input type="text" className={inputCls} required autoFocus value={addForm.itemName} onChange={(e) => setAddForm((p) => ({ ...p, itemName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={addForm.categoryId} onChange={(e) => setAddForm((p) => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">No Category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Barcode (optional)</label>
                <input type="text" className={inputCls} value={addForm.barcode} onChange={(e) => setAddForm((p) => ({ ...p, barcode: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cost Price *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} required value={addForm.costPrice} onChange={(e) => setAddForm((p) => ({ ...p, costPrice: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Selling Price *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} required value={addForm.sellingPrice} onChange={(e) => setAddForm((p) => ({ ...p, sellingPrice: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Initial Stock</label>
                <input type="number" min="0" className={inputCls} value={addForm.stockQuantity} onChange={(e) => setAddForm((p) => ({ ...p, stockQuantity: e.target.value }))} />
              </div>
              {addForm.costPrice && addForm.sellingPrice && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  Profit per unit: <strong className="text-success-600">{fmt(parseFloat(addForm.sellingPrice || '0') - parseFloat(addForm.costPrice || '0'))}</strong>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold">Edit: {selected.item_name}</h2><button onClick={() => setShowEdit(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className={labelCls}>Item Name *</label>
                <input type="text" className={inputCls} required autoFocus value={editForm.itemName} onChange={(e) => setEditForm((p) => ({ ...p, itemName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={editForm.categoryId} onChange={(e) => setEditForm((p) => ({ ...p, categoryId: e.target.value }))}>
                  <option value="">No Category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Barcode (optional)</label>
                <input type="text" className={inputCls} value={editForm.barcode} onChange={(e) => setEditForm((p) => ({ ...p, barcode: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cost Price *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} required value={editForm.costPrice} onChange={(e) => setEditForm((p) => ({ ...p, costPrice: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Selling Price *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} required value={editForm.sellingPrice} onChange={(e) => setEditForm((p) => ({ ...p, sellingPrice: e.target.value }))} />
                </div>
              </div>
              {editForm.costPrice && editForm.sellingPrice && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  Profit per unit: <strong className="text-success-600">{fmt(parseFloat(editForm.sellingPrice || '0') - parseFloat(editForm.costPrice || '0'))}</strong>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Update Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Set Stock</h2><button onClick={() => setShowAdjust(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
              <div className="font-bold text-gray-900">{selected.item_name}</div>
              <div className="text-4xl font-extrabold mt-1 text-gray-800">{selected.stock_quantity}</div>
              <div className="text-xs text-gray-400">current units</div>
            </div>
            {adjError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-3">{adjError}</div>}
            <form onSubmit={handleAdjust} className="space-y-3">
              <div>
                <label className={labelCls}>New Stock Total</label>
                <input
                  type="number"
                  min="0"
                  value={adjNewQty}
                  onChange={(e) => { setAdjNewQty(e.target.value); setAdjError(''); }}
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-primary-400"
                  autoFocus
                  required
                />
                {adjNewQty !== '' && !isNaN(parseInt(adjNewQty)) && (
                  <div className={`mt-1 text-sm text-center ${parseInt(adjNewQty) !== selected.stock_quantity ? 'text-warning-700 font-semibold' : 'text-gray-400'}`}>
                    Change: {parseInt(adjNewQty) - selected.stock_quantity >= 0 ? '+' : ''}{parseInt(adjNewQty) - selected.stock_quantity} units
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdjust(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-semibold hover:bg-warning-600">Set Stock</button>
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
