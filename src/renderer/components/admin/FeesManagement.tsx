import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, Users, Tag, X, AlertCircle, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { feeTypeAPI, studentFeeAPI, studentAPI, settingsAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FeeType { id: number; name: string; description: string | null; academic_session: string; amount: number; class_filter: string | null; fee_category: string; applicable_to?: string; }
interface StudentFee { id: number; student_id: string; student_name: string; student_class: string; admission_type: string; fee_name: string; fee_category: string; academic_session: string; amount_due: number; amount_paid: number; balance: number; }

const FeesManagement: React.FC = () => {
  const [tab, setTab] = useState<'types' | 'ledger'>('types');
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [ledger, setLedger] = useState<StudentFee[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState('2025/2026');
  const [currentTerm, setCurrentTerm] = useState('1st Term');
  const [sessionFilter, setSessionFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create fee type form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard' as 'standard' | 'registration', applicableTo: 'All Students' });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit fee type
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<FeeType | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard' as 'standard' | 'registration', applicableTo: 'All Students' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Assign dialog
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState<FeeType | null>(null);
  const [assignClass, setAssignClass] = useState('');
  const [assignSpecific, setAssignSpecific] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignResult, setAssignResult] = useState('');

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeeType | null>(null);

  // Ledger pagination
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPageSize = 15;

  // Ledger filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerClass, setLedgerClass] = useState('all');
  const [ledgerStatus, setLedgerStatus] = useState<'all' | 'outstanding' | 'paid'>('all');

  useEffect(() => {
    load();
    studentAPI.getClasses().then(setClasses).catch(console.error);
    settingsAPI.get().then((s) => { if (s?.academic_session) { setCurrentSession(s.academic_session); setSessionFilter(s.academic_session); } if (s?.current_term) { setCurrentTerm(s.current_term); setTermFilter(s.current_term); } }).catch(console.error);
  }, []);

  const load = () => {
    setLoading(true);
    Promise.all([
      feeTypeAPI.getAll(),
      studentFeeAPI.getAll(),
    ]).then(([ft, sf]) => {
      setFeeTypes(ft);
      setLedger(sf);
    }).catch(console.error).finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.amount) { setFormError('Name and amount are required.'); return; }
    setFormSaving(true);
    setFormError('');
    const result = await feeTypeAPI.create({
      name: form.name,
      description: form.description || undefined,
      academicSession: currentSession,
      amount: parseFloat(form.amount),
      classFilter: form.classFilter || undefined,
      feeCategory: form.feeCategory,
      applicableTo: form.applicableTo,
    });
    if (result.success) {
      // Auto-assign: if class filter set, assign to that class; if no filter, assign to all returning students
      if (result.id) {
        await feeTypeAPI.assignToStudents(result.id, parseFloat(form.amount), form.classFilter || undefined, undefined, form.feeCategory);
      }
      setForm({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard', applicableTo: 'All Students' });
      setShowCreate(false);
      load();
    } else {
      setFormError(result.error || 'Failed to create fee type');
    }
    setFormSaving(false);
  };

  const openEdit = (ft: FeeType) => {
    setEditTarget(ft);
    setEditForm({ name: ft.name, description: ft.description || '', amount: String(ft.amount), classFilter: ft.class_filter || '', feeCategory: (ft.fee_category as 'standard' | 'registration') || 'standard', applicableTo: ft.applicable_to || 'All Students' });
    setEditError('');
    setShowEdit(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.name || !editForm.amount) { setEditError('Name and amount are required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      await feeTypeAPI.update(editTarget.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        amount: parseFloat(editForm.amount),
        classFilter: editForm.classFilter || undefined,
        feeCategory: editForm.feeCategory,
        applicableTo: editForm.applicableTo,
      });
      setShowEdit(false);
      setEditTarget(null);
      load();
    } catch (e) {
      setEditError((e as Error).message);
    }
    setEditSaving(false);
  };

  const handleAssign = async () => {
    if (!assignTarget) return;
    if (!assignClass && !assignSpecific) { setAssignError('Select a class or enter a student ID.'); return; }
    setAssigning(true);
    setAssignError('');
    setAssignResult('');
    const result = await feeTypeAPI.assignToStudents(assignTarget.id, assignTarget.amount, assignClass || undefined, assignSpecific || undefined, assignTarget.fee_category as 'standard' | 'registration');
    if (result.success) {
      setAssignResult(`Assigned to ${result.count} student(s).`);
      load();
    } else {
      setAssignError(result.error || 'Failed to assign');
    }
    setAssigning(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await feeTypeAPI.delete(deleteTarget.id);
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    load();
  };

  const openAssign = (ft: FeeType) => { setAssignTarget(ft); setAssignClass(ft.class_filter || ''); setAssignSpecific(''); setAssignError(''); setAssignResult(''); setShowAssign(true); };

  const filteredLedger = ledger.filter((sf) => {
    if (ledgerClass !== 'all' && sf.student_class !== ledgerClass) return false;
    if (ledgerStatus === 'outstanding' && sf.balance <= 0) return false;
    if (ledgerStatus === 'paid' && sf.balance > 0) return false;
    if (sessionFilter && sf.academic_session !== sessionFilter) return false;
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      return sf.student_name?.toLowerCase().includes(q) || sf.student_id?.toLowerCase().includes(q) || sf.fee_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalOutstanding = filteredLedger.filter((sf) => sf.balance > 0).reduce((s, sf) => s + sf.balance, 0);
  const paginatedLedger = filteredLedger.slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize);
  const ledgerTotalPages = Math.ceil(filteredLedger.length / ledgerPageSize);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Fees Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Session: {currentSession}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {['', '1st Term', '2nd Term', '3rd Term'].map((t) => (
              <button key={t} onClick={() => setTermFilter(t)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${termFilter === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === '' ? 'All Terms' : t}
              </button>
            ))}
          </div>
          <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="">All Sessions</option>
            {[...new Set([currentSession, ...feeTypes.map((f) => f.academic_session)])].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={() => { setForm({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard' }); setFormError(''); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
            <Plus className="w-4 h-4" /> New Fee Type
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5 w-fit">
        {(['types', 'ledger'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'types' ? 'Fee Types' : 'Student Ledger'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : tab === 'types' ? (
        /* ── Fee Types ──────────────────────────────────────────────── */
        <div className="space-y-3">
          {feeTypes.filter((f) => !sessionFilter || f.academic_session === sessionFilter).length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No fee types yet</p>
              <p className="text-sm mt-1">Create a fee type like "1st Term Fees" or "PTA Levy" to get started</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">Create First Fee Type</button>
            </div>
          ) : feeTypes.filter((f) => !sessionFilter || f.academic_session === sessionFilter).map((ft) => {
            const assignments = ledger.filter((sf) => sf.fee_name === ft.name && sf.academic_session === ft.academic_session);
            const collected = assignments.reduce((s, sf) => s + sf.amount_paid, 0);
            const outstanding = assignments.reduce((s, sf) => s + sf.balance, 0);
            return (
              <div key={ft.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{ft.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{ft.academic_session}</span>
                      {ft.class_filter && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{ft.class_filter}</span>}
                      {ft.fee_category === 'registration' && <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full">Registration</span>}
                    </div>
                    {ft.description && <p className="text-sm text-gray-500 mb-2">{ft.description}</p>}
                    <div className="flex items-center gap-4 text-sm">
                      <span><span className="text-gray-400">Amount:</span> <span className="font-bold text-gray-900">{fmt(ft.amount)}</span></span>
                      <span><span className="text-gray-400">Assigned:</span> <span className="font-semibold">{assignments.length} students</span></span>
                      <span><span className="text-gray-400">Collected:</span> <span className="font-semibold text-success-600">{fmt(collected)}</span></span>
                      <span><span className="text-gray-400">Outstanding:</span> <span className={`font-semibold ${outstanding > 0 ? 'text-danger-600' : 'text-success-600'}`}>{fmt(outstanding)}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(ft)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100 font-medium">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => openAssign(ft)} className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm hover:bg-primary-100 font-medium">
                      <Users className="w-3.5 h-3.5" /> Assign
                    </button>
                    <button onClick={() => { setDeleteTarget(ft); setShowDeleteConfirm(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-danger-50 text-danger-600 rounded-lg text-sm hover:bg-danger-100 font-medium">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Student Ledger ─────────────────────────────────────────── */
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <input type="text" value={ledgerSearch} onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }} placeholder="Search student or fee…" className="flex-1 min-w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            <select value={ledgerClass} onChange={(e) => { setLedgerClass(e.target.value); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={ledgerStatus} onChange={(e) => { setLedgerStatus(e.target.value as any); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Status</option>
              <option value="outstanding">Outstanding</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>

          {filteredLedger.length > 0 && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger-500 shrink-0" />
              <span className="text-sm text-danger-700">Total Outstanding: <strong>{fmt(totalOutstanding)}</strong> across {filteredLedger.filter((s) => s.balance > 0).length} records</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Student', 'Class', 'Fee', 'Session', 'Amount Due', 'Paid', 'Balance', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLedger.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No records match your filters</td></tr>
                ) : paginatedLedger.map((sf) => (
                  <tr key={sf.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sf.student_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{sf.student_id}</div>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{sf.student_class}</span></td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{sf.fee_name}</div>
                      {sf.fee_category === 'registration' && <span className="text-[10px] bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded">Reg</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{sf.academic_session}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(sf.amount_due)}</td>
                    <td className="px-4 py-3 text-success-600 font-semibold">{fmt(sf.amount_paid)}</td>
                    <td className={`px-4 py-3 font-bold ${sf.balance > 0 ? 'text-danger-600' : 'text-success-600'}`}>{fmt(sf.balance)}</td>
                    <td className="px-4 py-3">
                      {sf.balance <= 0 ? (
                        <span className="flex items-center gap-1 text-success-600 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>
                      ) : (
                        <span className="flex items-center gap-1 text-danger-600 text-xs font-bold"><AlertCircle className="w-3.5 h-3.5" /> Owing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ledger Pagination */}
          {ledgerTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setLedgerPage((p) => Math.max(1, p - 1))} disabled={ledgerPage <= 1} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-gray-500 font-medium">Page {ledgerPage} of {ledgerTotalPages}</span>
              <button onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))} disabled={ledgerPage >= ledgerTotalPages} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      {/* Create Fee Type Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create Fee Type</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {formError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Fee Name <span className="text-danger-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Term School Fees" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (₦) <span className="text-danger-500">*</span></label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Target Class (optional)</label>
                <p className="text-xs text-gray-400 mb-1">If set, auto-assigns to Returning students in this class. Leave empty for all Returning students.</p>
                <select value={form.classFilter} onChange={(e) => setForm((p) => ({ ...p, classFilter: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Students</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Fee Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm((p) => ({ ...p, feeCategory: 'standard' }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${form.feeCategory === 'standard' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'}`}>Standard</button>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, feeCategory: 'registration' }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${form.feeCategory === 'registration' ? 'bg-warning-500 border-warning-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-warning-400'}`}>Registration</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Applicable To</label>
                <div className="grid grid-cols-3 gap-2">
                  {['All Students', 'Day', 'Boarding'].map((opt) => (
                    <button key={opt} type="button" onClick={() => setForm((p) => ({ ...p, applicableTo: opt }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${form.applicableTo === opt ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={formSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                  {formSaving ? 'Creating…' : 'Create & Auto-Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fee Type Modal */}
      {showEdit && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Edit Fee Type</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {editError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{editError}</div>}
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Fee Name <span className="text-danger-500">*</span></label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <input type="text" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Amount (₦) <span className="text-danger-500">*</span></label>
                <input type="number" min="0" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Target Class</label>
                <select value={editForm.classFilter} onChange={(e) => setEditForm((p) => ({ ...p, classFilter: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Students</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Fee Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditForm((p) => ({ ...p, feeCategory: 'standard' }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editForm.feeCategory === 'standard' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>Standard</button>
                  <button type="button" onClick={() => setEditForm((p) => ({ ...p, feeCategory: 'registration' }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editForm.feeCategory === 'registration' ? 'bg-warning-500 border-warning-500 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>Registration</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Applicable To</label>
                <div className="grid grid-cols-3 gap-2">
                  {['All Students', 'Day', 'Boarding'].map((opt) => (
                    <button key={opt} type="button" onClick={() => setEditForm((p) => ({ ...p, applicableTo: opt }))} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${editForm.applicableTo === opt ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={editSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && assignTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Assign Fee</h2>
              <button onClick={() => setShowAssign(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="font-semibold text-gray-900">{assignTarget.name}</div>
              <div className="text-sm text-gray-500">{fmt(assignTarget.amount)} · {assignTarget.academic_session}</div>
            </div>
            {assignError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{assignError}</div>}
            {assignResult && <div className="bg-success-50 text-success-700 text-sm rounded-lg px-4 py-2 mb-4">{assignResult}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Assign to Class</label>
                <select value={assignClass} onChange={(e) => setAssignClass(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Returning Students</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="text-center text-xs text-gray-400">— or —</div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Specific Student ID</label>
                <input type="text" value={assignSpecific} onChange={(e) => setAssignSpecific(e.target.value)} placeholder="e.g. STU-0001" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAssign(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleAssign} disabled={assigning} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Delete Fee Type?</h2>
            <p className="text-sm text-gray-500 mb-5">Delete <strong>{deleteTarget.name}</strong> and all student assignments? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesManagement;
