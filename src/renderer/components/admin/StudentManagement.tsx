import React, { useState, useEffect } from 'react';
import { studentAPI } from '../../lib/api';

interface Student { student_id: string; name: string; student_class: string; current_fees_owed: number; }

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [formData, setFormData] = useState({ studentId: '', name: '', studentClass: '', feesOwed: 0 });

  useEffect(() => {
    setLoading(true);
    studentAPI.getAll({ search, class: selectedClass }).then(setStudents).catch(console.error).finally(() => setLoading(false));
  }, [search, selectedClass]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await studentAPI.create({ studentId: formData.studentId, name: formData.name, studentClass: formData.studentClass, feesOwed: formData.feesOwed });
    if (result.success) {
      setShowModal(false);
      setFormData({ studentId: '', name: '', studentClass: '', feesOwed: 0 });
      studentAPI.getAll({ search, class: selectedClass }).then(setStudents);
    } else alert(result.error);
  };

  const viewHistory = async (s: Student) => {
    setSelectedStudent(s);
    const h = await studentAPI.getHistory(s.student_id);
    setHistory(h);
    setShowHistory(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    await studentAPI.delete(id);
    studentAPI.getAll({ search, class: selectedClass }).then(setStudents);
  };

  const updateFees = async (s: Student) => {
    const val = prompt('Enter new fees owed:', String(s.current_fees_owed));
    if (val === null) return;
    const fees = parseFloat(val);
    if (isNaN(fees) || fees < 0) { alert('Invalid amount'); return; }
    await studentAPI.updateFees(s.student_id, fees);
    studentAPI.getAll({ search, class: selectedClass }).then(setStudents);
  };

  const classes = ['JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B', 'SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];
  const totalFees = students.reduce((sum, s) => sum + s.current_fees_owed, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <p className="text-gray-500">{students.length} students - N{totalFees.toLocaleString()} outstanding fees</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">Add Student</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-md" placeholder="Search by name or ID..." />
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-3 py-2 border rounded-md">
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
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fees Owed</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No students found</td></tr>
            ) : students.map((s) => (
              <tr key={s.student_id} className="border-t">
                <td className="px-4 py-3 font-mono text-sm">{s.student_id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-xs">{s.student_class}</span></td>
                <td className={`px-4 py-3 text-right font-semibold ${s.current_fees_owed > 0 ? 'text-danger-600' : 'text-success-600'}`}>N{s.current_fees_owed.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => viewHistory(s)} className="px-2 py-1 text-sm bg-gray-200 rounded mr-1 hover:bg-gray-300">History</button>
                  <button onClick={() => updateFees(s)} className="px-2 py-1 text-sm bg-warning-100 text-warning-700 rounded mr-1 hover:bg-warning-200">Edit Fees</button>
                  <button onClick={() => handleDelete(s.student_id)} className="px-2 py-1 text-sm bg-danger-100 text-danger-700 rounded hover:bg-danger-200">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Add New Student</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Student ID (optional)</label>
                <input type="text" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="w-full px-3 py-2 border rounded-md" placeholder="Auto-generated if empty" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Class</label>
                <select value={formData.studentClass} onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })} className="w-full px-3 py-2 border rounded-md" required>
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Initial Fees Owed</label>
                <input type="number" value={formData.feesOwed} onChange={(e) => setFormData({ ...formData, feesOwed: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-md" min={0} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Transaction History</h2>
                <p className="text-gray-500">{selectedStudent.name} - {selectedStudent.student_id}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-2xl">&times;</button>
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
                      <td className="px-3 py-2"><span className={`px-2 py-1 rounded text-xs ${h.type === 'STORE_PURCHASE' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>{h.type === 'STORE_PURCHASE' ? 'Store' : 'Fees'}</span></td>
                      <td className="px-3 py-2 max-w-xs truncate">{h.items_summary || '-'}</td>
                      <td className="px-3 py-2">{h.payment_mode}</td>
                      <td className="px-3 py-2 text-right font-semibold">N{h.amount_paid.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="font-bold border-t-2">
                  <tr>
                    <td colSpan={4} className="px-3 py-2">Total:</td>
                    <td className="px-3 py-2 text-right">N{history.reduce((s, h) => s + h.amount_paid, 0).toLocaleString()}</td>
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
