import { useState } from 'react';
import { useIntegrations, useCreateIntegration, useDeleteIntegration, useSyncIntegration } from '../../hooks/useIntegrations';
import { SkeletonList } from '../ui/Skeleton';
import type { IntegrationConfig } from '../../services/api';

interface Props {
  onError: (msg: string | null) => void;
}

const typeLabels: Record<string, string> = {
  SCHOOL_PORTAL: 'School Portal',
  CALENDAR: 'Calendar',
  HEALTH_APP: 'Health App',
  CUSTOM: 'Custom',
};

const typeIcons: Record<string, string> = {
  SCHOOL_PORTAL: 'M12 14l9-5-9-5-9 5 9 5z',
  CALENDAR: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  HEALTH_APP: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  CUSTOM: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
};

export default function IntegrationsSection({ onError }: Props) {
  const { data: integrations, isLoading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const syncIntegration = useSyncIntegration();

  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState('CUSTOM');
  const [newName, setNewName] = useState('');

  if (isLoading) return <SkeletonList items={2} />;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createIntegration.mutateAsync({ integration_type: newType, name: newName.trim() });
      setShowForm(false);
      setNewName('');
      setNewType('CUSTOM');
    } catch {
      onError('Failed to create integration');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIntegration.mutateAsync(id);
    } catch {
      onError('Failed to delete integration');
    }
  };

  const handleSync = async (id: string) => {
    try {
      await syncIntegration.mutateAsync(id);
    } catch {
      onError('Failed to sync integration');
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Integrations</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(integrations ?? []).length} connected
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {showForm && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="SCHOOL_PORTAL">School Portal</option>
                <option value="CALENDAR">Calendar</option>
                <option value="HEALTH_APP">Health App</option>
                <option value="CUSTOM">Custom</option>
              </select>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Integration name"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || createIntegration.isPending}
                className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                {createIntegration.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {(integrations ?? []).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No integrations configured.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(integrations ?? []).map((intg) => (
              <IntegrationCard
                key={intg.id}
                integration={intg}
                onDelete={handleDelete}
                onSync={handleSync}
                isSyncing={syncIntegration.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function IntegrationCard({
  integration,
  onDelete,
  onSync,
  isSyncing,
}: {
  integration: IntegrationConfig;
  onDelete: (id: string) => void;
  onSync: (id: string) => void;
  isSyncing: boolean;
}) {
  const iconPath = typeIcons[integration.integration_type] ?? typeIcons.CUSTOM;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{integration.name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            integration.is_active
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {integration.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {typeLabels[integration.integration_type]}
          {integration.last_sync_at && ` - Last synced ${new Date(integration.last_sync_at).toLocaleString()}`}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSync(integration.id)}
          disabled={isSyncing || !integration.is_active}
          className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-40 transition-colors"
        >
          Sync
        </button>
        <button
          onClick={() => onDelete(integration.id)}
          className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
