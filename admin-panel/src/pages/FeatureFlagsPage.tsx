import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

interface FeatureFlag {
  id: string;
  feature_key: string;
  feature_name: string;
  required_tier: string;
  is_enabled: boolean;
  description: string;
}

export default function FeatureFlagsPage() {
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['admin-feature-flags'],
    queryFn: () => api.get('/admin/feature-flags').then((r) => r.data.data as FeatureFlag[]),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      api.patch(`/admin/feature-flags/${id}`, { is_enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feature-flags'] }),
  });

  const tierColors: Record<string, string> = {
    FREE: 'var(--success)',
    TRIAL: 'var(--warning)',
    PREMIUM: 'var(--primary)',
  };

  return (
    <div>
      <h1 className="page-title">Feature Flags</h1>
      <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
        Control which features are available at each subscription tier.
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Key</th>
                  <th>Required Tier</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {flags?.map((flag) => (
                  <tr key={flag.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{flag.feature_name}</div>
                      {flag.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {flag.description}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {flag.feature_key}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${tierColors[flag.required_tier] ?? 'var(--text-muted)'}22`,
                          color: tierColors[flag.required_tier] ?? 'var(--text-muted)',
                        }}
                      >
                        {flag.required_tier}
                      </span>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={flag.is_enabled}
                          onChange={() =>
                            toggleMutation.mutate({ id: flag.id, is_enabled: !flag.is_enabled })
                          }
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                  </tr>
                ))}
                {flags && flags.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No feature flags configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
