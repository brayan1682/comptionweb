import React, { createContext, useContext, useMemo } from "react";
import type { UserReputation } from "../../domain/types";
import { useAuth } from "./AuthProvider";

type ReputationContextValue = {
  reputation: UserReputation | null;
  refresh: () => Promise<void>;
  getByUserId: (userId: string) => Promise<UserReputation | null>;
};

const ReputationContext = createContext<ReputationContextValue | null>(null);

export function ReputationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // ✅ SINGLE SOURCE OF TRUTH: Derivar reputación directamente de users/{userId} del AuthProvider
  // El AuthProvider ya mantiene onSnapshot reactivo sobre users/{userId}
  const reputation: UserReputation | null = useMemo(() => {
    if (!user) return null;

    return {
      userId: user.id,
      xp: user.xp ?? 0,
      level: user.level ?? 1,
      rank: user.rank ?? "Novato",
      trophiesCount: 0, // TODO: Agregar trophiesCount a users/{userId} si es necesario
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString(),
    };
  }, [user]);

  const value = useMemo<ReputationContextValue>(
    () => ({
      reputation,
      refresh: async () => {
        // ✅ NO-OP: El AuthProvider ya mantiene el estado actualizado automáticamente con onSnapshot
        // Este método se mantiene por compatibilidad pero no hace nada
      },
      getByUserId: async (userId: string) => {
        // ✅ Solo permitir leer reputación del usuario autenticado
        if (!user || userId !== user.id) {
          console.warn("[ReputationProvider] getByUserId: intentando leer reputación de otro usuario o sin auth");
          return null;
        }
        // Retornar la reputación derivada del usuario actual
        return reputation;
      }
    }),
    [reputation, user]
  );

  return <ReputationContext.Provider value={value}>{children}</ReputationContext.Provider>;
}

export function useReputation() {
  const ctx = useContext(ReputationContext);
  if (!ctx) throw new Error("useReputation debe usarse dentro de <ReputationProvider />");
  return ctx;
}

