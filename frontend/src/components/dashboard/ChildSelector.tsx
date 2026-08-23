import { memo, useState } from 'react';
import type { ChildProfile } from '../../types/api';

interface ChildSelectorProps {
  children: ChildProfile[];
  selectedChildId: string | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (childId: string) => void;
  onAddChild: (name: string, birthDate: string) => Promise<unknown>;
  isAddingChild: boolean;
  addChildError: string | null;
}

export default memo(function ChildSelector({
  children,
  selectedChildId,
  isLoading,
  isError,
  onSelect,
  onAddChild,
  isAddingChild,
  addChildError,
}: ChildSelectorProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await onAddChild(name.trim(), birthDate);
      setName('');
      setBirthDate('');
      setShowForm(false);
    } catch {
      // Error is surfaced via addChildError.
    }
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Children</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add child'}
        </button>
      </div>
      {isLoading && (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load children.</p>
        </div>
      )}
      {children.length === 0 && !isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No child profiles yet. Add one here or on the child's device during setup.
          </p>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelect(child.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              child.id === selectedChildId
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {child.name}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600 dark:text-gray-400">Birth date</span>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </label>
          </div>
          {addChildError && (
            <p className="text-sm text-red-500" role="alert">
              {addChildError}
            </p>
          )}
          <button
            onClick={handleAdd}
            disabled={isAddingChild || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isAddingChild ? 'Adding...' : 'Save child'}
          </button>
        </div>
      )}
    </section>
  );
});