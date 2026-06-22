import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Pencil, X, UserPlus, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';
import { studentAPI, feeTypeAPI, settingsAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; admission_type?: 'Returning' | 'New'; student_status?: 'Day' | 'Boarding'; }
interface FeeType { id: number; name: string; amount: number; fee_category: string; class_filter: string | null; academic_session: string; }

const DEFAULT_CLASSES = ['JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B', 'SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];
const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

const StudentManagement: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Day' | 'Boarding'>('all');

  const [classes, setClasses] = useState<string[]>(DEFAULT_CLASSES);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    studentId: '', name: '', studentClass: '', selectedFeeIds: [] as number[],
    admissionType: 'Returning' as 'Returning' | 'New', studentStatus: 'Day' as 'Day' | 'Boarding',
  });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const [editData, setEditData] = useState({ name: '', studentClass: '', studentStatus: 'Day' as 'Day' | 'Boarding' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => {
    setLoading(true);
    studentAPI.getAll({ search, class: selectedClass, studentStatus: statusFilter !== 'all' ? statusFilter : undefined, page, pageSize })
      .then((d) => { setStudents(d.students); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, selectedClass, statusFilter, page]);

  useEffect(() => {
    settingsAPI.get().then((s) => {
      if (s?.class_list) {
        try {
          const parsed = JSON.parse(s.class_list);
          if (Array.isArray(parsed) && parsed.length > 0) setClasses(parsed.sort());
        } catch { /* use default */ }
      }
    }).catch(console.error);
    feeTypeAPI.getAll().then((ft) => setFeeTypes(ft as FeeType[])).catch(console.error);
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const computeFeesOwed = () => formData.selectedFeeIds.reduce((sum, id) => {
    const ft = feeTypes.find((f) => f.id === id);
    return sum + (ft ? Number(ft.amount) : 0);
  }, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.studentClass) { setFormError('Name and class are required.'); return; }
    setFormSaving(true);
    setFormError('');
    const feesOwed = computeFeesOwed();
    const result = await studentAPI.create({
      studentId: formData.studentId || undefined,
      name: formData.name,
      studentClass: formData.studentClass,
      feesOwed,
      admissionType: formData.admissionType,
      studentStatus: formData.studentStatus,
    });
    if (result.success) {
      for (const feeId of formData.selectedFeeIds) {
        const ft = feeTypes.find((f) => f.id === feeId);
        if (ft) await feeTypeAPI.assignToStudents(feeId, Number(ft.amount), undefined, result.studentId, ft.fee_category as 'standard' | 'registration');
      }
      setShowModal(false);
      setFormData({ studentId: '', name: '', studentClass: '', selectedFeeIds: [], admissionType: 'Returning', studentStatus: 'Day' });
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

  const openDeleteConfirm = (s: Student) => { setSelectedStudent(s); setShowDeleteConfirm(true); };
  const handleDelete = async () => {
    if (!selectedStudent) return;
    await studentAPI.delete(selectedStudent.student_id);
    setShowDeleteConfirm(false);
    setSelectedStudent(null);
    load();
  };

  const openEditStudent = (s: Student) => {
    setSelectedStudent(s);
    setEditData({ name: s.name, studentClass: s.student_class, studentStatus: (s.student_status as 'Day' | 'Boarding') || 'Day' });
    setEditError('');
    setShowEditStudent(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!editData.name.trim() || !editData.studentClass) { setEditError('Name and class are required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await studentAPI.update(selectedStudent.student_id, { name: editData.name.trim(), studentClass: editData.studentClass, studentStatus: editData.studentStatus });
      setShowEditStudent(false);
      setSelectedStudent(null);
      load();
    } catch (e) { setEditError((e as Error).message); }
    setEditSaving(false);
  };

  const toggleFeeSelection = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedFeeIds: prev.selectedFeeIds.includes(id)
        ? prev.selectedFeeIds.filter((x) => x !== id)
        : [...prev.selectedFeeIds, id],
    }));
  };

  const filteredFeeTypes = feeTypes.filter((ft) =>
    !ft.class_filter || !formData.studentClass || ft.class_filter === formData.studentClass
  );

  const filteredStudents = students;
  const totalFees = students.reduce((sum, s) => sum + s.current_fees_owed, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <p className="text-gray-500">{total} students · ₦{totalFees.toLocaleString('en-NG', { minimumFractionDigits: 2 })} shown outstanding</p>
        </div>
        <button
          onClick={() => { setFormData({ studentId: '', name: '', studentClass: '', selectedFeeIds: [], admissionType: 'Returning', studentStatus: 'Day' }); setFormError(''); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
        >
          <UserPlus className="w-4 h-4" /> Add Student
        </button>
      </div>

      {(<>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-40 px-3 py-2 border rounded-md text-sm" placeholder="Search by name or ID..." />
          <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-md text-sm">
            <option value="all">All Classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            {(['all', 'Day', 'Boarding'] as const).map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type / Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fees Owed</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No students found</td></tr>
            ) : filteredStudents.map((s) => (
              <tr key={s.student_id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{s.student_id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs">{s.student_class}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs ${(s.admission_type || 'Returning') === 'Returning' ? 'bg-gray-100 text-gray-700' : 'bg-warning-100 text-warning-700'}`}>{s.admission_type || 'Returning'}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${(s.student_status || 'Day') === 'Boarding' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{s.student_status || 'Day'}</span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${s.current_fees_owed > 0 ? 'text-danger-600' : 'text-success-600'}`}>{fmt(s.current_fees_owed)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => viewHistory(s)} className="px-2 py-1 text-sm bg-gray-100 rounded mr-1 hover:bg-gray-200">History</button>
                  <button onClick={() => openEditStudent(s)} className="px-2 py-1 text-sm bg-primary-100 text-primary-700 rounded mr-1 hover:bg-primary-200 inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                  <button onClick={() => openDeleteConfirm(s)} className="px-2 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages} ({total} students)</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      </>)}

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add New Student</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className={inputCls} placeholder="Auto-generated as OIS-XXXX if empty" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Full Name <span className="text-danger-500">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class <span className="text-danger-500">*</span></label>
                <select value={formData.studentClass} onChange={(e) => setFormData({ ...formData, studentClass: e.target.value, selectedFeeIds: [] })} className={inputCls} required>
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
                <label className="block text-sm font-medium mb-1">Student Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData({ ...formData, studentStatus: 'Day' })} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.studentStatus === 'Day' ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>Day</button>
                  <button type="button" onClick={() => setFormData({ ...formData, studentStatus: 'Boarding' })} className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${formData.studentStatus === 'Boarding' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'}`}>Boarding</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Initial Fees to Apply</label>
                <p className="text-xs text-gray-400 mb-2">Select fee templates to apply to this student.</p>
                {feeTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No fee types found. Create fee types in Fees Management first.</p>
                ) : filteredFeeTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No fees available for the selected class.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-auto border border-gray-200 rounded-lg p-2">
                    {filteredFeeTypes.map((ft) => (
                      <label key={ft.id} className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all ${formData.selectedFeeIds.includes(ft.id) ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={formData.selectedFeeIds.includes(ft.id)} onChange={() => toggleFeeSelection(ft.id)} className="rounded" />
                          <div>
                            <div className="text-sm font-medium text-gray-800">{ft.name}</div>
                            {ft.class_filter && <div className="text-xs text-gray-400">{ft.class_filter}</div>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{fmt(Number(ft.amount))}</span>
                      </label>
                    ))}
                  </div>
                )}
                {formData.selectedFeeIds.length > 0 && (
                  <div className="mt-2 text-sm font-semibold text-primary-700">Total fees to apply: {fmt(computeFeesOwed())}</div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={formSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{formSaving ? 'Adding…' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditStudent && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Student</h2>
              <button onClick={() => setShowEditStudent(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm text-gray-500 font-mono">{selectedStudent.student_id}</div>
            {editError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{editError}</div>}
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name <span className="text-danger-500">*</span></label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className={inputCls} required autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Class <span className="text-danger-500">*</span></label>
                <select value={editData.studentClass} onChange={(e) => setEditData({ ...editData, studentClass: e.target.value })} className={inputCls} required>
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Student Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditData({ ...editData, studentStatus: 'Day' })} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editData.studentStatus === 'Day' ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>Day</button>
                  <button type="button" onClick={() => setEditData({ ...editData, studentStatus: 'Boarding' })} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editData.studentStatus === 'Boarding' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'}`}>Boarding</button>
                </div>
              </div>

              {/* Balance summary */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-sm text-gray-600 font-medium">Total Balance Owed</span>
                <span className={`text-lg font-bold ${selectedStudent.current_fees_owed > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                  {fmt(selectedStudent.current_fees_owed)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => { setShowEditStudent(false); onNavigate?.('fees'); }}
                className="w-full py-2.5 border-2 border-primary-500 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-50 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Manage Fees &amp; View Ledger
              </button>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEditStudent(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={editSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
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
                <p className="text-gray-500">{selectedStudent.name} — {selectedStudent.student_id}</p>
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
