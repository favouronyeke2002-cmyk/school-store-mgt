import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { studentAPI, inventoryAPI } from '../../lib/api';

type ImportType = 'students' | 'inventory';

const BulkImport: React.FC = () => {
  const [type, setType] = useState<ImportType>('students');
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setData([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) throw new Error('File must have header row and data');

        const headers = (rows[0] as string[]).map(h => h?.toString().toLowerCase().trim() || '');
        const parsed: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          const obj: any = {};

          headers.forEach((h, idx) => {
            const val = row[idx]?.toString().trim() || '';
            if (type === 'students') {
              if (h === 'student_id') obj.student_id = val;
              if (h === 'name') obj.name = val;
              if (h === 'class' || h === 'student_class') obj.student_class = val;
              if (h === 'fees' || h === 'fees_owed') obj.fees_owed = parseFloat(val) || 0;
            } else {
              if (h === 'item_name' || h === 'name') obj.item_name = val;
              if (h === 'barcode') obj.barcode = val || null;
              if (h === 'cost_price' || h === 'cost') obj.cost_price = parseFloat(val) || 0;
              if (h === 'selling_price' || h === 'price') obj.selling_price = parseFloat(val) || 0;
              if (h === 'stock_quantity' || h === 'stock' || h === 'quantity') obj.stock_quantity = parseInt(val) || 0;
            }
          });

          if (type === 'students' && obj.student_id) parsed.push(obj);
          else if (type === 'inventory' && obj.item_name) parsed.push(obj);
        }

        setData(parsed);
      } catch (err: any) {
        setError(err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const doImport = async () => {
    setLoading(true);
    try {
      const res = type === 'students'
        ? await studentAPI.bulkImport(data)
        : await inventoryAPI.bulkImport(data);
      setResult(res);
      if (res.success) {
        setData([]);
        if (fileInput.current) fileInput.current.value = '';
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    }
    setLoading(false);
  };

  const clearAll = () => {
    setData([]);
    setError('');
    setResult(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const studentTemplate = 'student_id,name,class,fees_owed\n0001,John Doe,JSS1A,15000\n0002,Jane Smith,JSS2B,25000';
  const inventoryTemplate = 'item_name,barcode,cost_price,selling_price,stock_quantity\nExercise Book,1234567890001,50,120,500\nPen,1234567890002,20,50,300';

  const downloadTemplate = () => {
    const template = type === 'students' ? studentTemplate : inventoryTemplate;
    const blob = new Blob([template], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}_template.csv`;
    a.click();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <p className="text-gray-500">Import students or inventory from CSV/Excel files</p>
      </div>

      {/* Type Selection */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4 mb-4">
          <button onClick={() => { setType('students'); clearAll(); }} className={`flex-1 py-4 rounded-lg font-medium ${type === 'students' ? 'bg-primary-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>Import Students</button>
          <button onClick={() => { setType('inventory'); clearAll(); }} className={`flex-1 py-4 rounded-lg font-medium ${type === 'inventory' ? 'bg-primary-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>Import Inventory</button>
        </div>
        <p className="text-sm text-gray-500">{type === 'students' ? 'Import student roster with name, class, and fees.' : 'Import inventory items with prices and stock quantities.'}</p>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-bold mb-4">Upload File</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
          <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-gray-600">Click to select CSV or Excel file</p>
          </label>
        </div>
        {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      </div>

      {/* Template */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">CSV Template</h2>
          <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300">Download Template</button>
        </div>
        <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto">{type === 'students' ? studentTemplate : inventoryTemplate}</pre>
      </div>

      {/* Preview */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Preview ({data.length} rows)</h2>
            <button onClick={clearAll} className="px-4 py-2 bg-danger-100 text-danger-700 rounded text-sm hover:bg-danger-200">Clear</button>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {type === 'students' ? (
                    <>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-right">Fees</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2 text-left">Barcode</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t">
                    {type === 'students' ? (
                      <>
                        <td className="px-3 py-2 font-mono">{row.student_id}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.student_class}</td>
                        <td className="px-3 py-2 text-right">₦{(row.fees_owed || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">{row.item_name}</td>
                        <td className="px-3 py-2 text-right">₦{(row.cost_price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">₦{(row.selling_price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">{row.stock_quantity}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.barcode || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 20 && <div className="text-center text-gray-400 py-4">... and {data.length - 20} more rows</div>}
          </div>
          <button onClick={doImport} disabled={loading} className="w-full mt-4 py-3 bg-success-600 text-white rounded-lg font-semibold hover:bg-success-700 disabled:opacity-50">{loading ? 'Importing...' : `Import ${data.length} ${type}`}</button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`bg-white rounded-lg shadow-sm p-6 ${result.success ? 'bg-success-50' : 'bg-danger-50'}`}>
          <div className="text-center">
            {result.success ? (
              <>
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <h3 className="text-xl font-bold text-success-700">Import Successful!</h3>
                <p className="text-success-600">{result.count} records imported.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <h3 className="text-xl font-bold text-danger-700">Import Failed</h3>
                <p className="text-danger-600">{result.error}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImport;
