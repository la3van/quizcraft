import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getMe, loginUser, logoutUser, registerUser } from "../api/users";
import type { AuthUser } from "../api/users";

type FrontendUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
};

type AuthContextType = {
  isLoggedIn: boolean;
  isAuthChecked: boolean;
  user: FrontendUser | null;
  login: (loginValue: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuthUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function mapUser(user: AuthUser): FrontendUser {
  return {
    id: String(user.id),
    name: user.name || user.username || user.email,
    email: user.email || user.username,
    username: user.username,
    avatarUrl: user.avatar_url || "",
  };
}

function readStoredUser(): FrontendUser | null {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function persistUser(user: FrontendUser) {
  try {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("user", JSON.stringify(user));
  } catch {
    // ignore localStorage errors
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
  } catch {
    // ignore localStorage errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [user, setUser] = useState<FrontendUser | null>(() => readStoredUser());
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(readStoredUser()));

  const setAuthUser = (nextUser: AuthUser) => {
    const mappedUser = mapUser(nextUser);
    setUser(mappedUser);
    setIsLoggedIn(true);
    persistUser(mappedUser);
  };

  const refreshUser = async () => {
    const me = await getMe();
    setAuthUser(me);
  };

  useEffect(() => {
    let cancelled = false;

    async function syncAuthWithBackend() {
      try {
        const me = await getMe();
        if (cancelled) return;
        setAuthUser(me);
      } catch {
        if (cancelled) return;
        setUser(null);
        setIsLoggedIn(false);
        clearStoredAuth();
      } finally {
        if (!cancelled) {
          setIsAuthChecked(true);
        }
      }
    }

    syncAuthWithBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (loginValue: string, password: string) => {
    const loggedInUser = await loginUser({ login: loginValue.trim(), password });
    setAuthUser(loggedInUser);
  };

  const register = async (name: string, username: string, email: string, password: string) => {
    const registeredUser = await registerUser({ name: name.trim(), username: username.trim(), email: email.trim(), password });
    setAuthUser(registeredUser);
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // even if backend logout fails, clear frontend auth state
    }

    setIsLoggedIn(false);
    setUser(null);
    clearStoredAuth();
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAuthChecked, user, login, register, logout, refreshUser, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
