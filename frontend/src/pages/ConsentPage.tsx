import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConsents, grantConsent, revokeConsent } from '../services/api';
import type { ParentalConsent } from '../types/api';
import Toast from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const CONSENT_TYPES = [
  { value: 'location_tracking', label: 'Location Tracking', description: 'Track the child\'s device location for safety monitoring' },
  { value: 'app_monitoring', label: 'App Usage Monitoring', description: 'Monitor which apps are installed and used' },
  { value: 'web_filtering', label: 'Web Content Filtering', description: 'Filter inappropriate web content' },
  { value: 'screen_time', label: 'Screen Time Limits', description: 'Enforce daily screen time limits' },
  { value: 'communication_logs', label: 'Communication Logs', description: 'Monitor calls and messages for safety' },
  { value: 'self_harm_detection', label: 'Self-Harm Detection', description: 'AI-powered detection of concerning content' },
];

export default function ConsentPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const queryClient = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; consentType: string; action: 'grant' | 'revoke' }>({
    open: false,
    consentType: '',
    action: 'grant',
  });

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ['consents', selectedChild],
    queryFn: () => fetchConsents(selectedChild),
    enabled: !!selectedChild,
  });

  const grantMutation = useMutation({
    mutationFn: (consentType: string) => grantConsent(selectedChild, consentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', selectedChild] });
      setToast({ message: 'Consent granted successfully', type: 'success' });
    },
    onError: (err: unknown) => {
      const error = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to grant consent';
      setToast({ message: error, type: 'error' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (consentType: string) => revokeConsent(selectedChild, consentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', selectedChild] });
      setToast({ message: 'Consent revoked successfully', type: 'success' });
    },
    onError: (err: unknown) => {
      const error = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to revoke consent';
      setToast({ message: error, type: 'error' });
    },
  });

  const getConsentStatus = (consentType: string): ParentalConsent | undefined => {
    return consents.find((c) => c.consent_type === consentType && c.status === 'ACTIVE');
  };

  const handleToggle = (consentType: string, isCurrentlyActive: boolean) => {
    setConfirmDialog({
      open: true,
      consentType,
      action: isCurrentlyActive ? 'revoke' : 'grant',
    });
  };

  const handleConfirm = () => {
    if (confirmDialog.action === 'grant') {
      grantMutation.mutate(confirmDialog.consentType);
    } else {
      revokeMutation.mutate(confirmDialog.consentType);
    }
    setConfirmDialog({ open: false, consentType: '', action: 'grant' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Please log in to manage consent.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Parental Consent Management</h1>
        <p className="text-gray-600 mb-6">
          Manage data collection consents for your children in compliance with DPDP Act requirements.
        </p>

        <div className="mb-6">
          <label htmlFor="child-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Child
          </label>
          <select
            id="child-select"
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select a child --</option>
          </select>
        </div>

        {selectedChild && (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">Loading consents...</div>
            ) : (
              CONSENT_TYPES.map((type) => {
                const activeConsent = getConsentStatus(type.value);
                const isActive = !!activeConsent;

                return (
                  <div key={type.value} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{type.label}</h3>
                      <p className="text-sm text-gray-500">{type.description}</p>
                      {activeConsent && (
                        <p className="text-xs text-gray-400 mt-1">
                          Granted: {new Date(activeConsent.granted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggle(type.value, isActive)}
                      className={`ml-4 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                      }`}
                      aria-label={isActive ? `Revoke ${type.label} consent` : `Grant ${type.label} consent`}
                    >
                      {isActive ? 'Revoke' : 'Grant'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800">About Parental Consent</h3>
          <p className="text-sm text-blue-700 mt-1">
            Under the Digital Personal Data Protection (DPDP) Act, parental consent is required for processing
            children's personal data. You can grant or revoke specific consents at any time. Revoking consent
            will disable the corresponding monitoring feature for your child.
          </p>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.action === 'grant' ? 'Grant Consent' : 'Revoke Consent'}
        message={
          confirmDialog.action === 'grant'
            ? `Are you sure you want to grant ${CONSENT_TYPES.find((t) => t.value === confirmDialog.consentType)?.label} consent?`
            : `Are you sure you want to revoke ${CONSENT_TYPES.find((t) => t.value === confirmDialog.consentType)?.label} consent? This will disable the corresponding monitoring feature.`
        }
        confirmText={confirmDialog.action === 'grant' ? 'Grant' : 'Revoke'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog({ open: false, consentType: '', action: 'grant' })}
      />
    </div>
  );
}
