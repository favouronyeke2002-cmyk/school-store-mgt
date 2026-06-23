import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, ChevronRight, ChevronLeft, Users, Tag, X, AlertCircle, CheckCircle, Pencil, Trash2, BarChart2, Search, Receipt, FileText, GraduationCap, RefreshCw } from 'lucide-react';
import { feeTypeAPI, studentFeeAPI, studentAPI, settingsAPI } from '../../lib/api';
import StudentTimeline from './StudentTimeline';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FeeType { id: number; name: string; description: string | null; academic_session: string; term: string | null; amount: number; class_filter: string | null; fee_category: string; applicable_to?: string; }
interface StudentFee { id: number; student_id: string; student_name: string; student_class: string; admission_type: string; student_status: string; fee_name: string; fee_category: string; academic_session: string; amount_due: number; amount_paid: number; balance: number; }

interface Props { focusStudentId?: string | null; }

const FeesManagement: React.FC<Props> = ({ focusStudentId }) => {
  const [tab, setTab] = useState<'types' | 'ledger'>('types');
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [ledger, setLedger] = useState<StudentFee[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState('2025/2026');
  const [currentTerm, setCurrentTerm] = useState('First Term');
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
  const ledgerPageSize = 20;

  // Ledger filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerClass, setLedgerClass] = useState('all');
  const [ledgerStatus, setLedgerStatus] = useState<'all' | 'outstanding' | 'paid'>('all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'Day' | 'Boarding'>('all');

  // Manage Fees modal (per ledger row)
  const [showManageFees, setShowManageFees] = useState(false);
  const [manageFeeStudent, setManageFeeStudent] = useState<{ student_id: string; student_name: string; student_class: string } | null>(null);
  const [manageFeeSelected, setManageFeeSelected] = useState<number[]>([]);
  const [manageFeesSaving, setManageFeesSaving] = useState(false);
  const [manageFeesError, setManageFeesError] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [manageFeeAssigned, setManageFeeAssigned] = useState<any[]>([]);
  const [manageFeeAssignedLoading, setManageFeeAssignedLoading] = useState(false);

  // Timeline (per-student financial history)
  const [timelineStudent, setTimelineStudent] = useState<{ student_id: string; student_name: string; student_class: string } | null>(null);
  const focusApplied = useRef(false);

  // Recalibrate balances
  const [showRecalibrate, setShowRecalibrate] = useState(false);
  const [recalibrateRunning, setRecalibrateRunning] = useState(false);
  const [recalibrateResult, setRecalibrateResult] = useState<{ updated: number; orphansRemoved: number } | null>(null);

  useEffect(() => {
    load();
    studentAPI.getClasses().then(setClasses).catch(console.error);
    settingsAPI.get().then((s) => { if (s?.academic_session) { setCurrentSession(s.academic_session); setSessionFilter(s.academic_session); } if (s?.current_term) { setCurrentTerm(s.current_term); setTermFilter(s.current_term); } }).catch(console.error);
  }, []);

  // When navigated from StudentManagement with a focusStudentId, switch to ledger + open timeline
  useEffect(() => {
    if (focusStudentId && !focusApplied.current) {
      focusApplied.current = true;
      setTab('ledger');
      setLedgerSearch(focusStudentId);
    }
  }, [focusStudentId]);

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
    const amount = parseFloat(form.amount);
    const classFilter = form.classFilter;
    const applicableTo = form.applicableTo;
    try {
      const result = await feeTypeAPI.create({
        name: form.name,
        description: form.description || undefined,
        academicSession: currentSession,
        term: currentTerm || undefined,
        amount,
        classFilter: classFilter || undefined,
        feeCategory: 'standard',
        applicableTo,
      });
      if (result.success) {
        setShowCreate(false);
        setTermFilter('');
        setForm({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard', applicableTo: 'All Students' });
        load();
        if (result.id) {
          feeTypeAPI.assignToStudents(result.id, amount, classFilter || undefined, undefined, 'standard', applicableTo !== 'All Students' ? applicableTo : undefined)
            .then(() => load())
            .catch(console.error);
        }
      } else {
        setFormError(result.error || 'Failed to create fee type');
      }
    } catch (err) {
      setFormError((err as Error).message);
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
    const applicableTo = assignTarget.applicable_to === 'Day' || assignTarget.applicable_to === 'Day Only' ? 'Day'
      : assignTarget.applicable_to === 'Boarding' || assignTarget.applicable_to === 'Boarding Only' ? 'Boarding'
      : assignTarget.applicable_to === 'Remedial' ? undefined  // Remedial: target by class_filter, not student_status
      : undefined;
    const result = await feeTypeAPI.assignToStudents(assignTarget.id, assignTarget.amount, assignClass || undefined, assignSpecific || undefined, assignTarget.fee_category as 'standard' | 'registration', applicableTo);
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
    const result = await feeTypeAPI.cascadeDelete(deleteTarget.id);
    if (!result.success) { alert('Delete failed: ' + result.error); return; }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    load();
  };

  const openTimeline = (s: { student_id: string; student_name: string; student_class: string }) => {
    setOpenActionMenu(null);
    setTimelineStudent(s);
  };

  const runRecalibrate = async () => {
    setRecalibrateRunning(true);
    setRecalibrateResult(null);
    try {
      const result = await studentFeeAPI.recalibrateAllBalances();
      setRecalibrateResult(result);
      load();
    } catch (e) {
      alert('Recalibration failed: ' + (e as Error).message);
    }
    setRecalibrateRunning(false);
  };

  const openAssign = (ft: FeeType) => { setAssignTarget(ft); setAssignClass(ft.class_filter || ''); setAssignSpecific(''); setAssignError(''); setAssignResult(''); setShowAssign(true); };

  const openManageFees = async (s: { student_id: string; student_name: string; student_class: string }) => {
    setManageFeeStudent(s);
    setManageFeeSelected([]);
    setManageFeesError('');
    setManageFeeAssigned([]);
    setManageFeeAssignedLoading(true);
    setShowManageFees(true);
    setOpenActionMenu(null);
    try {
      const all = await studentFeeAPI.getForStudent(s.student_id);
      setManageFeeAssigned(all.filter((sf: any) => !sessionFilter || sf.academic_session === sessionFilter));
    } catch { /* best-effort */ }
    setManageFeeAssignedLoading(false);
  };

  const saveManageFees = async () => {
    if (!manageFeeStudent || manageFeeSelected.length === 0) { setManageFeesError('Select at least one fee template to assign.'); return; }
    setManageFeesSaving(true);
    setManageFeesError('');
    try {
      for (const feeId of manageFeeSelected) {
        const ft = feeTypes.find((f) => f.id === feeId);
        if (ft) await feeTypeAPI.assignToStudents(feeId, ft.amount, undefined, manageFeeStudent.student_id, ft.fee_category as 'standard' | 'registration');
      }
      // Reload assigned section
      const updated = await studentFeeAPI.getForStudent(manageFeeStudent.student_id);
      setManageFeeAssigned(updated.filter((sf: any) => !sessionFilter || sf.academic_session === sessionFilter));
      setManageFeeSelected([]);
      load();
    } catch (e) { setManageFeesError((e as Error).message); }
    setManageFeesSaving(false);
  };

  const removeAssignedFee = async (sf: any) => {
    if (!manageFeeStudent) return;
    setManageFeesSaving(true);
    setManageFeesError('');
    try {
      const balance = Number(sf.amount_due) - Number(sf.amount_paid);
      await studentFeeAPI.remove(sf.id, manageFeeStudent.student_id, balance);
      const updated = await studentFeeAPI.getForStudent(manageFeeStudent.student_id);
      setManageFeeAssigned(updated.filter((f: any) => !sessionFilter || f.academic_session === sessionFilter));
      load();
    } catch (e) { setManageFeesError((e as Error).message); }
    setManageFeesSaving(false);
  };

  const toggleManageFee = (id: number) => setManageFeeSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // Per-student aggregation for the Student Ledger
  const perStudentLedger = (() => {
    const map = new Map<string, {
      student_id: string; student_name: string; student_class: string; student_status: string;
      arrearsForward: number; currentTermBill: number; currentTermPaid: number; totalPaid: number; netBalance: number;
    }>();
    for (const sf of ledger) {
      if (!map.has(sf.student_id)) {
        map.set(sf.student_id, { student_id: sf.student_id, student_name: sf.student_name || '', student_class: sf.student_class || '', student_status: sf.student_status || 'Day', arrearsForward: 0, currentTermBill: 0, currentTermPaid: 0, totalPaid: 0, netBalance: 0 });
      }
      const entry = map.get(sf.student_id)!;
      const isCurrent = currentSession && sf.academic_session === currentSession;
      if (isCurrent) { entry.currentTermBill += Number(sf.amount_due); entry.currentTermPaid += Number(sf.amount_paid); }
      else { entry.arrearsForward += Math.max(0, Number(sf.balance)); }
      entry.totalPaid += Number(sf.amount_paid);
      entry.netBalance += Number(sf.balance);
    }
    return Array.from(map.values()).sort((a, b) => a.student_name.localeCompare(b.student_name));
  })();

  const filteredLedger = perStudentLedger.filter((s) => {
    if (ledgerClass !== 'all' && s.student_class !== ledgerClass) return false;
    if (ledgerTypeFilter !== 'all' && s.student_status !== ledgerTypeFilter) return false;
    if (ledgerStatus === 'outstanding' && s.netBalance <= 0) return false;
    if (ledgerStatus === 'paid' && s.netBalance > 0) return false;
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      return s.student_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalOutstanding = filteredLedger.filter((s) => s.netBalance > 0).reduce((sum, s) => sum + s.netBalance, 0);
  const totalExpectedRevenue = filteredLedger.reduce((sum, s) => sum + s.totalPaid + Math.max(0, s.netBalance), 0);
  const totalCollected = filteredLedger.reduce((sum, s) => sum + s.totalPaid, 0);
  const paginatedLedger = filteredLedger.slice((ledgerPage - 1) * ledgerPageSize, ledgerPage * ledgerPageSize);
  const ledgerTotalPages = Math.ceil(filteredLedger.length / ledgerPageSize);

  const isBlankSearch = ledgerSearch.trim() === '';
  const isSingleStudent = !isBlankSearch && filteredLedger.length === 1;
  const focusStudent = isSingleStudent ? filteredLedger[0] : null;
  const focusStudentFees = focusStudent ? ledger.filter((sf) => sf.student_id === focusStudent.student_id) : [];

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
            {['', 'First Term', 'Second Term', 'Third Term'].map((t) => (
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
          <button
            onClick={() => { setRecalibrateResult(null); setShowRecalibrate(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-warning-50 text-warning-700 border border-warning-200 rounded-lg text-sm font-semibold hover:bg-warning-100"
            title="Purge orphaned fee records and recalculate all student balances from scratch"
          >
            <RefreshCw className="w-4 h-4" /> Recalibrate Balances
          </button>
          <button onClick={() => { setForm({ name: '', description: '', amount: '', classFilter: '', feeCategory: 'standard', applicableTo: 'All Students' }); setFormError(''); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
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
          {feeTypes.filter((f) => {
            if (sessionFilter && f.academic_session !== sessionFilter) return false;
            if (termFilter && f.term !== termFilter) return false;
            return true;
          }).length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No fee types yet</p>
              <p className="text-sm mt-1">Create a fee type like "1st Term Fees" or "PTA Levy" to get started</p>
              <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">Create First Fee Type</button>
            </div>
          ) : feeTypes.filter((f) => {
            if (sessionFilter && f.academic_session !== sessionFilter) return false;
            if (termFilter && f.term !== termFilter) return false;
            return true;
          }).map((ft) => {
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
            <input type="text" value={ledgerSearch} onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }} placeholder="Search student name or ID…" className="flex-1 min-w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            <select value={ledgerClass} onChange={(e) => { setLedgerClass(e.target.value); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={ledgerTypeFilter} onChange={(e) => { setLedgerTypeFilter(e.target.value as any); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Types</option>
              <option value="Day">Day</option>
              <option value="Boarding">Boarding</option>
            </select>
            <select value={ledgerStatus} onChange={(e) => { setLedgerStatus(e.target.value as any); setLedgerPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
              <option value="all">All Balance</option>
              <option value="outstanding">Outstanding</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>

          {/* click outside to close action menus */}
          {openActionMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenActionMenu(null)} />}

          {isBlankSearch ? (
            /* ── Blank-search instructional state ─────────────────── */
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center mt-2">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-semibold text-base mb-1">No student selected</p>
              <p className="text-gray-400 text-sm max-w-sm mx-auto">Search for a student profile above to view their active financial timeline statement history.</p>
            </div>
          ) : isSingleStudent && focusStudent ? (
            /* ── Single-student Financial Statement Workspace ──────── */
            <div className="flex gap-5 items-start">

              {/* Left: Profile card */}
              <div className="w-60 shrink-0">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-4">
                  <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="w-7 h-7 text-primary-600" />
                  </div>
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{focusStudent.student_name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">{focusStudent.student_id}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{focusStudent.student_class}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${focusStudent.student_status === 'Boarding' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        {focusStudent.student_status || 'Day'}
                      </span>
                    </div>
                  </div>

                  {/* Mini financial summary */}
                  <div className="space-y-2.5 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Arrears B/F</span>
                      <span className="text-sm font-bold text-warning-700">{fmt(focusStudent.arrearsForward)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Current Bill</span>
                      <span className="text-sm font-bold text-gray-800">{fmt(focusStudent.currentTermBill)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Total Paid</span>
                      <span className="text-sm font-bold text-success-700">{fmt(focusStudent.totalPaid)}</span>
                    </div>
                    <div className="border-t pt-2.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Balance</span>
                      {focusStudent.netBalance <= 0
                        ? <span className="text-xs font-bold text-success-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Cleared</span>
                        : <span className="text-sm font-extrabold text-danger-600">{fmt(focusStudent.netBalance)}</span>}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="mt-4 space-y-2 border-t pt-4">
                    <button onClick={() => openTimeline(focusStudent)} className="w-full flex items-center gap-2 justify-center px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold hover:bg-primary-100 transition-colors">
                      <BarChart2 className="w-3.5 h-3.5" /> Full Timeline
                    </button>
                    <button onClick={() => openManageFees(focusStudent)} className="w-full flex items-center gap-2 justify-center px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Manage Fees
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Fee Statement Feed */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">Financial Statement Feed</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{focusStudentFees.length} fee record{focusStudentFees.length !== 1 ? 's' : ''} across all sessions</p>
                  </div>
                  {focusStudent.netBalance <= 0
                    ? <span className="flex items-center gap-1.5 px-3 py-1.5 bg-success-100 text-success-700 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> Account Cleared</span>
                    : <span className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-100 text-danger-700 rounded-full text-xs font-bold"><AlertCircle className="w-3.5 h-3.5" /> {fmt(focusStudent.netBalance)} Outstanding</span>}
                </div>

                {focusStudentFees.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No fee records found for this student.</p>
                    <button onClick={() => openManageFees(focusStudent)} className="mt-3 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700">Assign First Fee</button>
                  </div>
                ) : (
                  <div className="relative space-y-3">
                    {/* Vertical timeline spine */}
                    <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-100 rounded-full" />

                    {focusStudentFees.map((sf) => {
                      const bal = Number(sf.balance);
                      const paid = Number(sf.amount_paid);
                      const due = Number(sf.amount_due);
                      const cleared = bal <= 0;
                      return (
                        <div key={sf.id} className="relative flex gap-4">
                          {/* Timeline badge */}
                          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 shadow-sm ${cleared ? 'bg-success-50 border-success-200' : 'bg-amber-50 border-amber-200'}`}>
                            {cleared
                              ? <CheckCircle className="w-4 h-4 text-success-600" />
                              : <Receipt className="w-4 h-4 text-amber-600" />}
                          </div>

                          {/* Statement card */}
                          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <h4 className="font-bold text-gray-900 text-sm">{sf.fee_name}</h4>
                                <p className="text-xs text-gray-400 mt-0.5 capitalize">
                                  {sf.academic_session}
                                  {(sf as any).term ? ` · ${(sf as any).term}` : ''}
                                  {' · '}{sf.fee_category}
                                </p>
                              </div>
                              {cleared
                                ? <span className="px-2.5 py-0.5 bg-success-100 text-success-700 text-xs font-bold rounded-full shrink-0">✓ Cleared</span>
                                : <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full shrink-0">Owing</span>}
                            </div>

                            {/* Debit / Credit / Balance grid */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                                <div className="text-xs text-gray-400 mb-1 font-medium">Charged (Debit)</div>
                                <div className="text-sm font-extrabold text-gray-800">{fmt(due)}</div>
                              </div>
                              <div className="bg-success-50 rounded-lg px-3 py-2.5 border border-success-100">
                                <div className="text-xs text-success-600 mb-1 font-medium">Paid (Credit)</div>
                                <div className="text-sm font-extrabold text-success-700">{fmt(paid)}</div>
                              </div>
                              <div className={`rounded-lg px-3 py-2.5 border ${cleared ? 'bg-gray-50 border-gray-100' : 'bg-danger-50 border-danger-100'}`}>
                                <div className={`text-xs mb-1 font-medium ${cleared ? 'text-gray-400' : 'text-danger-600'}`}>Balance Due</div>
                                <div className={`text-sm font-extrabold ${cleared ? 'text-gray-400' : 'text-danger-700'}`}>{fmt(Math.max(0, bal))}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Multi-student table (default) ─────────────────────── */
            <>
              {/* Analytics Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Total Expected Revenue</div>
                  <div className="text-xl font-extrabold text-gray-900">{fmt(totalExpectedRevenue)}</div>
                  <div className="text-xs text-gray-400 mt-1">{filteredLedger.length} student{filteredLedger.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="bg-success-50 rounded-xl border border-success-200 shadow-sm p-4">
                  <div className="text-xs text-success-600 font-semibold uppercase tracking-wider mb-1">Total Revenue Collected</div>
                  <div className="text-xl font-extrabold text-success-700">{fmt(totalCollected)}</div>
                  <div className="text-xs text-success-500 mt-1">{totalExpectedRevenue > 0 ? ((totalCollected / totalExpectedRevenue) * 100).toFixed(1) : '0.0'}% collected</div>
                </div>
                <div className="bg-danger-50 rounded-xl border border-danger-200 shadow-sm p-4">
                  <div className="text-xs text-danger-600 font-semibold uppercase tracking-wider mb-1">Total Outstanding Debt</div>
                  <div className="text-xl font-extrabold text-danger-700">{fmt(totalOutstanding)}</div>
                  <div className="text-xs text-danger-500 mt-1">{filteredLedger.filter((s) => s.netBalance > 0).length} students owing</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Student ID', 'Student Name', 'Class', 'Status', 'Arrears B/F', 'Current Term Bill', 'Total Paid', 'Net Balance Due', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLedger.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">No students match your filters</td></tr>
                    ) : paginatedLedger.map((s) => (
                      <tr key={s.student_id} className={`border-t ${s.netBalance > 0 ? 'hover:bg-danger-50' : 'hover:bg-success-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.student_id}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{s.student_name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s.student_class}</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${s.student_status === 'Boarding' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{s.student_status || 'Day'}</span></td>
                        <td className="px-4 py-3 font-semibold text-warning-700">{fmt(s.arrearsForward)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{fmt(s.currentTermBill)}</td>
                        <td className="px-4 py-3 font-semibold text-success-700">{fmt(s.totalPaid)}</td>
                        <td className="px-4 py-3">
                          {s.netBalance <= 0
                            ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success-100 text-success-700 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3" /> Cleared</span>
                            : <span className="font-bold text-danger-600">{fmt(s.netBalance)}</span>}
                        </td>
                        <td className="px-4 py-3 relative">
                          <button
                            onClick={() => setOpenActionMenu(openActionMenu === s.student_id ? null : s.student_id)}
                            className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 flex items-center gap-1 z-20 relative"
                          >
                            Actions <ChevronDown className="w-3 h-3" />
                          </button>
                          {openActionMenu === s.student_id && (
                            <div className="absolute right-4 top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-48 py-1">
                              <button onClick={() => openTimeline(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 flex items-center gap-2 text-gray-700 hover:text-primary-700">
                                <BarChart2 className="w-3.5 h-3.5" /> View Timeline
                              </button>
                              <button onClick={() => openManageFees(s)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 flex items-center gap-2 text-gray-700 hover:text-primary-700">
                                <Plus className="w-3.5 h-3.5" /> Manage Fees
                              </button>
                            </div>
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
                  <span className="text-sm text-gray-500 font-medium">Page {ledgerPage} of {ledgerTotalPages} ({filteredLedger.length} students)</span>
                  <button onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))} disabled={ledgerPage >= ledgerTotalPages} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Manage Fees Modal (per student row) */}
      {showManageFees && manageFeeStudent && (() => {
        const assignedIds = new Set(manageFeeAssigned.map((sf: any) => sf.fee_type_id));
        const seenNames = new Set<string>();
        const availableTemplates = feeTypes.filter((ft) => {
          if (ft.class_filter && ft.class_filter !== manageFeeStudent.student_class) return false;
          if (sessionFilter && ft.academic_session !== sessionFilter) return false;
          if (assignedIds.has(ft.id)) return false;
          if (seenNames.has(ft.name)) return false;
          seenNames.add(ft.name);
          return true;
        });
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                  <h2 className="text-lg font-bold">Manage Fees</h2>
                  <p className="text-sm text-gray-500">{manageFeeStudent.student_name} · {manageFeeStudent.student_class}</p>
                </div>
                <button onClick={() => setShowManageFees(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              {manageFeesError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-3 shrink-0">{manageFeesError}</div>}

              <div className="overflow-auto flex-1 space-y-5">
                {/* Section 1 — Assigned Fees */}
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assigned Fees ({sessionFilter || currentSession})</div>
                  {manageFeeAssignedLoading ? (
                    <div className="py-4 flex justify-center"><div className="w-5 h-5 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
                  ) : manageFeeAssigned.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-2">No fees assigned for this session.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {manageFeeAssigned.map((sf: any) => (
                        <div key={sf.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{sf.fee_name}</div>
                            <div className="text-xs text-gray-400">
                              Due: {fmt(sf.amount_due)} · Paid: {fmt(sf.amount_paid)}
                              {Number(sf.amount_due) - Number(sf.amount_paid) <= 0 && <span className="ml-1 text-success-600 font-semibold">✓ Cleared</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => removeAssignedFee(sf)}
                            disabled={manageFeesSaving}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-50 rounded-lg border border-danger-200 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2 — Available Templates */}
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Available Templates</div>
                  {availableTemplates.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-2">No additional templates available for this class/session.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {availableTemplates.map((ft) => (
                        <label key={ft.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${manageFeeSelected.includes(ft.id) ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={manageFeeSelected.includes(ft.id)} onChange={() => toggleManageFee(ft.id)} className="rounded" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">{ft.name}</div>
                              <div className="text-xs text-gray-400">{ft.academic_session}</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{fmt(ft.amount)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 shrink-0 border-t mt-4">
                <button onClick={() => setShowManageFees(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Close</button>
                <button onClick={saveManageFees} disabled={manageFeesSaving || manageFeeSelected.length === 0} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                  {manageFeesSaving ? 'Working…' : manageFeeSelected.length > 0 ? `Assign (${manageFeeSelected.length})` : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Fee Type Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Create Fee Type</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 text-primary-500 shrink-0" />
              <span className="text-xs text-primary-700">Auto-tagged to <strong>{currentSession}</strong> · <strong>{currentTerm}</strong></span>
            </div>
            {formError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Fee Name <span className="text-danger-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Term School Fees" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required autoFocus />
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Target Class <span className="text-gray-400 font-normal">(optional)</span></label>
                <p className="text-xs text-gray-400 mb-1">Restrict auto-assignment to a specific class. Leave empty for all classes.</p>
                <select value={form.classFilter} onChange={(e) => setForm((p) => ({ ...p, classFilter: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Classes</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Residency / Tier <span className="text-gray-400 font-normal">(applicable to)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {['All Students', 'Day', 'Boarding', 'Remedial'].map((opt) => (
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
                <div className="grid grid-cols-2 gap-2">
                  {['All Students', 'Day', 'Boarding', 'Remedial'].map((opt) => (
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
            <p className="text-sm text-gray-500 mb-2">Delete <strong>{deleteTarget.name}</strong>?</p>
            <div className="bg-warning-50 border border-warning-200 rounded-lg px-3 py-2 text-xs text-warning-800 text-left mb-5">
              <strong>Cascade effect:</strong> All student fee assignments for this fee type will be removed, and each affected student's outstanding balance will be automatically reduced.
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-danger-600 text-white rounded-xl text-sm font-semibold hover:bg-danger-700">Delete & Cascade</button>
            </div>
          </div>
        </div>
      )}

      {/* Recalibrate Balances Confirm / Result Dialog */}
      {showRecalibrate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            {recalibrateResult ? (
              /* Result screen */
              <>
                <div className="w-14 h-14 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-success-600" />
                </div>
                <h2 className="text-lg font-bold text-center mb-1">Recalibration Complete</h2>
                <p className="text-sm text-gray-400 text-center mb-5">All student balances have been recalculated from the fee ledger.</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-success-50 rounded-xl p-3 text-center border border-success-100">
                    <div className="text-2xl font-extrabold text-success-700">{recalibrateResult.updated}</div>
                    <div className="text-xs text-success-600 mt-0.5">Students updated</div>
                  </div>
                  <div className="bg-warning-50 rounded-xl p-3 text-center border border-warning-100">
                    <div className="text-2xl font-extrabold text-warning-700">{recalibrateResult.orphansRemoved}</div>
                    <div className="text-xs text-warning-600 mt-0.5">Orphaned rows removed</div>
                  </div>
                </div>
                <button onClick={() => setShowRecalibrate(false)} className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">Done</button>
              </>
            ) : (
              /* Confirm screen */
              <>
                <div className="w-14 h-14 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-7 h-7 text-warning-600" />
                </div>
                <h2 className="text-lg font-bold text-center mb-2">Recalibrate All Balances?</h2>
                <p className="text-sm text-gray-500 text-center mb-3">This will:</p>
                <ul className="text-sm text-gray-600 space-y-1.5 mb-5 bg-gray-50 rounded-xl p-4">
                  <li className="flex items-start gap-2"><span className="text-warning-600 font-bold mt-0.5">1.</span> Delete all orphaned fee rows whose fee type has been removed</li>
                  <li className="flex items-start gap-2"><span className="text-warning-600 font-bold mt-0.5">2.</span> Recalculate the outstanding balance for every student by summing their actual unpaid fee records</li>
                  <li className="flex items-start gap-2"><span className="text-warning-600 font-bold mt-0.5">3.</span> Overwrite the stored balance counter with the correct figure</li>
                </ul>
                <p className="text-xs text-gray-400 text-center mb-5">This is safe to run any number of times. It will not affect paid amounts or transaction history.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowRecalibrate(false)} disabled={recalibrateRunning} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-40">Cancel</button>
                  <button onClick={runRecalibrate} disabled={recalibrateRunning} className="flex-1 py-2.5 bg-warning-600 text-white rounded-xl text-sm font-semibold hover:bg-warning-700 disabled:opacity-60 flex items-center justify-center gap-2">
                    {recalibrateRunning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running…</> : 'Run Recalibration'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Student Financial Timeline Modal */}
      {timelineStudent && (
        <StudentTimeline
          studentId={timelineStudent.student_id}
          studentName={timelineStudent.student_name}
          studentClass={timelineStudent.student_class}
          currentSession={currentSession}
          currentTerm={currentTerm}
          onClose={() => setTimelineStudent(null)}
          onManageFees={() => { setTimelineStudent(null); openManageFees(timelineStudent); }}
        />
      )}
    </div>
  );
};

export default FeesManagement;
