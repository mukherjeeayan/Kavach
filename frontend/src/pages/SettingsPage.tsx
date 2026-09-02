import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../store/store';
import { useUpdateProfile, useChangePassword, useSetPin, useLogoutAll } from '../hooks/useAuth';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import type { UserSettingsInput } from '../types/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Toast from '../components/ui/Toast';

export default function SettingsPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const setPinMutation = useSetPin();
  const logoutAll = useLogoutAll();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setNameError(null);
    try {
      await updateProfile.mutateAsync({ name: name.trim() });
      setToast({ message: 'Name updated successfully', type: 'success' });
    } catch {
      setNameError('Failed to update name. Please try again.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
    setErrorMessage(null);
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast({ message: 'Password changed successfully', type: 'success' });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorMessage(message || 'Failed to change password.');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin !== confirmPin || !/^\d{4,6}$/.test(pin)) return;
    setPinError(null);
    try {
      await setPinMutation.mutateAsync({ pin });
      setPin('');
      setConfirmPin('');
      setToast({ message: 'PIN updated successfully', type: 'success' });
    } catch {
      setPinError('Failed to set PIN. Please try again.');
    }
  };

  const handleSaveSettings = async (input: UserSettingsInput) => {
    try {
      await updateSettings.mutateAsync(input);
      setToast({ message: 'Settings saved successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
  };

  const handleToggle = async (key: keyof UserSettingsInput, value: boolean) => {
    await handleSaveSettings({ [key]: value });
  };

  const handleLogoutAll = async () => {
    await logoutAll.mutateAsync();
  };

  const settingsSaving = updateSettings.isPending;

  useEffect(() => {
    if (updateSettings.isError) {
      setToast({ message: 'Failed to save settings', type: 'error' });
      updateSettings.reset();
    }
  }, [updateSettings.isError, updateSettings]);

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">
            SafeGuard
          </Link>
          <Link to="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>

        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Profile</h2>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
            {updateProfile.isSuccess && (
              <p className="text-sm text-green-600">Name updated successfully.</p>
            )}
            {nameError && (
              <p className="text-sm text-red-500">{nameError}</p>
            )}
            <button
              type="submit"
              disabled={updateProfile.isPending || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-red-500">Passwords do not match.</p>
            )}
            {changePassword.isSuccess && (
              <p className="text-sm text-green-600">Password changed successfully.</p>
            )}
            {errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {changePassword.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Parental PIN</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            The PIN is used to unlock management sections on the dashboard.
          </p>
          <form onSubmit={handleSetPin} className="space-y-4">
            <div>
              <label htmlFor="new-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New PIN (4-6 digits)</label>
              <input
                id="new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="mt-1 block w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm PIN</label>
              <input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm PIN"
                className="mt-1 block w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            {pin && confirmPin && pin !== confirmPin && (
              <p className="text-sm text-red-500">PINs do not match.</p>
            )}
            {pin && !/^\d{4,6}$/.test(pin) && (
              <p className="text-sm text-red-500">PIN must be 4-6 digits.</p>
            )}
            {setPinMutation.isSuccess && (
              <p className="text-sm text-green-600">PIN updated successfully.</p>
            )}
            {pinError && (
              <p className="text-sm text-red-500">{pinError}</p>
            )}
            <button
              type="submit"
              disabled={setPinMutation.isPending || !pin || !confirmPin || pin !== confirmPin || !/^\d{4,6}$/.test(pin)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {setPinMutation.isPending ? 'Saving...' : 'Save PIN'}
            </button>
          </form>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Notification Preferences</h2>
          {settingsLoading ? (
            <div className="space-y-4">
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Enable Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications for alerts</p>
                </div>
                <button
                  onClick={() => handleToggle('notifications_enabled', !settings?.notifications_enabled)}
                  disabled={settingsSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.notifications_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Screen Time Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when screen time limits are reached</p>
                </div>
                <button
                  onClick={() => handleToggle('screen_time_alerts', !settings?.screen_time_alerts)}
                  disabled={settingsSaving || !settings?.notifications_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.screen_time_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  } ${!settings?.notifications_enabled ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.screen_time_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Location Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about geofence entries/exits</p>
                </div>
                <button
                  onClick={() => handleToggle('location_alerts', !settings?.location_alerts)}
                  disabled={settingsSaving || !settings?.notifications_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.location_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  } ${!settings?.notifications_enabled ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.location_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Communication Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about flagged communications</p>
                </div>
                <button
                  onClick={() => handleToggle('communication_alerts', !settings?.communication_alerts)}
                  disabled={settingsSaving || !settings?.notifications_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.communication_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  } ${!settings?.notifications_enabled ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.communication_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">SOS Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified immediately for emergency SOS events</p>
                </div>
                <button
                  onClick={() => handleToggle('sos_alerts', !settings?.sos_alerts)}
                  disabled={settingsSaving || !settings?.notifications_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.sos_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  } ${!settings?.notifications_enabled ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.sos_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Self-Harm Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about potential self-harm content</p>
                </div>
                <button
                  onClick={() => handleToggle('self_harm_alerts', !settings?.self_harm_alerts)}
                  disabled={settingsSaving || !settings?.notifications_enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.self_harm_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  } ${!settings?.notifications_enabled ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings?.self_harm_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Email Digest</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive email summaries of activity</p>
                  </div>
                  <button
                    onClick={() => handleToggle('email_digest_enabled', !settings?.email_digest_enabled)}
                    disabled={settingsSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.email_digest_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings?.email_digest_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {settings?.email_digest_enabled && (
                  <div className="mt-3 ml-4">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Digest Frequency</label>
                    <select
                      value={settings?.digest_frequency || 'DAILY'}
                      onChange={(e) => handleSaveSettings({ digest_frequency: e.target.value as 'DAILY' | 'WEEKLY' })}
                      disabled={settingsSaving}
                      className="ml-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-1 text-sm"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Do Not Disturb</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Silence notifications during specific hours</p>
                  </div>
                  <button
                    onClick={() => handleToggle('dnd_enabled', !settings?.dnd_enabled)}
                    disabled={settingsSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings?.dnd_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings?.dnd_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {settings?.dnd_enabled && (
                  <div className="mt-3 ml-4 flex gap-4">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Start Time</label>
                      <input
                        type="time"
                        value={settings?.dnd_start_time || '22:00'}
                        onChange={(e) => handleSaveSettings({ dnd_start_time: e.target.value })}
                        disabled={settingsSaving}
                        className="ml-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">End Time</label>
                      <input
                        type="time"
                        value={settings?.dnd_end_time || '07:00'}
                        onChange={(e) => handleSaveSettings({ dnd_end_time: e.target.value })}
                        disabled={settingsSaving}
                        className="ml-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-1 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Sign out of all devices</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This will revoke your session on all devices.</p>
            </div>
            <button
              onClick={() => setConfirmLogoutAll(true)}
              disabled={logoutAll.isPending}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {logoutAll.isPending ? 'Signing Out...' : 'Sign Out All Devices'}
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

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </main>
    </div>
  );
}