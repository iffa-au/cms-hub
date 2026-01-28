"use client";
import { User } from "@/types";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const res = await (
        await import("@/lib/fetch-util")
      ).postData<{
        message: string;
        user: User;
        accessToken: string;
      }>("/auth/login", { email, password });
      if (res?.accessToken) {
        localStorage.setItem("token", res.accessToken);
        setIsAuthenticated(true);
      }
      if (res?.user) {
        setUser(res.user);
        // Persist user details so we can restore on refresh
        try {
          localStorage.setItem("user", JSON.stringify(res.user));
        } catch {
          // ignore storage errors
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(Boolean(token));
    // Restore user from localStorage if available
    if (token) {
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored) as User;
          setUser(parsed);
        }
      } catch {
        // If parsing fails, clear bad data
        localStorage.removeItem("user");
      }
    }
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("force-logout", handler);
    return () => window.removeEventListener("force-logout", handler);
  }, []);

  const values = { user, isAuthenticated, isLoading, login, logout };

  return <AuthContext.Provider value={values}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
