import React, { useState, useEffect } from 'react';
import { X, KeyRound, AlertTriangle } from 'lucide-react';
import { userAPI } from '../../lib/api';

interface User { id: number; username: string; role: string; is_active: boolean; created_at: string; }

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', pin: '', role: 'cashier' });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Reset password modal
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    userAPI.getAll().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    const result = await userAPI.create(formData);
    if (result.success) {
      setShowAdd(false);
      setFormData({ username: '', password: '', pin: '', role: 'cashier' });
      userAPI.getAll().then(setUsers);
    } else setAddError(result.error || 'Failed to create user');
    setAddSaving(false);
  };

  const toggleActive = async (u: User) => {
    await userAPI.update(u.id, { username: u.username, pin: '', isActive: !u.is_active });
    userAPI.getAll().then(setUsers);
  };

  const openResetPw = (u: User) => {
    setResetTarget(u);
    setNewPassword('');
    setResetSuccess(false);
    setShowResetPw(true);
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;
    setResetSaving(true);
    await userAPI.resetPassword(resetTarget.id, newPassword);
    setResetSuccess(true);
    setResetSaving(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-500">{users.length} users</p>
        </div>
        <button onClick={() => { setFormData({ username: '', password: '', pin: '', role: 'cashier' }); setAddError(''); setShowAdd(true); }} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Add User</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className={`border-t hover:bg-gray-50 ${!u.is_active ? 'bg-gray-100 opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>{u.role}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${u.is_active ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center">
                  {u.role !== 'superadmin' && (
                    <>
                      <button onClick={() => openResetPw(u)} className="px-2 py-1 text-sm bg-warning-100 text-warning-700 rounded mr-1 hover:bg-warning-200">Reset Password</button>
                      <button onClick={() => toggleActive(u)} className={`px-2 py-1 text-sm rounded ${u.is_active ? 'bg-danger-100 text-danger-700 hover:bg-danger-200' : 'bg-success-100 text-success-700 hover:bg-success-200'}`}>{u.is_active ? 'Disable' : 'Enable'}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add New User</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {addError && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-4 py-2 mb-4">{addError}</div>}
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Username</label><input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required /></div>
                <div><label className="block text-sm font-medium mb-1">Role</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"><option value="cashier">Cashier</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required /></div>
                <div><label className="block text-sm font-medium mb-1">4-Digit PIN</label><input type="text" value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={4} placeholder="1234" required /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={addSaving} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">{addSaving ? 'Adding…' : 'Add User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPw && resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center"><KeyRound className="w-5 h-5 text-warning-600" /></div>
                <h2 className="text-lg font-bold">Reset Password</h2>
              </div>
              <button onClick={() => setShowResetPw(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="font-semibold text-gray-900">{resetTarget.username}</div>
              <div className="text-sm text-gray-500">{resetTarget.role}</div>
            </div>
            {resetSuccess ? (
              <div className="bg-success-50 text-success-700 rounded-xl p-4 text-center mb-4">
                <div className="font-semibold">Password reset successfully!</div>
              </div>
            ) : (
              <form onSubmit={handleResetPw} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">New Password</label>
                  <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required autoFocus />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowResetPw(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Cancel</button>
                  <button type="submit" disabled={resetSaving || !newPassword} className="flex-1 py-2.5 bg-warning-500 text-white rounded-xl text-sm font-semibold hover:bg-warning-600 disabled:opacity-50">{resetSaving ? 'Resetting…' : 'Reset'}</button>
                </div>
              </form>
            )}
            {resetSuccess && (
              <button onClick={() => setShowResetPw(false)} className="w-full py-2.5 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Done</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
