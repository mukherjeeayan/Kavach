import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsAdmin } from '../store/authSlice';
import { useLogout } from '../hooks/useAuth';
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateAdminUserSubscription,
  updateAdminUserRole,
  fetchAdminFeatureFlags,
  updateAdminFeatureFlag,
  type AdminUser,
  type AdminFeatureFlag,
  type AdminSystemStats,
} from '../services/api';
import Toast from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';

export default function AdminDashboard() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const { handleLogout } = useLogout();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'features'>('stats');
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stats query
  const statsQuery = useQuery<AdminSystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    enabled: isAdmin && activeTab === 'stats',
  });

  // Users query
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', userPage, userSearch],
    queryFn: () => fetchAdminUsers(userPage, 20, userSearch || undefined),
    enabled: isAdmin && activeTab === 'users',
  });

  // Feature flags query
  const flagsQuery = useQuery<AdminFeatureFlag[]>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: fetchAdminFeatureFlags,
    enabled: isAdmin && activeTab === 'features',
  });

  // Mutations
  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ userId, tier }: { userId: string; tier: string }) =>
      updateAdminUserSubscription(userId, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setToastMessage('Subscription updated successfully');
    },
    onError: () => setToastMessage('Failed to update subscription'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateAdminUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setToastMessage('Role updated successfully');
    },
    onError: () => setToastMessage('Failed to update role'),
  });

  const updateFlagMutation = useMutation({
    mutationFn: ({ key, patch }: { key: string; patch: { is_enabled?: boolean; required_tier?: string } }) =>
      updateAdminFeatureFlag(key, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] });
      setToastMessage('Feature flag updated successfully');
    },
    onError: () => setToastMessage('Failed to update feature flag'),
  });

  // Redirect non-admins
  if (!isAdmin) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => handleLogout()}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex gap-8">
            {(['stats', 'users', 'features'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'stats' ? 'System Stats' : tab === 'users' ? 'User Management' : 'Feature Flags'}
              </button>
            ))}
          </nav>
        </div>

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div>
            {statsQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : statsQuery.data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Users" value={statsQuery.data.total_users} color="blue" />
                <StatCard title="Free Users" value={statsQuery.data.free_users} color="gray" />
                <StatCard title="Active Trials" value={statsQuery.data.active_trial_users} color="amber" />
                <StatCard title="Expired Trials" value={statsQuery.data.expired_trial_users} color="red" />
                <StatCard title="Premium Users" value={statsQuery.data.premium_users} color="green" />
                <StatCard title="Admin Users" value={statsQuery.data.admin_users} color="purple" />
                <StatCard title="New Users (7d)" value={statsQuery.data.new_users_7d} color="cyan" />
                <StatCard title="New Users (30d)" value={statsQuery.data.new_users_30d} color="indigo" />
              </div>
            ) : null}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {usersQuery.isLoading ? (
              <Skeleton className="h-64" />
            ) : usersQuery.data ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trial Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Children</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {usersQuery.data.users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onUpdateTier={(tier) => updateSubscriptionMutation.mutate({ userId: user.id, tier })}
                        onUpdateRole={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                      />
                    ))}
                  </tbody>
                </table>
                </div>
                {/* Pagination */}
                <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500">
                    Showing {(userPage - 1) * 20 + 1}-{Math.min(userPage * 20, usersQuery.data.total)} of {usersQuery.data.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setUserPage((p) => p + 1)}
                      disabled={userPage * 20 >= usersQuery.data.total}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Feature Flags Tab */}
        {activeTab === 'features' && (
          <div>
            {flagsQuery.isLoading ? (
              <Skeleton className="h-64" />
            ) : flagsQuery.data ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Tier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enabled</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {flagsQuery.data.map((flag) => (
                      <FlagRow
                        key={flag.key}
                        flag={flag}
                        onToggle={(enabled) =>
                          updateFlagMutation.mutate({ key: flag.key, patch: { is_enabled: enabled } })
                        }
                        onTierChange={(tier) =>
                          updateFlagMutation.mutate({ key: flag.key, patch: { required_tier: tier } })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-50 text-gray-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className={`rounded-lg p-4 ${colorMap[color] ?? 'bg-gray-50 text-gray-600'}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function UserRow({
  user,
  onUpdateTier,
  onUpdateRole,
}: {
  user: AdminUser;
  onUpdateTier: (tier: string) => void;
  onUpdateRole: (role: string) => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={user.role}
          onChange={(e) => onUpdateRole(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
        >
          <option value="parent">Parent</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={user.subscription_tier}
          onChange={(e) => onUpdateTier(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
        >
          <option value="FREE">Free</option>
          <option value="TRIAL">Trial</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.trial_expires_at ? new Date(user.trial_expires_at).toLocaleDateString() : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.child_count}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.payment_count} payments
      </td>
    </tr>
  );
}

function FlagRow({
  flag,
  onToggle,
  onTierChange,
}: {
  flag: AdminFeatureFlag;
  onToggle: (enabled: boolean) => void;
  onTierChange: (tier: string) => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{flag.key}</span>
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-gray-500">{flag.description ?? '—'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <select
          value={flag.required_tier}
          onChange={(e) => onTierChange(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white"
        >
          <option value="FREE">Free</option>
          <option value="TRIAL">Trial</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={() => onToggle(!flag.is_enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            flag.is_enabled ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              flag.is_enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        Updated {new Date(flag.updated_at).toLocaleDateString()}
      </td>
    </tr>
  );
}
