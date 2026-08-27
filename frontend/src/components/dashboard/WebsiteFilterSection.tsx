import { useState } from 'react';
import {
  useUrlFilters,
  useCreateUrlFilter,
  useDeleteUrlFilter,
} from '../../hooks/useUrlFilters';
import { SkeletonTable } from '../ui/Skeleton';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

const CATEGORIES = ['Social Media', 'Games', 'Adult', 'Shopping', 'Entertainment', 'Custom'];

export default function WebsiteFilterSection({ childId, onError }: Props) {
  const [url, setUrl] = useState('');
  const [ruleType, setRuleType] = useState<'BLOCK' | 'ALLOW'>('BLOCK');
  const [category, setCategory] = useState('Custom');
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  const { data: rules, isLoading } = useUrlFilters(childId);
  const createRule = useCreateUrlFilter(childId);
  const deleteRule = useDeleteUrlFilter(childId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      await createRule.mutateAsync({ url_pattern: url.trim(), rule_type: ruleType, category });
      setUrl('');
    } catch {
      onError('Failed to add URL rule');
    }
  };

  const handleDelete = async () => {
    if (!showDeleteId) return;
    try {
      await deleteRule.mutateAsync(showDeleteId);
      setShowDeleteId(null);
    } catch {
      onError('Failed to delete URL rule');
    }
  };

  if (isLoading) return <SkeletonTable rows={3} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Website Filtering</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Block or allow specific websites</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL or pattern (e.g., facebook.com)"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as 'BLOCK' | 'ALLOW')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="BLOCK">Block</option>
            <option value="ALLOW">Allow</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createRule.isPending || !url.trim()}
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createRule.isPending ? 'Adding...' : 'Add'}
          </button>
        </form>

        {(rules ?? []).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No website rules configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-medium">URL Pattern</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {(rules ?? []).map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 text-gray-900 dark:text-white font-mono text-xs max-w-[200px] truncate">
                      {rule.url_pattern}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rule.rule_type === 'BLOCK'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {rule.rule_type}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{rule.category || '-'}</td>
                    <td className="py-3">
                      <span className={`w-2 h-2 rounded-full inline-block ${
                        rule.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setShowDeleteId(rule.id)}
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
          title="Delete URL Rule"
          message="Are you sure you want to remove this URL filter rule?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteId(null)}
        />
      )}
    </section>
  );
}
