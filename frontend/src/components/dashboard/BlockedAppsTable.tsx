import { useState } from 'react';
import { useSetAppDailyLimit } from '../../hooks/useChildrenData';
import type { AppBlockRule } from '../../types/api';

interface BlockedAppsTableProps {
  rules: AppBlockRule[];
  childId: string | null;
}

export default function BlockedAppsTable({ rules, childId }: BlockedAppsTableProps) {
  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Blocked Apps</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-left text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">App</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Package</th>
                <th className="px-4 py-2 font-medium">Daily limit</th>
                <th className="px-4 py-2 font-medium hidden md:table-cell">Unblock Request</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <LimitRow key={rule.id} rule={rule} childId={childId} />
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No blocked apps yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LimitRow({ rule, childId }: { rule: AppBlockRule; childId: string | null }) {
  const [input, setInput] = useState(rule.daily_limit_minutes?.toString() ?? '');
  const saveLimit = useSetAppDailyLimit(childId);

  const handleSave = () => {
    const parsed = Number(input);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1440) return;
    saveLimit.mutate({ ruleId: rule.id, dailyLimitMinutes: parsed });
  };

  const handleClear = () => {
    setInput('');
    saveLimit.mutate({ ruleId: rule.id, dailyLimitMinutes: null });
  };

  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{rule.app_name ?? rule.package_name}</td>
      <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">{rule.package_name}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min={0}
            max={1440}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="No limit"
            className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm w-20 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
          />
          <button
            onClick={handleSave}
            disabled={saveLimit.isPending}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saveLimit.isPending ? 'Saving...' : 'Set'}
          </button>
          <button
            onClick={handleClear}
            disabled={saveLimit.isPending}
            className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Clear
          </button>
          {rule.daily_limit_minutes != null && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              {rule.daily_limit_minutes} min/day
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 hidden md:table-cell">
        {rule.unblock_requested ? (
          <span className="text-amber-600 dark:text-amber-400 font-medium">Pending</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}