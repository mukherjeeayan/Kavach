import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChildren, useCreateChild } from '../hooks/useChildrenData';
import { useDevices } from '../hooks/useChildrenData';
import { useChildAlerts } from '../hooks/usePhase1Data';
import { updateChild, deleteChild } from '../services/api';
import { SkeletonList } from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function ManageChildPage() {
  const { data: children, isLoading } = useChildren();
  const createChild = useCreateChild();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const selectedChild = children?.find((c) => c.id === selectedId);
  const devicesQuery = useDevices(selectedId);
  const alertsQuery = useChildAlerts(selectedId);

  const handleStartEdit = () => {
    if (!selectedChild) return;
    setEditName(selectedChild.name);
    setEditBirthDate(selectedChild.birth_date ?? '');
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    try {
      await updateChild(selectedId, { name: editName, birth_date: editBirthDate || undefined });
      setEditMode(false);
      setToast({ message: 'Child updated successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update child', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deleteChild(selectedId);
      setSelectedId(null);
      setConfirmDelete(false);
      setToast({ message: 'Child deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete child', type: 'error' });
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;
    try {
      await createChild.mutateAsync({ name: newChildName.trim() });
      setNewChildName('');
      setShowAddForm(false);
      setToast({ message: 'Child added successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to add child', type: 'error' });
    }
  };

  function calculateAge(birthDate: string | null): string {
    if (!birthDate) return 'Unknown';
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    if (months < 0) return `${years - 1}y ${12 + months}m`;
    return `${years}y ${months}m`;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">SafeGuard</Link>
          <Link to="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Children</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Child'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddChild} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-3">
            <input
              type="text"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              placeholder="Child name"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
            <button
              type="submit"
              disabled={createChild.isPending || !newChildName.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createChild.isPending ? 'Adding...' : 'Add'}
            </button>
          </form>
        )}

        {isLoading && <SkeletonList items={3} />}

        {!isLoading && (!children || children.length === 0) && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No children registered yet.</p>
          </div>
        )}

        {!isLoading && children && children.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Children list */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Children ({children.length})</h2>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {children.map((child) => (
                  <li key={child.id}>
                    <button
                      onClick={() => { setSelectedId(child.id); setEditMode(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        selectedId === child.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-primary' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{child.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Age: {calculateAge(child.birth_date)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Child detail */}
            <div className="md:col-span-2 space-y-4">
              {!selectedChild ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400">Select a child to view details</p>
                </div>
              ) : (
                <>
                  {/* Profile card */}
                  <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedChild.name}</h3>
                      <div className="flex gap-2">
                        {editMode ? (
                          <>
                            <button onClick={handleSaveEdit} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors">Save</button>
                            <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 transition-colors">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={handleStartEdit} className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 transition-colors">Edit</button>
                            <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">{selectedChild.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Age</label>
                        {editMode ? (
                          <input
                            type="date"
                            value={editBirthDate}
                            onChange={(e) => setEditBirthDate(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">{calculateAge(selectedChild.birth_date)}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Screen Time Limit</label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {selectedChild.daily_screen_time_limit_minutes
                            ? `${selectedChild.daily_screen_time_limit_minutes} min/day`
                            : 'No limit set'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Registered</label>
                        <p className="text-sm text-gray-900 dark:text-white">{new Date(selectedChild.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </section>

                  {/* Devices */}
                  <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Devices {devicesQuery.data ? `(${devicesQuery.data.length})` : ''}
                    </h3>
                    {devicesQuery.isLoading && <SkeletonList items={1} />}
                    {devicesQuery.data && devicesQuery.data.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No devices registered.</p>
                    )}
                    {devicesQuery.data && devicesQuery.data.length > 0 && (
                      <div className="space-y-2">
                        {devicesQuery.data.map((d) => (
                          <div key={d.device_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{d.device_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{d.device_type} &middot; {d.os_version ?? 'Unknown OS'}</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.admin_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {d.admin_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Recent alerts */}
                  <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Alerts</h3>
                    {alertsQuery.isLoading && <SkeletonList items={2} />}
                    {alertsQuery.data && alertsQuery.data.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No alerts.</p>
                    )}
                    {alertsQuery.data && alertsQuery.data.length > 0 && (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {alertsQuery.data.slice(0, 5).map((alert, i) => (
                          <li key={`${alert.id}-${i}`} className="py-2">
                            <p className="text-sm text-gray-900 dark:text-white">{alert.action.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(alert.created_at).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {confirmDelete && selectedChild && (
        <ConfirmDialog
          title={`Delete ${selectedChild.name}?`}
          message="This action cannot be undone. All data for this child will be permanently removed."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
