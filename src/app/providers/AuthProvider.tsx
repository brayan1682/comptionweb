import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "../../domain/types";
import type { LoginInput, RegisterInput } from "../../services/auth/AuthRepository";
import { authService } from "../../services/auth/authService";
import { questionsService } from "../../services/questions/questionsService";

type AuthContextValue = {
  user: User | null;
  isReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  updateProfile: (input: { name: string }) => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((u) => {
      setUser(u);
      setIsReady(true);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      login: async (input) => {
        await authService.login(input);
      },
      register: async (input) => {
        await authService.register(input);
      },
      updateProfile: async (input) => {
        const updated = await authService.updateProfile(input);
        // Mantener coherencia: actualizar nombre denormalizado en preguntas/respuestas
        await questionsService.syncAuthorName(updated.id, updated.name);
      },
      changePassword: async (input) => {
        await authService.changePassword(input);
      },
      logout: async () => {
        await authService.logout();
      }
    }),
    [user, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider />");
  return ctx;
}


