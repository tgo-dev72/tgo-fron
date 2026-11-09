import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { customerAuth, CUSTOMER_SESSION_EXPIRED_EVENT } from "../api/client";
import type { Customer, CustomerRegistration, RegistrationPending } from "../api/client";
import { AuthError } from "../api/client";

/**
 * Customer session state for one store. The session lives in the tenant-scoped
 * httpOnly cookies set by the API — the storefront never stores tokens. On
 * mount the session is silently re-validated against /api/auth/me/ and the
 * user is treated as a guest if the cookie is missing or expired.
 */

export type AuthStatus = "loading" | "authenticated" | "guest";

export interface AuthContextValue {
  user: Customer | null;
  status: AuthStatus;
  /** Token for the authenticated session (always null — cookies handle it). */
  token: string | null;
  login(email: string, password: string): Promise<void>;
  register(input: CustomerRegistration): Promise<RegistrationPending>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  updateProfile(input: Partial<Customer>): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  slug: _slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [user, setUser] = useState<Customer | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const expire = () => { setUser(null); setStatus("guest"); };
    window.addEventListener(CUSTOMER_SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(CUSTOMER_SESSION_EXPIRED_EVENT, expire);
  }, []);

  // Re-validate the cookie session against the API on mount.
  useEffect(() => {
    let active = true;
    customerAuth
      .me()
      .then((customer) => {
        if (!active) return;
        setUser(customer);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const customer = await customerAuth.login(email, password);
    setUser(customer);
    setStatus("authenticated");
  }, []);

  const register = useCallback((input: CustomerRegistration) => customerAuth.register(input), []);

  const verifyEmail = useCallback(async (token: string) => {
    const customer = await customerAuth.verifyEmail(token);
    setUser(customer);
    setStatus("authenticated");
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await customerAuth.resendVerification(email);
  }, []);

  const updateProfile = useCallback(async (input: Partial<Customer>) => {
    const customer = await customerAuth.updateProfile(input);
    setUser(customer);
  }, []);

  const logout = useCallback(async () => {
    try {
      await customerAuth.logout();
    } catch {
      // Session may already be gone server-side; sign out locally regardless.
    }
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: null,
      status,
      login,
      register,
      verifyEmail,
      resendVerification,
      updateProfile,
      logout,
    }),
    [user, status, login, register, verifyEmail, resendVerification, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const GUEST: AuthContextValue = {
  user: null,
  token: null,
  status: "guest",
  login: () => Promise.reject(new Error("AuthProvider not mounted")),
  register: () => Promise.reject(new Error("AuthProvider not mounted")),
  verifyEmail: () => Promise.reject(new Error("AuthProvider not mounted")),
  resendVerification: () => Promise.reject(new Error("AuthProvider not mounted")),
  updateProfile: () => Promise.reject(new Error("AuthProvider not mounted")),
  logout: () => Promise.resolve(),
};

/** Customer session for the current store. Falls back to a guest singleton. */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? GUEST;
}

/** Distinguishes the two 4xx auth failures so forms can show specific hints. */
export function authErrorHint(err: unknown): "invalid" | "taken" | "verification" | "generic" {
  if (err instanceof AuthError) {
    if (err.code === "verification_required") return "verification";
    if (err.status === 401) return "invalid";
    if (err.status === 409) return "taken";
  }
  return "generic";
}
