import { useState } from 'react';
import { useLockActions, useLocks } from '../../hooks/usePhase1Data';
import { useActionsError } from '../../hooks/usePhase1Data';

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

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Scheduled Locks</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add lock'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg p-4 border mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            {editingId ? 'Edit lock window' : 'New lock window'}
          </h3>
          <label className="block">
            <span className="text-sm text-gray-600">Day</span>
            <select
              value={dayOfWeek ?? ''}
              onChange={(e) =>
                setDayOfWeek(e.target.value === '' ? null : Number(e.target.value))
              }
              className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
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
              <span className="text-sm text-gray-600">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            onClick={handleSave}
            disabled={actions.create.isPending || actions.update.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {editingId ? 'Update lock' : 'Save lock'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(locks.data ?? []).map((lock) => {
          const day = DAY_LABELS.find((d) => d.value === lock.day_of_week)?.label ?? 'Every day';
          return (
            <div
              key={lock.id}
              className="bg-white rounded-lg p-4 border flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium">
                  {lock.start_time} – {lock.end_time}
                  <span className="ml-2 text-sm text-gray-500">{day}</span>
                </p>
                <p className="text-sm text-gray-500">{lock.is_active ? 'Active' : 'Disabled'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(lock)}
                  disabled={actions.update.isPending}
                  className="px-3 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
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
                  className="px-3 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {lock.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => actions.remove.mutate(lock.id)}
                  disabled={actions.remove.isPending}
                  className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {(locks.data ?? []).length === 0 && (
          <p className="text-sm text-gray-400">
            No lock windows yet. During a window the device only allows the launcher and settings.
          </p>
        )}
      </div>
    </section>
  );
}