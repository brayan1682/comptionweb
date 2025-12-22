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
  const { user } = useAuth();

  const value = useMemo<UserDataContextValue>(
    () => ({
      saveQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.saveQuestion(user.id, questionId);
      },
      unsaveQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.unsaveQuestion(user.id, questionId);
      },
      isQuestionSaved: async (questionId: string) => {
        if (!user) return false;
        return userDataService.isQuestionSaved(user.id, questionId);
      },
      getSavedQuestions: async () => {
        if (!user) return [];
        return userDataService.getSavedQuestions(user.id);
      },
      followQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.followQuestion(user.id, questionId);
      },
      unfollowQuestion: async (questionId: string) => {
        if (!user) throw new Error("No autenticado");
        await userDataService.unfollowQuestion(user.id, questionId);
      },
      isQuestionFollowed: async (questionId: string) => {
        if (!user) return false;
        return userDataService.isQuestionFollowed(user.id, questionId);
      },
      getFollowedQuestions: async () => {
        if (!user) return [];
        return userDataService.getFollowedQuestions(user.id);
      }
    }),
    [user]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData debe usarse dentro de <UserDataProvider />");
  return ctx;
}

