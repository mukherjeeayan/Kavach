import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

interface AdminUser { id: string; name: string; email: string; role: string; }
interface AuthCtx {
  user: AdminUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]   = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => {
        const u = r.data.data.user as AdminUser;
        if (u.role !== 'admin') {
          logout();
        } else {
          setUser(u);
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const accessKey = import.meta.env.VITE_ADMIN_ACCESS_KEY;
    if (!accessKey) throw new Error('Admin panel not configured');

    const res = await api.post('/auth/login', { email, password, access_key: accessKey });
    const { user: u } = res.data.data as { token: string; user: AdminUser };
    if (u.role !== 'admin') throw new Error('Access denied: Admin role required');
    setToken('cookie');
    setUser(u);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
