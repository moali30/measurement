"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getServerUser, serverLogout } from "@/app/actions/auth";

interface UserData {
  $id: string;
  name: string;
  email: string;
  registration: string;
}

interface AuthContextType {
  user: UserData | null;
  team: null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  team: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Use Server Action to check auth - no direct Appwrite connection!
        const result = await getServerUser();
        if (result.success && result.user) {
          setUser(result.user as UserData);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const logout = async () => {
    await serverLogout();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, team: null, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
