import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adminApi, STAFF_SESSION_EXPIRED_EVENT, type AdminUser } from "./api";

interface AuthValue {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi.session().then(({ user: current }) => active && setUser(current)).catch(() => {}).finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener(STAFF_SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(STAFF_SESSION_EXPIRED_EVENT, expire);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: current } = await adminApi.login(email, password);
    setUser(current);
  }, []);

  const logout = useCallback(async () => {
    try { await adminApi.logout(); } finally { setUser(null); }
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
