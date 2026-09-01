import { useQuery } from '@tanstack/react-query';
import api from '../api';

interface Stats {
  total_users: number;
  free_users: number;
  active_trial_users: number;
  expired_trial_users: number;
  premium_users: number;
  admin_users: number;
  new_users_7d: number;
  new_users_30d: number;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data.data as Stats),
    refetchInterval: 30_000,
  });

  const statCards = data ? [
    { value: data.total_users,         label: 'Total Users',          color: '#6c63ff' },
    { value: data.premium_users,       label: 'Premium',              color: '#22c55e' },
    { value: data.active_trial_users,  label: 'Active Trials',        color: '#f59e0b' },
    { value: data.expired_trial_users, label: 'Expired Trials',       color: '#ef4444' },
    { value: data.free_users,          label: 'Free',                  color: '#8b94a3' },
    { value: data.new_users_7d,        label: 'New (7 days)',          color: '#06b6d4' },
    { value: data.new_users_30d,       label: 'New (30 days)',         color: '#818cf8' },
    { value: data.admin_users,         label: 'Admins',               color: '#f43f5e' },
  ] : [];

  return (
    <div>
      <h1 className="page-title">📊 Dashboard</h1>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {statCards.map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="value" style={{ color: s.color }}>{s.value?.toLocaleString()}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Subscription Breakdown</div>
            {data && (
              <div style={{ position: 'relative', height: 12, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
                {(() => {
                  const total = data.total_users || 1;
                  const premPct  = (data.premium_users      / total) * 100;
                  const trialPct = (data.active_trial_users / total) * 100;
                  const freePct  = (data.free_users          / total) * 100;
                  return (
                    <>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${premPct}%`, background: 'var(--primary)' }} />
                      <div style={{ position: 'absolute', left: `${premPct}%`, top: 0, bottom: 0, width: `${trialPct}%`, background: 'var(--warning)' }} />
                      <div style={{ position: 'absolute', left: `${premPct + trialPct}%`, top: 0, bottom: 0, width: `${freePct}%`, background: 'var(--border)' }} />
                    </>
                  );
                })()}
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--primary)' }}>■ Premium ({data?.premium_users})</span>
              <span style={{ color: 'var(--warning)' }}>■ Trial ({data?.active_trial_users})</span>
              <span style={{ color: 'var(--text-muted)' }}>■ Free ({data?.free_users})</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
