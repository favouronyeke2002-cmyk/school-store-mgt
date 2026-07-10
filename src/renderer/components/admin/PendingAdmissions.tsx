import React, { useState, useEffect } from 'react';
import { UserPlus, Clock, CheckCircle, X, AlertCircle, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { applicantAPI, studentAPI, settingsAPI, feeTypeAPI, studentFeeAPI } from '../../lib/api';

const fmt = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Applicant {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  proposed_class: string | null;
  phone: string | null;
  student_status: 'Day' | 'Boarding' | null;
  status: 'pending' | 'eligible' | 'enrolled';
  eligible_at: string | null;
  enrolled_student_id: string | null;
  enrolled_student_name: string | null;
  enrolled_student_class: string | null;
  notes: string | null;
  created_at: string;
}

const PendingAdmissions: React.FC = () => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'eligible' | 'enrolled' | 'all'>('all');
  const [search, setSearch] = useState('');

  // Enrollment modal
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<Applicant | null>(null);
  const [enrollForm, setEnrollForm] = useState({ studentId: '', class: '', name: '' });
  const [enrollSaving, setEnrollSaving] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollStatus, setEnrollStatus] = useState('');
  const [enrollingBalance, setEnrollingBalance] = useState(0);
  const [classes, setClasses] = useState<string[]>([]);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Applicant | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    studentAPI.getClasses().then(setClasses).catch(console.error);
  }, []);

  const load = () => {
    setLoading(true);
    applicantAPI.getAll({ status: statusFilter !== 'all' ? statusFilter : undefined, search })
      .then((data) => {
        // When showing "All Statuses", hide enrolled applicants — they've been processed
        setApplicants(statusFilter === 'all' ? data.filter((a: Applicant) => a.status !== 'enrolled') : data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, search]);

  const openEnroll = (a: Applicant) => {
    setEnrollTarget(a);
    setEnrollForm({ studentId: '', class: a.proposed_class || classes[0] || '', name: `${a.first_name} ${a.last_name}` });
    setEnrollError('');
    setEnrollingBalance(0);
    setShowEnroll(true);
    // Async-fetch outstanding balance to show carrying-forward badge in modal
    applicantAPI.getOutstandingBalance(a.id).then(setEnrollingBalance).catch(console.error);
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget) return;
    if (!enrollForm.class || !enrollForm.name) {
      setEnrollError('Class and name are required');
      return;
    }
    setEnrollSaving(true);
    setEnrollError('');

    // ── STEP 1: Create student record, fix boarding status flip ──────────────
    setEnrollStatus('Creating student record…');
    const result = await studentAPI.create({
      studentId: enrollForm.studentId || undefined,   // empty → auto-generate
      name: enrollForm.name,
      studentClass: enrollForm.class,
      admissionType: 'New',
      applicantId: enrollTarget.id,
      studentStatus: enrollTarget.student_status || 'Day',  // ← fix status flip
    });

    if (!result.success) {
      setEnrollError(result.error || 'Failed to create student');
      setEnrollSaving(false);
      setEnrollStatus('');
      return;
    }

    const newStudentId = result.studentId;

    // ── STEP 2: Link applicant → student (also bridges transactions.student_id) ─
    setEnrollStatus('Linking applicant record…');
    await applicantAPI.enroll(enrollTarget.id, newStudentId);

    // ── STEP 3: Inherit standard class fees for the current term ─────────────
    setEnrollStatus('Assigning class fees…');
    try {
      const settings = await settingsAPI.get();
      const classFees = await feeTypeAPI.getByClass(enrollForm.class);
      const housingStatus = enrollTarget.student_status || 'Day';
      const applicableFees = classFees.filter((f: any) => {
        if (f.fee_category !== 'standard') return false;
        if (f.applicable_to === 'Day' && housingStatus !== 'Day') return false;
        if (f.applicable_to === 'Boarding' && housingStatus !== 'Boarding') return false;
        if (settings.current_term && f.term && f.term !== settings.current_term) return false;
        return true;
      });
      for (const fee of applicableFees) {
        await feeTypeAPI.assignToStudents(
          fee.id, Number(fee.amount), undefined, newStudentId, 'standard', fee.applicable_to,
        );
      }
    } catch (feeErr) {
      console.warn('Class fee assignment skipped (non-fatal):', feeErr);
    }

    // ── STEP 4: Carry over any outstanding registration bundle balance ────────
    setEnrollStatus('Bridging registration balance…');
    try {
      const balance = await applicantAPI.getOutstandingBalance(enrollTarget.id);
      if (balance > 0) {
        const settings = await settingsAPI.get();
        await studentFeeAPI.addCarryOverEntry(
          newStudentId, balance,
          settings.academic_session || '', settings.current_term || '',
        );
      }
    } catch (balErr) {
      console.warn('Balance carry-over skipped (non-fatal):', balErr);
    }

    setEnrollStatus('');
    setShowEnroll(false);
    load();
    setEnrollSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await applicantAPI.delete(deleteTarget.id);
    setShowDelete(false);
    setDeleteTarget(null);
    load();
  };

  const paginatedApplicants = applicants.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(applicants.length / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Pending Admissions</h1>
          <p className="text-sm text-gray-400 mt-0.5">Applicants ready for enrollment after payment</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="all">All Statuses</option>
            <option value="eligible">Ready to Enroll</option>
            <option value="pending">Pending Payment</option>
            <option value="enrolled">Enrolled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Search by name or phone..." />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : applicants.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No applicants found</p>
          <p className="text-sm mt-1">{statusFilter === 'eligible' ? 'Applicants who make payments will appear here' : 'Adjust filters to see applicants'}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Proposed Class</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplicants.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.full_name}</div>
                      <div className="text-xs text-gray-400">ID: {a.id}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.phone || '—'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{a.proposed_class || 'Not set'}</span></td>
                    <td className="px-4 py-3">
                      {a.status === 'eligible' ? (
                        <span className="flex items-center gap-1 text-success-600 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> Ready</span>
                      ) : a.status === 'enrolled' ? (
                        <span className="flex items-center gap-1 text-primary-600 text-xs font-bold"><UserPlus className="w-3.5 h-3.5" /> Enrolled</span>
                      ) : (
                        <span className="flex items-center gap-1 text-warning-600 text-xs font-bold"><Clock className="w-3.5 h-3.5" /> Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      {a.status === 'eligible' && (
                        <button onClick={() => openEnroll(a)} className="px-3 py-1.5 bg-success-600 text-white rounded-lg text-xs font-semibold hover:bg-success-700 mr-1">Enroll</button>
                      )}
                      {a.status === 'enrolled' && a.enrolled_student_id && (
                        <span className="text-xs text-gray-500 mr-1">{a.enrolled_student_name} ({a.enrolled_student_class})</span>
                      )}
                      <button onClick={() => { setDeleteTarget(a); setShowDelete(true); }} className="px-2 py-1 text-xs text-danger-600 hover:bg-danger-50 rounded">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </>
      )}

      {/* Enrollment Modal */}
      {showEnroll && enrollTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success-100 rounded-xl flex items-center justify-center"><UserPlus className="w-5 h-5 text-success-600" /></div>
                <h2 className="text-lg font-bold">Enroll Applicant</h2>
              </div>
              <button onClick={() => setShowEnroll(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="font-semibold text-gray-900">{enrollTarget.full_name}</div>
              <div className="text-sm text-gray-500">Applied: {new Date(enrollTarget.created_at).toLocaleDateString()}</div>
            </div>
            {enrollingBalance > 0 && (
              <div className="flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5 mb-4">
                <AlertCircle className="w-4 h-4 text-warning-600 shrink-0" />
                <span className="text-sm text-warning-800 font-medium">
                  Carrying forward <strong>{fmt(enrollingBalance)}</strong> outstanding bundle balance to student profile
                </span>
              </div>
            )}

            {enrollStatus && (
              <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2.5 mb-4">
                <div className="w-3.5 h-3.5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin shrink-0" />
                <span className="text-sm text-primary-800 font-medium">{enrollStatus}</span>
              </div>
            )}
            {enrollError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{enrollError}</div>}

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Student ID *</label>
                <input type="text" value={enrollForm.studentId} onChange={(e) => setEnrollForm((p) => ({ ...p, studentId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="e.g. STU-0100 or leave for auto" />
                <p className="text-xs text-gray-400 mt-1">Leave empty to auto-generate</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                <input type="text" value={enrollForm.name} onChange={(e) => setEnrollForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Class *</label>
                <select value={enrollForm.class} onChange={(e) => setEnrollForm((p) => ({ ...p, class: e.target.value }))} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEnroll(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={enrollSaving} className="flex-1 py-2.5 bg-success-600 text-white rounded-xl text-sm font-semibold hover:bg-success-700 disabled:opacity-50">{enrollSaving ? 'Enrolling…' : 'Enroll as Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
            <div className="w-14 h-14 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-7 h-7 text-danger-600" /></div>
            <h2 className="text-lg font-bold mb-2">Delete Applicant?</h2>
            <p className="text-sm text-gray-500 mb-5">Delete <strong>{deleteTarget.full_name}</strong>? This cannot be undone.</p>
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

export default PendingAdmissions;
