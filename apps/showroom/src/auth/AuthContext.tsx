import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { platform, ApiError, MERCHANT_SESSION_EXPIRED_EVENT, type PlatformUser } from "../api/platform";

export interface AuthUser {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phoneNumber: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  preferredLanguage: "en" | "fr" | "ar";
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string; confirmEmail: string; password: string; confirmPassword: string; firstName: string;
    lastName: string; phoneNumber: string;
    preferredLanguage: "en" | "fr" | "ar"; termsAccepted: boolean;
  }) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toUser(u: PlatformUser): AuthUser {
  return {
    email: u.email,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email.split("@")[0],
    firstName: u.first_name || "",
    lastName: u.last_name || "",
    businessName: u.business_name || "",
    phoneNumber: u.phone_number || "",
    emailVerified: Boolean(u.email_verified),
    phoneVerified: Boolean(u.phone_verified),
    preferredLanguage: u.preferred_language || "en",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await platform.initSession();
        if (!cancelled && result?.user) setUser(toUser(result.user));
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener(MERCHANT_SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(MERCHANT_SESSION_EXPIRED_EVENT, expire);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await platform.loginAndInitCsrf(email, password);
    setUser(toUser(u));
  }, []);

  const signup = useCallback(async (input: {
    email: string; confirmEmail: string; password: string; confirmPassword: string; firstName: string;
    lastName: string; phoneNumber: string;
    preferredLanguage: "en" | "fr" | "ar"; termsAccepted: boolean;
  }) => {
    await platform.register({
      email: input.email,
      confirm_email: input.confirmEmail,
      password: input.password,
      confirm_password: input.confirmPassword,
      first_name: input.firstName,
      last_name: input.lastName,
      phone_number: input.phoneNumber,
      preferred_language: input.preferredLanguage,
      terms_accepted: input.termsAccepted,
    });
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await platform.resendVerification(email);
  }, []);

  const logout = useCallback(async () => {
    try {
      await platform.logout();
    } catch {
      /* ignore network errors on logout */
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, resendVerification, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
