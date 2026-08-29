import { useState } from 'react';
import {
  useKeywords,
  useCreateKeyword,
  useDeleteKeyword,
} from '../../hooks/useKeywords';
import { SkeletonTable } from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';
import type { KeywordDictEntry } from '../../types/api';

const CATEGORIES = [
  { value: 'violence', label: 'Violence' },
  { value: 'bullying', label: 'Bullying' },
  { value: 'drugs', label: 'Drugs' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'self_harm', label: 'Self Harm' },
] as const;

const SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const CATEGORY_BADGE: Record<string, string> = {
  violence: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  bullying: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  drugs: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  grooming: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  self_harm: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface Props {
  onError: (msg: string | null) => void;
}

export default function KeywordDictionarySection({ onError }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('violence');
  const [severity, setSeverity] = useState<string>('medium');
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError } = useKeywords();
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  const entries: KeywordDictEntry[] = data?.data ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    try {
      await createKeyword.mutateAsync({
        category,
        keyword: keyword.trim(),
        severity,
      });
      setKeyword('');
      setShowForm(false);
    } catch {
      onError('Failed to add keyword');
    }
  };

  const handleDelete = async () => {
    if (!showDeleteId) return;
    try {
      await deleteKeyword.mutateAsync(showDeleteId);
      setShowDeleteId(null);
    } catch {
      onError('Failed to delete keyword');
    }
  };

  if (isLoading) return <SkeletonTable rows={3} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Dictionary</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage monitored keywords and their severity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Add Keyword'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              Failed to load keyword dictionary. Please try refreshing the page.
            </p>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter keyword or phrase"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createKeyword.isPending || !keyword.trim()}
              className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createKeyword.isPending ? 'Adding...' : 'Save'}
            </button>
          </form>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No keywords configured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-medium">Keyword</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 text-gray-900 dark:text-white font-medium">
                      {entry.keyword}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_BADGE[entry.category] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        SEVERITY_BADGE[entry.severity] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {entry.severity}
                      </span>
                    </td>
                    <td className="py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entry.is_active}
                          readOnly
                          className="sr-only peer"
                        />
                        <span
                          aria-hidden="true"
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            entry.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              entry.is_active ? 'translate-x-4' : ''
                            }`}
                          />
                        </span>
                      </label>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setShowDeleteId(entry.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeleteId && (
        <ConfirmDialog
          title="Delete Keyword"
          message="Are you sure you want to remove this keyword from the dictionary?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteId(null)}
        />
      )}
    </section>
  );
}
