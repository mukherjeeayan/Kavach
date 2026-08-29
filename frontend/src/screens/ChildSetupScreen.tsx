import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useChildren } from '../hooks/useChildrenData';
import { updateChildPhone } from '../services/api';
import Toast from '../components/ui/Toast';

export default function ChildSetupScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const { data: children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [toast, setToast] = useState<string | null>(null);

  const childId = selectedChildId ?? children?.[0]?.id ?? null;

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId || !phone.trim()) return;
    setStatus('loading');
    try {
      await updateChildPhone(childId, phone.trim());
      setStatus('success');
      setToast('Phone number saved successfully');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch {
      setStatus('error');
      setToast('Failed to save phone number');
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Child Setup</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Add the child's phone number so Kavach can monitor their device.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {children && children.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Child</label>
              <select
                value={childId ?? ''}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {user && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
          )}

          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Child's Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                autoFocus
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                This number will be used to pair the child's device with Kavach.
              </p>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || !phone.trim() || !childId}
              className="w-full px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {status === 'loading' ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>

          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full mt-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>

      {toast && <Toast message={toast} type={status === 'error' ? 'error' : 'success'} onClose={() => setToast(null)} />}
    </div>
  );
}
