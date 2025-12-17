import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserReputation } from "../../domain/types";
import { reputationService } from "../../services/reputation/reputationService";
import { useAuth } from "./AuthProvider";

type ReputationContextValue = {
  reputation: UserReputation | null;
  refresh: () => Promise<void>;
  getByUserId: (userId: string) => Promise<UserReputation | null>;
};

const ReputationContext = createContext<ReputationContextValue | null>(null);

export function ReputationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [reputation, setReputation] = useState<UserReputation | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) {
        setReputation(null);
        return;
      }
      const rep = await reputationService.getByUserId(user.id);
      setReputation(rep);
    })();
  }, [user?.id]);

  const value = useMemo<ReputationContextValue>(
    () => ({
      reputation,
      refresh: async () => {
        if (!user) {
          setReputation(null);
          return;
        }
        const rep = await reputationService.getByUserId(user.id);
        setReputation(rep);
      },
      getByUserId: async (userId: string) => {
        return reputationService.getByUserId(userId);
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

