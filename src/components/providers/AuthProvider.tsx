"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { account, teams } from "@/lib/appwrite";
import { Models } from "appwrite";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  team: Models.Team<Models.Preferences> | null;
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
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [team, setTeam] = useState<Models.Team<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await account.get();
        setUser(currentUser);

        try {
          const userTeams = await teams.list();
          if (userTeams.teams.length > 0) {
            setTeam(userTeams.teams[0]);
          }
        } catch (teamError) {
          console.error("No team found or error fetching team", teamError);
        }
      } catch {
        setUser(null);
        setTeam(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const logout = async () => {
    await account.deleteSession("current");
    setUser(null);
    setTeam(null);
  };

  return (
    <AuthContext.Provider value={{ user, team, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
