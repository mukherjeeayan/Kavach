import type { ChildProfile } from '../../types/api';

interface ChildSelectorProps {
  children: ChildProfile[];
  selectedChildId: string | null;
  isLoading: boolean;
  isError: boolean;
  onSelect: (childId: string) => void;
}

export default function ChildSelector({
  children,
  selectedChildId,
  isLoading,
  isError,
  onSelect,
}: ChildSelectorProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Children</h2>
      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {isError && <p className="text-sm text-red-500">Failed to load children.</p>}
      {children.length === 0 && (
        <p className="text-sm text-gray-500">
          No child profiles yet. Add one on the child&apos;s device during setup.
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
    </section>
  );
}
