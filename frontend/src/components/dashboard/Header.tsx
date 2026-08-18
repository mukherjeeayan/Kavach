import type { AuthUser } from '../../types/api';

interface HeaderProps {
  user: AuthUser | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">SafeGuard Parent Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.name ?? ''}</span>
          <button onClick={onLogout} className="text-sm text-gray-600 hover:text-primary">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
