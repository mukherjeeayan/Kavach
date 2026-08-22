import { useState } from 'react';
import { useLockActions, useLocks } from '../../hooks/usePhase1Data';
import { useActionsError } from '../../hooks/usePhase1Data';
import { SkeletonList } from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';

const DAY_LABELS = [
  { value: null, label: 'Every day' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface LocksSectionProps {
  childId: string | null;
  onError: (message: string | null) => void;
}

export default function LocksSection({ childId, onError }: LocksSectionProps) {
  const locks = useLocks(childId);
  const actions = useLockActions(childId);
  useActionsError([actions.create, actions.update, actions.remove], onError);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('06:00');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setDayOfWeek(null);
    setStartTime('21:00');
    setEndTime('06:00');
    setShowForm(true);
  };

  const openEdit = (lock: { id: string; day_of_week: number | null; start_time: string; end_time: string }) => {
    setEditingId(lock.id);
    setDayOfWeek(lock.day_of_week);
    setStartTime(lock.start_time);
    setEndTime(lock.end_time);
    setShowForm(true);
  };

  const handleSave = () => {
    const input = { day_of_week: dayOfWeek, start_time: startTime, end_time: endTime };
    if (editingId) {
      actions.update.mutate({ lockId: editingId, input });
    } else {
      actions.create.mutate(input);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      actions.remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Locks</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add lock'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {editingId ? 'Edit lock window' : 'New lock window'}
          </h3>
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">Day</span>
            <select
              value={dayOfWeek ?? ''}
              onChange={(e) =>
                setDayOfWeek(e.target.value === '' ? null : Number(e.target.value))
              }
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
            >
              {DAY_LABELS.map((d) => (
                <option key={d.label} value={d.value ?? ''}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
          </div>
          <button
            onClick={handleSave}
            disabled={actions.create.isPending || actions.update.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {editingId ? 'Update lock' : 'Save lock'}
          </button>
        </div>
      )}

      {locks.isLoading && <SkeletonList items={2} />}

      {!locks.isLoading && (
        <div className="space-y-3">
          {(locks.data ?? []).map((lock) => {
            const day = DAY_LABELS.find((d) => d.value === lock.day_of_week)?.label ?? 'Every day';
            return (
              <div
                key={lock.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {lock.start_time} – {lock.end_time}
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{day}</span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{lock.is_active ? 'Active' : 'Disabled'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(lock)}
                    disabled={actions.update.isPending}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      actions.update.mutate({
                        lockId: lock.id,
                        input: {
                          day_of_week: lock.day_of_week,
                          start_time: lock.start_time,
                          end_time: lock.end_time,
                          is_active: !lock.is_active,
                        },
                      })
                    }
                    disabled={actions.update.isPending}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {lock.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setDeleteId(lock.id)}
                    disabled={actions.remove.isPending}
                    className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {(locks.data ?? []).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No lock windows yet. During a window the device only allows the launcher and settings.
              </p>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Lock"
          message="Are you sure you want to delete this lock window? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </section>
  );
}