import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../lib/api';

interface InventoryItem { item_id: number; item_name: string; cost_price: number; selling_price: number; stock_quantity: number; barcode: string | null; }

const InventoryManagement: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({ itemName: '', costPrice: '', sellingPrice: '', stockQuantity: '', barcode: '' });

  useEffect(() => {
    setLoading(true);
    inventoryAPI.getAll({ search, lowStock }).then(setInventory).catch(console.error).finally(() => setLoading(false));
  }, [search, lowStock]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await inventoryAPI.create({ itemName: formData.itemName, costPrice: parseFloat(formData.costPrice), sellingPrice: parseFloat(formData.sellingPrice), stockQuantity: parseInt(formData.stockQuantity) || 0, barcode: formData.barcode || undefined });
    if (result.success) {
      setShowAdd(false);
      setFormData({ itemName: '', costPrice: '', sellingPrice: '', stockQuantity: '', barcode: '' });
      inventoryAPI.getAll({ search, lowStock }).then(setInventory);
    } else alert(result.error);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await inventoryAPI.update(selected.item_id, { itemName: formData.itemName, costPrice: parseFloat(formData.costPrice), sellingPrice: parseFloat(formData.sellingPrice), barcode: formData.barcode || undefined });
    setShowEdit(false);
    inventoryAPI.getAll({ search, lowStock }).then(setInventory);
  };

  const handleAdjust = async () => {
    if (!selected) return;
    const val = prompt('Enter quantity change (+/-):');
    if (!val) return;
    const qty = parseInt(val);
    if (isNaN(qty)) { alert('Invalid quantity'); return; }
    const reason = prompt('Reason for adjustment:');
    if (!reason) return;
    await inventoryAPI.adjustStock(selected.item_id, qty, reason);
    setShowAdjust(false);
    inventoryAPI.getAll({ search, lowStock }).then(setInventory);
  };

  const openEdit = (item: InventoryItem) => {
    setSelected(item);
    setFormData({ itemName: item.item_name, costPrice: String(item.cost_price), sellingPrice: String(item.selling_price), stockQuantity: String(item.stock_quantity), barcode: item.barcode || '' });
    setShowEdit(true);
  };

  const openAdjust = (item: InventoryItem) => {
    setSelected(item);
    setShowAdjust(true);
  };

  const totalValue = inventory.reduce((s, i) => s + i.stock_quantity * i.selling_price, 0);
  const totalItems = inventory.reduce((s, i) => s + i.stock_quantity, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-gray-500">{inventory.length} items · ₦{totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })} total value</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Add Item</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Items', value: inventory.length },
          { label: 'Total Units', value: totalItems.toLocaleString() },
          { label: 'Inventory Value', value: `₦${totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` },
          { label: 'Low Stock', value: inventory.filter(i => i.stock_quantity <= 10).length },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-500">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-md" placeholder="Search items or barcode..." />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="rounded" />
            <span className="text-sm">Show low stock only</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Item Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Barcode</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Selling Price</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Profit/Unit</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No items found</td></tr>
            ) : inventory.map((item) => (
              <tr key={item.item_id} className={`border-t ${item.stock_quantity <= 10 ? 'bg-danger-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{item.item_name}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">{item.barcode || <span className="italic">N/A</span>}</td>
                <td className="px-4 py-3 text-right">₦{item.cost_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary-600">₦{item.selling_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                <td className={`px-4 py-3 text-right font-semibold ${item.stock_quantity <= 10 ? 'text-danger-600' : ''}`}>{item.stock_quantity}</td>
                <td className="px-4 py-3 text-right text-success-600">₦{(item.selling_price - item.cost_price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(item)} className="px-2 py-1 text-sm bg-gray-200 rounded mr-1 hover:bg-gray-300">Edit</button>
                  <button onClick={() => openAdjust(item)} className="px-2 py-1 text-sm bg-warning-100 text-warning-700 rounded hover:bg-warning-200">Stock</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Add New Item</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Item Name</label><input type="text" value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} className="w-full px-3 py-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium mb-1">Barcode (optional)</label><input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Cost Price</label><input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} className="w-full px-3 py-2 border rounded-md" min={0} required /></div>
                  <div><label className="block text-sm font-medium mb-1">Selling Price</label><input type="number" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} className="w-full px-3 py-2 border rounded-md" min={0} required /></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Initial Stock</label><input type="number" value={formData.stockQuantity} onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })} className="w-full px-3 py-2 border rounded-md" min={0} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Edit Item</h2>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Item Name</label><input type="text" value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} className="w-full px-3 py-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium mb-1">Barcode</label><input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full px-3 py-2 border rounded-md" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Cost Price</label><input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} className="w-full px-3 py-2 border rounded-md" min={0} required /></div>
                  <div><label className="block text-sm font-medium mb-1">Selling Price</label><input type="number" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} className="w-full px-3 py-2 border rounded-md" min={0} required /></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">Current Stock: <strong>{selected.stock_quantity}</strong> (use Stock Adjustment to change)</div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjust && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Adjust Stock</h2>
            <p className="text-gray-600 mb-4">{selected.item_name}</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-500">Current Stock</div>
              <div className="text-3xl font-bold">{selected.stock_quantity}</div>
            </div>
            <button onClick={handleAdjust} className="w-full py-2 bg-warning-500 text-white rounded mb-2 hover:bg-warning-600">Adjust Quantity</button>
            <button onClick={() => setShowAdjust(false)} className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
