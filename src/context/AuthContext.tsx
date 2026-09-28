import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { DEMO_ACCOUNTS, ROLE_LABEL, USERS } from "@/data/catalog";
import type { Role } from "@/types";

const SESSION_KEY = "recruitflow.session";

interface Session {
  email: string;
  userId: string;
  name: string;
  role: Role;
}

interface AuthValue {
  session: Session | null;
  previewRole: Role;
  roleLabel: string;
  login: (email: string, password: string, remember: boolean) => string | null;
  logout: () => void;
  setPreviewRole: (role: Role) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.email && parsed.userId && parsed.role) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [previewRole, setPreviewRole] = useState<Role>("administrator");

  const value = useMemo<AuthValue>(
    () => ({
      session,
      previewRole,
      roleLabel: ROLE_LABEL[previewRole],
      login: (email, password, remember) => {
        const account = DEMO_ACCOUNTS.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
        const user = USERS.find((item) => item.id === account?.userId);
        if (!account || !user) return "Invalid email or password.";
        const next = { email: user.email, userId: user.id, name: user.name, role: user.role };
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        const store = remember ? localStorage : sessionStorage;
        store.setItem(SESSION_KEY, JSON.stringify(next));
        setSession(next);
        setPreviewRole(user.role);
        return null;
      },
      logout: () => {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
      },
      setPreviewRole,
    }),
    [previewRole, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
