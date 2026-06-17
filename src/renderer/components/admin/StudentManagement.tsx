import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Clock, Pencil, AlertTriangle, X } from 'lucide-react';
import { studentAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; admission_type?: 'Returning' | 'New'; }

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditFees, setShowEditFees] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [formData, setFormData] = useState({ studentId: '', name: '', studentClass: '', feesOwed: 0, admissionType: 'Returning' as 'Returning' | 'New' });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [editFeesValue, setEditFeesValue] = useState('');
  const [editFeesSaving, setEditFeesSaving] = useState(false);

  const load = () => {
    setLoading(true);
    studentAPI.getAll({ search, class: selectedClass, page, pageSize }).then((d) => { setStudents(d.students); setTotal(d.total); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, selectedClass, page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError('');
    const result = await studentAPI.create({ studentId: formData.studentId || undefined, name: formData.name, studentClass: formData.studentClass, feesOwed: formData.feesOwed, admissionType: formData.admissionType });
    if (result.success) {
      setShowModal(false);
      setFormData({ studentId: '', name: '', studentClass: '', feesOwed: 0, admissionType: 'Returning' });
      load();
    } else setFormError(result.error || 'Failed to create student');
    setFormSaving(false);
  };

  const viewHistory = async (s: Student) => {
    setSelectedStudent(s);
    const h = await studentAPI.getHistory(s.student_id);
    setHistory(h);
    setShowHistory(true);
  };

  const openDeleteConfirm = (s: Student) => {
    setSelectedStudent(s);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!selectedStudent) return;
    await studentAPI.delete(selectedStudent.student_id);
    setShowDeleteConfirm(false);
    setSelectedStudent(null);
    load();
  };

  const openEditFees = (s: Student) => {
    setSelectedStudent(s);
    setEditFeesValue(String(s.current_fees_owed));
    setShowEditFees(true);
  };

  const handleEditFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const fees = parseFloat(editFeesValue);
    if (isNaN(fees) || fees < 0) { setFormError('Invalid amount'); return; }
    setEditFeesSaving(true);
    await studentAPI.updateFees(selectedStudent.student_id, fees);
    setShowEditFees(false);
    setEditFeesSaving(false);
    load();
  };

  const classes = ['JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B', 'SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];
  const totalFees = students.reduce((sum, s) => sum + s.current_fees_owed, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <p className="text-gray-500">{total} students · ₦{totalFees.toLocaleString('en-NG', { minimumFractionDigits: 2 })} shown outstanding</p>
        </div>
        <button onClick={() => { setFormData({ studentId: '', name: '', studentClass: '', feesOwed: 0, admissionType: 'Returning' }); setFormError(''); setShowModal(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Add Student</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1 px-3 py-2 border rounded-md" placeholder="Search by name or ID..." />
          <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-md">
            <option value="all">All Classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fees Owed</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No students found</td></tr>
            ) : students.map((s) => (
              <tr key={s.student_id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{s.student_id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs">{s.student_class}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${(s.admission_type || 'Returning') === 'Returning' ? 'bg-gray-100 text-gray-700' : 'bg-warning-100 text-warning-700'}`}>{s.admission_type || 'Returning'}</span></td>
                <td className={`px-4 py-3 text-right font-semibold ${s.current_fees_owed > 0 ? 'text-danger-600' : 'text-success-600'}`}>{fmt(s.current_fees_owed)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => viewHistory(s)} className="px-2 py-1 text-sm bg-gray-200 rounded mr-1 hover:bg-gray-300">History</button>
                  <button onClick={() => openEditFees(s)} className="px-2 py-1 text-sm bg-warning-100 text-warning-700 rounded mr-1 hover:bg-warning-200">Edit Fees</button>
                  <button onClick={() => openDeleteConfirm(s)} className="px-2 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages} ({total} students)</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add New Student</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student ID (optional)</label>
                <input type="text" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Auto-generated if empty" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select value={formData.studentClass} onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required>
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admission Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData({ ...formData, admissionType: 'Returning' })} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.admissionType === 'Returning' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}>Returning</button>
                  <button type="button" onClick={() => setFormData({ ...formData, admissionType: 'New' })} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.admissionType === 'New' ? 'bg-warning-500 border-warning-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-warning-400'}`}>New</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Initial Fees Owed</label>
                <input type="number" value={formData.feesOwed} onChange={(e) => setFormData({ ...formData, feesOwed: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" min={0} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={formSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{formSaving ? 'Adding…' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fees Modal */}
      {showEditFees && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Edit Fees</h2>
              <button onClick={() => setShowEditFees(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="font-semibold text-gray-900">{selectedStudent.name}</div>
              <div className="text-sm text-gray-500">{selectedStudent.student_class} · {selectedStudent.student_id}</div>
            </div>
            <form onSubmit={handleEditFees} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">New Fees Owed</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">₦</span>
                  <input type="number" min="0" step="0.01" value={editFeesValue} onChange={(e) => setEditFeesValue(e.target.value)} className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEditFees(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={editFeesSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{editFeesSaving ? 'Saving…' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Delete Student?</h2>
            <p className="text-sm text-gray-500 mb-5">Delete <strong>{selectedStudent.name}</strong> ({selectedStudent.student_id})? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setSelectedStudent(null); }} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Transaction History</h2>
                <p className="text-gray-500">{selectedStudent.name} - {selectedStudent.student_id}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No transactions found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Items</th>
                    <th className="text-left px-3 py-2">Payment</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.transaction_id} className="border-t">
                      <td className="px-3 py-2">{new Date(h.timestamp).toLocaleDateString()}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-1 rounded text-xs ${h.type === 'STORE_PURCHASE' ? 'bg-primary-100 text-primary-700' : h.type === 'REGISTRATION_PAYMENT' ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'}`}>{h.type === 'STORE_PURCHASE' ? 'Store' : h.type === 'REGISTRATION_PAYMENT' ? 'Reg.' : 'Fees'}</span></td>
                      <td className="px-3 py-2 max-w-xs truncate">{h.items_summary || '-'}</td>
                      <td className="px-3 py-2">{h.payment_mode}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(Number(h.amount_paid))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold border-t-2">
                  <tr>
                    <td colSpan={4} className="px-3 py-2">Total:</td>
                    <td className="px-3 py-2 text-right">{fmt(history.reduce((s, h) => s + Number(h.amount_paid), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
