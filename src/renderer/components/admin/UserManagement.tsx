import React, { useState, useEffect } from 'react';
import { userAPI } from '../../lib/api';

interface User { id: number; username: string; role: string; is_active: boolean; created_at: string; }

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', pin: '', role: 'cashier' });

  useEffect(() => {
    userAPI.getAll().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await userAPI.create(formData);
    if (result.success) {
      setShowAdd(false);
      setFormData({ username: '', password: '', pin: '', role: 'cashier' });
      userAPI.getAll().then(setUsers);
    } else alert(result.error);
  };

  const toggleActive = async (u: User) => {
    await userAPI.update(u.id, { username: u.username, pin: '', isActive: !u.is_active });
    userAPI.getAll().then(setUsers);
  };

  const resetPassword = async (u: User) => {
    const newPass = prompt('Enter new password:');
    if (!newPass) return;
    await userAPI.resetPassword(u.id, newPass);
    alert('Password reset successfully');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-500">{users.length} users</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Add User</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
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
              <tr key={u.id} className={`border-t ${!u.is_active ? 'bg-gray-100 opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>{u.role}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${u.is_active ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center">
                  {u.role !== 'superadmin' && (
                    <>
                      <button onClick={() => resetPassword(u)} className="px-2 py-1 text-sm bg-warning-100 text-warning-700 rounded mr-1 hover:bg-warning-200">Reset Password</button>
                      <button onClick={() => toggleActive(u)} className={`px-2 py-1 text-sm rounded ${u.is_active ? 'bg-danger-100 text-danger-700 hover:bg-danger-200' : 'bg-success-100 text-success-700 hover:bg-success-200'}`}>{u.is_active ? 'Disable' : 'Enable'}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Username</label><input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium mb-1">Role</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 border rounded-md"><option value="cashier">Cashier</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium mb-1">4-Digit PIN</label><input type="text" value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} className="w-full px-3 py-2 border rounded-md" maxLength={4} placeholder="1234" required /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
