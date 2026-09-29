import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

type LoginMode = 'pin' | 'password';

const LoginPage: React.FC = () => {
  const { loginWithPin, loginWithPassword } = useAuth();
  const [mode, setMode] = useState<LoginMode>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinInput = (value: string) => {
    if (pin.length < 4 && value !== '') {
      const newPin = pin + value;
      setPin(newPin);
      if (newPin.length === 4) {
        handlePinSubmit(newPin);
      }
    }
    if (value === 'del') {
      setPin(pin.slice(0, -1));
      setError('');
    }
    if (value === 'clear') {
      setPin('');
      setError('');
    }
  };

  const handlePinSubmit = async (pinValue: string) => {
    setLoading(true);
    setError('');
    const result = await loginWithPin(pinValue);
    if (!result.success) {
      setError(result.error || 'Invalid PIN');
      setPin('');
    }
    setLoading(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await loginWithPassword(password);
    if (!result.success) {
      setError(result.error || 'Invalid password');
      setPassword('');
    }
    setLoading(false);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'pin' && !loading) {
        if (e.key >= '0' && e.key <= '9') handlePinInput(e.key);
        else if (e.key === 'Backspace') handlePinInput('del');
        else if (e.key === 'Escape') handlePinInput('clear');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, pin, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">School POS System</h1>
          <p className="text-gray-500 text-sm mt-1">Store & Fees Management</p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button onClick={() => { setMode('pin'); setPin(''); setError(''); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'pin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cashier PIN</button>
          <button onClick={() => { setMode('password'); setPassword(''); setError(''); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Admin Password</button>
        </div>

        {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        {mode === 'pin' && (
          <div>
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-colors ${pin.length > i ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-gray-50'}`}>
                  {pin.length > i && <div className="w-3 h-3 bg-white rounded-full"></div>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'].map((key) => (
                <button key={key} onClick={() => handlePinInput(key === 'clear' || key === 'del' ? key : key)} disabled={loading} className={`h-14 rounded-xl text-xl font-semibold transition-all ${key === 'clear' || key === 'del' ? 'bg-gray-200 text-sm text-gray-600' : 'bg-gray-100 hover:bg-gray-200'} ${loading ? 'opacity-50' : ''}`}>
                  {key === 'clear' ? 'CLR' : key === 'del' ? <span className="text-base">DEL</span> : key}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Enter admin password" autoFocus disabled={loading} />
            </div>
            <button type="submit" disabled={!password || loading} className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Signing in...' : 'Sign In as Admin'}</button>
          </form>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
