import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useStore } from "../Layout";
import { PageLoader } from "../components/Skeleton";

interface AccessState {
  permissions: Set<string>;
  fields: Record<string, Record<string, { view: boolean; edit: boolean }>>;
  loading: boolean;
  refresh: () => void;
}

const AccessContext = createContext<AccessState>({ permissions: new Set(), fields: {}, loading: true, refresh: () => {} });

export function AccessProvider({ children }: { children: ReactNode }) {
  const { store } = useStore();
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedStoreId, setLoadedStoreId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [fields, setFields] = useState<AccessState["fields"]>({});
  useEffect(() => {
    let active = true;
    if (!store) { setPermissions([]); setFields({}); setLoadedStoreId(null); setLoading(false); return; }
    setLoading(true);
    api.effectiveAccess(store.id).then((result) => {
      if (active) { setPermissions(result.permissions); setFields(result.field_permissions); }
    }).catch(() => { if (active) { setPermissions([]); setFields({}); } }).finally(() => {
      if (active) { setLoadedStoreId(store.id); setLoading(false); }
    });
    return () => { active = false; };
  }, [store?.id, version]);
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const accessLoading = loading || Boolean(store && loadedStoreId !== store.id);
  const value = useMemo(() => ({ permissions: permissionSet, fields, loading: accessLoading, refresh }), [accessLoading, fields, permissionSet, refresh]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useEffectivePermissions() { return useContext(AccessContext); }
export function usePermission(permission: string) {
  const access = useEffectivePermissions();
  return { allowed: access.permissions.has(permission), loading: access.loading };
}
export function PermissionGate({ permission, children, fallback = null }: { permission: string; children: ReactNode; fallback?: ReactNode }) {
  const { allowed, loading } = usePermission(permission);
  return <>{loading ? null : allowed ? children : fallback}</>;
}
export function ProtectedAdminRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const { allowed, loading } = usePermission(permission);
  const location = useLocation();
  if (loading) return <div className="card"><PageLoader /></div>;
  if (!allowed) return <Navigate to="/" replace state={{ forbiddenFrom: location.pathname }} />;
  return <>{children}</>;
}
