import type { AppBlockRule } from '../../types/api';

interface BlockedAppsTableProps {
  rules: AppBlockRule[];
}

export default function BlockedAppsTable({ rules }: BlockedAppsTableProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Blocked Apps</h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">App</th>
              <th className="px-4 py-2">Package</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Unblock Request</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t">
                <td className="px-4 py-2">{rule.app_name ?? rule.package_name}</td>
                <td className="px-4 py-2 font-mono text-xs">{rule.package_name}</td>
                <td className="px-4 py-2 text-gray-500">{rule.block_reason ?? '—'}</td>
                <td className="px-4 py-2">
                  {rule.unblock_requested ? (
                    <span className="text-amber-600 font-medium">Pending</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No blocked apps yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
