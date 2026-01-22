import React, { createContext, useContext, useMemo } from "react";
import { userDataService } from "../../services/userData/userDataService";
import { useAuth } from "./AuthProvider";

type UserDataContextValue = {
  saveQuestion: (questionId: string) => Promise<void>;
  unsaveQuestion: (questionId: string) => Promise<void>;
  isQuestionSaved: (questionId: string) => Promise<boolean>;
  getSavedQuestions: () => Promise<string[]>;
  followQuestion: (questionId: string) => Promise<void>;
  unfollowQuestion: (questionId: string) => Promise<void>;
  isQuestionFollowed: (questionId: string) => Promise<boolean>;
  getFollowedQuestions: () => Promise<string[]>;
};

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();

  const value = useMemo<UserDataContextValue>(
    () => ({
      saveQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.saveQuestion(user.id, questionId);
        // ✅ Refrescar usuario para actualizar contadores en la UI
        try {
          await refreshUser();
        } catch (err) {
          console.warn("[UserDataProvider] No se pudo refrescar usuario después de guardar:", err);
        }
      },
      unsaveQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.unsaveQuestion(user.id, questionId);
        // ✅ Refrescar usuario para actualizar contadores en la UI
        try {
          await refreshUser();
        } catch (err) {
          console.warn("[UserDataProvider] No se pudo refrescar usuario después de desguardar:", err);
        }
      },
      isQuestionSaved: async (questionId: string) => {
        if (!user) return false;
        try {
          return await userDataService.isQuestionSaved(user.id, questionId);
        } catch (err: any) {
          const errorCode = err?.code || "unknown";
          // ✅ Solo loggear si no es permission-denied esperado (cuando no hay auth)
          if (errorCode !== "permission-denied") {
            console.warn(`[UserDataProvider] ⚠️ Error verificando isQuestionSaved: ${errorCode} - ${err?.message || err}`);
          }
          return false; // ✅ Fallback a false sin romper UI
        }
      },
      getSavedQuestions: async () => {
        if (!user) return [];
        return userDataService.getSavedQuestions(user.id);
      },
      followQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.followQuestion(user.id, questionId);
        // ✅ Refrescar usuario para actualizar contadores en la UI
        try {
          await refreshUser();
        } catch (err) {
          console.warn("[UserDataProvider] No se pudo refrescar usuario después de seguir:", err);
        }
      },
      unfollowQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.unfollowQuestion(user.id, questionId);
        // ✅ Refrescar usuario para actualizar contadores en la UI
        try {
          await refreshUser();
        } catch (err) {
          console.warn("[UserDataProvider] No se pudo refrescar usuario después de dejar de seguir:", err);
        }
      },
      isQuestionFollowed: async (questionId: string) => {
        if (!user) return false;
        try {
          return await userDataService.isQuestionFollowed(user.id, questionId);
        } catch (err: any) {
          const errorCode = err?.code || "unknown";
          // ✅ Solo loggear si no es permission-denied esperado (cuando no hay auth)
          if (errorCode !== "permission-denied") {
            console.warn(`[UserDataProvider] ⚠️ Error verificando isQuestionFollowed: ${errorCode} - ${err?.message || err}`);
          }
          return false; // ✅ Fallback a false sin romper UI
        }
      },
      getFollowedQuestions: async () => {
        if (!user) return [];
        return userDataService.getFollowedQuestions(user.id);
      }
    }),
    [user, refreshUser]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData debe usarse dentro de <UserDataProvider />");
  return ctx;
}

