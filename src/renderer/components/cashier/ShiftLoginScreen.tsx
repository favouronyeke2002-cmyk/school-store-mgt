import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';

const ShiftLoginScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { openShift } = useShift();
  const [openingCash, setOpeningCash] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) {
      setError('Please enter a valid cash amount');
      return;
    }

    setLoading(true);
    setError('');
    const success = await openShift(cash, user?.id || 0);
    if (!success) {
      setError('Failed to open shift. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-warning-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Open New Shift</h1>
          <p className="text-gray-500 text-sm mt-1">Enter starting cash to begin your shift</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="label">Opening Cash Amount (NGN)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="input pl-8 text-right text-xl font-semibold"
                placeholder="0.00"
                autoFocus
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Count your cash drawer and enter the total</p>
          </div>

          <button
            type="submit"
            disabled={!openingCash || loading}
            className="btn btn-success w-full py-3 text-lg"
          >
            {loading ? 'Opening Shift...' : 'Open Shift'}
          </button>
        </form>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {['0', '1000', '5000', '10000'].map((amount) => (
            <button
              key={amount}
              onClick={() => setOpeningCash(amount)}
              className="btn btn-secondary text-sm"
            >
              ₦{Number(amount).toLocaleString()}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center text-sm">
          <span className="text-gray-500">Logged in as: {user?.username}</span>
          <button
            onClick={logout}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftLoginScreen;
