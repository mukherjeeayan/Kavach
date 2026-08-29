import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChildren } from '../hooks/useChildrenData';
import CommunicationSection from '../components/dashboard/CommunicationSection';
import { SkeletonList } from '../components/ui/Skeleton';

export default function CommunicationsPage() {
  const { data: children, isLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const childId = selectedChildId ?? children?.[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">SafeGuard</Link>
          <Link to="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Communications</h1>
          {children && children.length > 1 && (
            <select
              value={childId ?? ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading && <SkeletonList items={3} />}

        {!isLoading && !childId && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No children found. Add a child first.</p>
          </div>
        )}

        {childId && <CommunicationSection childId={childId} />}
      </main>
    </div>
  );
}
