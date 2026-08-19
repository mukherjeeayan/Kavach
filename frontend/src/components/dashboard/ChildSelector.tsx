import { useState } from 'react';
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

export default function ChildSelector({
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
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Children</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add child'}
        </button>
      </div>
      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {isError && <p className="text-sm text-red-500">Failed to load children.</p>}
      {children.length === 0 && !isLoading && (
        <p className="text-sm text-gray-500">
          No child profiles yet. Add one here or on the child&apos;s device during setup.
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelect(child.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              child.id === selectedChildId
                ? 'bg-primary text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border'
            }`}
          >
            {child.name}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg p-4 border mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav"
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Birth date</span>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm"
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
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isAddingChild ? 'Adding…' : 'Save child'}
          </button>
        </div>
      )}
    </section>
  );
}