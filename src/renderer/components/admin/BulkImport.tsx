import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle, XCircle, FileText } from 'lucide-react';
import { studentAPI, inventoryAPI } from '../../lib/api';

type ImportType = 'students' | 'inventory';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const STUDENT_TEMPLATE = `student_id,name,class,fees_owed\nSTU-0011,John Doe,JSS1A,15000\nSTU-0012,Jane Smith,JSS2B,0`;
const INVENTORY_TEMPLATE = `item_name,barcode,cost_price,selling_price,stock_quantity\nExercise Book 80pg,1234567890099,50,120,200\nBallpoint Pen Blue,1234567890100,20,50,100`;

function parseFile(file: File, type: ImportType): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) throw new Error('File must have a header row and at least one data row');

        const headers = (rows[0] as any[]).map((h: any) => String(h || '').toLowerCase().trim());
        const parsed: any[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          if (!row.some((cell) => cell !== '' && cell !== undefined && cell !== null)) continue; // skip empty rows
          const obj: any = {};
          headers.forEach((h, idx) => {
            const raw = row[idx];
            const val = raw !== undefined && raw !== null ? String(raw).trim() : '';

            if (type === 'students') {
              if (h === 'student_id' || h === 'id') {
                // Normalize: add OIS- prefix if it's just a number
                const clean = val.startsWith('OIS-') ? val : val.startsWith('STU-') ? val.replace(/^STU-/, 'OIS-') : val ? `OIS-${val.padStart(3, '0')}` : '';
                obj.student_id = clean;
              }
              if (h === 'name') obj.name = val;
              if (h === 'class' || h === 'student_class') obj.student_class = val;
              if (h === 'fees' || h === 'fees_owed') obj.fees_owed = parseFloat(val) || 0;
            } else {
              if (h === 'item_name' || h === 'name') obj.item_name = val;
              if (h === 'barcode') obj.barcode = val || null;
              if (h === 'cost_price' || h === 'cost') obj.cost_price = parseFloat(val) || 0;
              if (h === 'selling_price' || h === 'price' || h === 'sell_price') obj.selling_price = parseFloat(val) || 0;
              if (h === 'stock_quantity' || h === 'stock' || h === 'quantity' || h === 'qty') obj.stock_quantity = parseInt(val) || 0;
            }
          });

          // Validate required fields
          if (type === 'students' && obj.student_id && obj.name && obj.student_class) parsed.push(obj);
          else if (type === 'inventory' && obj.item_name) parsed.push(obj);
        }

        resolve(parsed);
      } catch (err: any) {
        reject(new Error(err.message || 'Failed to parse file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

const BulkImport: React.FC = () => {
  const [type, setType] = useState<ImportType>('students');
  const [preview, setPreview] = useState<any[]>([]);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResult(null);
    setPreview([]);
    setFileName(file.name);
    try {
      const rows = await parseFile(file, type);
      if (rows.length === 0) setParseError('No valid rows found. Check your file matches the template format.');
      else setPreview(rows);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const doImport = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = type === 'students'
        ? await studentAPI.bulkImport(preview)
        : await inventoryAPI.bulkImport(preview);
      setResult(res);
      if (res.success) { setPreview([]); setFileName(''); if (fileInput.current) fileInput.current.value = ''; }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    }
    setLoading(false);
  };

  const clearAll = () => { setPreview([]); setParseError(''); setResult(null); setFileName(''); if (fileInput.current) fileInput.current.value = ''; };

  const downloadTemplate = () => {
    const csv = type === 'students' ? STUDENT_TEMPLATE : INVENTORY_TEMPLATE;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}_import_template.csv`;
    a.click();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Bulk Import</h1>
        <p className="text-gray-400 text-sm mt-0.5">Upload a CSV or Excel file to add/update students or inventory in bulk</p>
      </div>

      {/* Type Selector */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(['students', 'inventory'] as const).map((t) => (
          <button key={t} onClick={() => { setType(t); clearAll(); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${type === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Template Download */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 mb-1">Step 1: Download Template</h2>
            <p className="text-sm text-gray-500">Use this template to format your data. Required columns are shown below.</p>
            <pre className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 overflow-x-auto">{type === 'students' ? STUDENT_TEMPLATE : INVENTORY_TEMPLATE}</pre>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 shrink-0">
            <Download className="w-4 h-4" /> Template
          </button>
        </div>
        {type === 'students' && (
          <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 space-y-1">
            <div><strong>student_id</strong>: Required, e.g. STU-0011 (or just 0011 — prefix auto-added)</div>
            <div><strong>name</strong>: Required, student's full name</div>
            <div><strong>class</strong>: Required, e.g. JSS1A, SS2B</div>
            <div><strong>fees_owed</strong>: Optional, numeric amount e.g. 15000</div>
          </div>
        )}
        {type === 'inventory' && (
          <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 space-y-1">
            <div><strong>item_name</strong>: Required, product name</div>
            <div><strong>barcode</strong>: Optional, unique barcode (items without barcodes are always inserted)</div>
            <div><strong>cost_price</strong>: Required, purchase cost e.g. 50</div>
            <div><strong>selling_price</strong>: Required, selling price e.g. 120</div>
            <div><strong>stock_quantity</strong>: Optional, initial stock count</div>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-3">Step 2: Upload File</h2>
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${fileName ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}>
          <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <Upload className={`w-10 h-10 mb-3 ${fileName ? 'text-primary-500' : 'text-gray-300'}`} />
          {fileName ? (
            <div className="text-center">
              <div className="font-semibold text-primary-700 flex items-center gap-1"><FileText className="w-4 h-4" />{fileName}</div>
              <div className="text-sm text-gray-500 mt-1">Click to change file</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="font-medium text-gray-600">Click to upload CSV or Excel</div>
              <div className="text-sm text-gray-400 mt-1">.csv, .xlsx, .xls supported</div>
            </div>
          )}
        </label>
        {parseError && (
          <div className="mt-3 flex items-start gap-2 bg-danger-50 border border-danger-200 rounded-lg px-4 py-3 text-sm text-danger-700">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Step 3: Preview ({preview.length} rows ready to import)</h2>
            <button onClick={clearAll} className="text-sm text-danger-500 hover:text-danger-700">Clear</button>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  {type === 'students' ? (
                    <>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fees Owed</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Selling</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    {type === 'students' ? (
                      <>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.student_id}</td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{row.student_class}</span></td>
                        <td className="px-3 py-2 text-right">{fmt(row.fees_owed || 0)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium">{row.item_name}</td>
                        <td className="px-3 py-2 text-right">{fmt(row.cost_price || 0)}</td>
                        <td className="px-3 py-2 text-right text-primary-600 font-semibold">{fmt(row.selling_price || 0)}</td>
                        <td className="px-3 py-2 text-right">{row.stock_quantity || 0}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-400">{row.barcode || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && <div className="text-center text-gray-400 text-sm py-3">Showing first 50 of {preview.length} rows</div>}
          </div>
          <div className="px-5 py-4 bg-gray-50 border-t">
            <button onClick={doImport} disabled={loading} className="w-full py-3 bg-success-600 text-white rounded-xl font-bold hover:bg-success-700 disabled:opacity-50 text-base">
              {loading ? 'Importing…' : `Import ${preview.length} ${type === 'students' ? 'Students' : 'Inventory Items'}`}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`bg-white rounded-xl border shadow-sm p-6 text-center ${result.success ? 'border-success-200' : 'border-danger-200'}`}>
          {result.success ? (
            <>
              <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-success-700">Import Successful!</h3>
              <p className="text-success-600 mt-1">{result.count} records imported or updated.</p>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-danger-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-danger-700">Import Failed</h3>
              <p className="text-danger-600 mt-1 text-sm">{result.error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkImport;
