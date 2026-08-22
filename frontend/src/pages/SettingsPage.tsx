import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../store/store';
import { useLogout } from '../hooks/useAuth';
import apiClient from '../services/apiClient';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function SettingsPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const { handleLogout } = useLogout();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [nameStatus, setNameStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [logoutAllStatus, setLogoutAllStatus] = useState<'idle' | 'loading'>('idle');
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setNameStatus('loading');
    setNameError(null);
    try {
      await apiClient.put('/auth/profile', { name: name.trim() });
      setNameStatus('success');
    } catch {
      setNameStatus('error');
      setNameError('Failed to update name. Please try again.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
    setPasswordStatus('loading');
    setErrorMessage(null);
    try {
      await apiClient.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordStatus('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordStatus('error');
      const message = err instanceof Error ? err.message : (err as any)?.response?.data?.message;
      setErrorMessage(message || 'Failed to change password.');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin !== confirmPin || !/^\d{4,6}$/.test(pin)) return;
    setPinStatus('loading');
    try {
      await apiClient.put('/auth/pin', { pin });
      setPinStatus('success');
      setPin('');
      setConfirmPin('');
    } catch {
      setPinStatus('error');
      setPinError('Failed to set PIN. Please try again.');
    }
  };

  // Revokes every refresh token server-side; the local session is then
  // cleared so this device is signed out too.
  const handleLogoutAll = async () => {
    setLogoutAllStatus('loading');
    try {
      await apiClient.post('/auth/logout-all');
    } catch {
      // Even if the server call fails, fall through to local logout.
    }
    await handleLogout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">
            SafeGuard
          </Link>
          <Link to="/dashboard" className="text-sm text-gray-600 hover:text-primary">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

        {/* Profile Section */}
        <section className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
            </div>
            {nameStatus === 'success' && (
              <p className="text-sm text-green-600">Name updated successfully.</p>
            )}
            {nameError && (
              <p className="text-sm text-red-500">{nameError}</p>
            )}
            <button
              type="submit"
              disabled={nameStatus === 'loading' || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {nameStatus === 'loading' ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Password Section */}
        <section className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-red-500">Passwords do not match.</p>
            )}
            {passwordStatus === 'success' && (
              <p className="text-sm text-green-600">Password changed successfully.</p>
            )}
            {errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={passwordStatus === 'loading' || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {passwordStatus === 'loading' ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </section>

        {/* PIN Section */}
        <section className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Parental PIN</h2>
          <p className="text-sm text-gray-500 mb-4">
            The PIN is used to unlock management sections on the dashboard.
          </p>
          <form onSubmit={handleSetPin} className="space-y-4">
            <div>
              <label htmlFor="new-pin" className="block text-sm font-medium text-gray-700">New PIN (4-6 digits)</label>
              <input
                id="new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="mt-1 block w-48 rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-medium text-gray-700">Confirm PIN</label>
              <input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                className="mt-1 block w-48 rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            {pin && confirmPin && pin !== confirmPin && (
              <p className="text-sm text-red-500">PINs do not match.</p>
            )}
            {pin && !/^\d{4,6}$/.test(pin) && (
              <p className="text-sm text-red-500">PIN must be 4-6 digits.</p>
            )}
            {pinStatus === 'success' && (
              <p className="text-sm text-green-600">PIN updated successfully.</p>
            )}
            {pinError && (
              <p className="text-sm text-red-500">{pinError}</p>
            )}
            <button
              type="submit"
              disabled={pinStatus === 'loading' || !pin || !confirmPin || pin !== confirmPin || !/^\d{4,6}$/.test(pin)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pinStatus === 'loading' ? 'Saving...' : 'Save PIN'}
            </button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="bg-white rounded-lg border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Sign out of all devices</p>
              <p className="text-sm text-gray-500">This will revoke your session on all devices.</p>
            </div>
            <button
              onClick={() => setConfirmLogoutAll(true)}
              disabled={logoutAllStatus === 'loading'}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {logoutAllStatus === 'loading' ? 'Signing Out...' : 'Sign Out All Devices'}
            </button>
          </div>
        </section>

        {confirmLogoutAll && (
          <ConfirmDialog
            title="Sign out of all devices?"
            message="This revokes every active session, including this one. You will need to sign in again on all devices."
            confirmLabel="Sign Out Everywhere"
            variant="danger"
            onConfirm={() => {
              setConfirmLogoutAll(false);
              void handleLogoutAll();
            }}
            onCancel={() => setConfirmLogoutAll(false)}
          />
        )}
      </main>
    </div>
  );
}
