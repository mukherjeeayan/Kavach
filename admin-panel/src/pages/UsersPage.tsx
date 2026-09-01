import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  trial_expires_at: string | null;
  created_at: string;
  child_count: number;
  payment_count: number;
}

interface SubscriptionModalProps {
  user: User;
  onClose: () => void;
}

function SubscriptionModal({ user, onClose }: SubscriptionModalProps) {
  const [tier, setTier] = useState(user.subscription_tier);
  const [trialDays, setTrialDays] = useState(7);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/users/${user.id}/subscription`, {
        tier,
        trial_days: tier === 'TRIAL' ? trialDays : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Update Subscription</h2>
        <p className="text-muted text-sm">{user.name} &lt;{user.email}&gt;</p>

        <div className="form-group">
          <label htmlFor="tier">Subscription Tier</label>
          <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="FREE">Free</option>
            <option value="TRIAL">Trial</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </div>

        {tier === 'TRIAL' && (
          <div className="form-group">
            <label htmlFor="trialDays">Trial Duration (days)</label>
            <input
              id="trialDays"
              type="number"
              min={1}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
            />
          </div>
        )}

        {mutation.isError && (
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>Failed to update subscription.</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () =>
      api
        .get('/admin/users', { params: { page, limit: 20, search: search || undefined } })
        .then((r) => r.data.data as { users: User[]; total: number }),
  });

  const makeAdminMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <h1 className="page-title">👥 Users</h1>

      <div className="search-row">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <span className="text-muted text-sm">{data?.total ?? 0} total</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Tier</th>
                  <th>Trial Expires</th>
                  <th>Children</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td><span className={`badge-role ${u.role}`}>{u.role}</span></td>
                    <td><span className={`badge-tier ${u.subscription_tier}`}>{u.subscription_tier}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.trial_expires_at
                        ? new Date(u.trial_expires_at) < new Date()
                          ? <span style={{ color: 'var(--danger)' }}>Expired</span>
                          : formatDate(u.trial_expires_at)
                        : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>{u.child_count}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedUser(u)}
                        >
                          Edit Tier
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            makeAdminMutation.mutate({
                              userId: u.id,
                              role: u.role === 'admin' ? 'parent' : 'admin',
                            })
                          }
                        >
                          {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span className="text-muted text-sm" style={{ lineHeight: '30px' }}>Page {page} of {Math.ceil(data.total / 20)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(data.total / 20)}>Next →</button>
        </div>
      )}

      {selectedUser && <SubscriptionModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
