import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Question } from "../../domain/types";
import { questionsService } from "../../services/questions/questionsService";
import type { AddAnswerInput, CreateQuestionInput } from "../../services/questions/QuestionsRepository";
import { useAuth } from "./AuthProvider";

type QuestionsContextValue = {
  questions: Question[];
  refresh: () => Promise<void>;
  getById: (id: string) => Promise<Question | null>;
  createQuestion: (input: CreateQuestionInput) => Promise<Question>;
  addAnswer: (input: AddAnswerInput) => Promise<void>;
  registerView: (questionId: string) => Promise<void>;
  updateQuestion: (input: {
    id: string;
    title: string;
    description: string;
    isAnonymous: boolean;
    category: string;
    tags: string[];
  }) => Promise<void>;
  updateAnswer: (input: { questionId: string; answerId: string; content: string }) => Promise<void>;
  rateAnswer: (input: { questionId: string; answerId: string; value: number }) => Promise<void>;
  rateQuestion: (input: { questionId: string; value: number }) => Promise<void>;
  listMyQuestions: () => Promise<Question[]>;
  listMyAnswers: () => Promise<Array<{ questionId: string; answerId: string; content: string; createdAt: string }>>;
  deleteQuestion: (questionId: string) => Promise<void>;
  deleteAnswer: (questionId: string, answerId: string) => Promise<void>;
  reset: () => void;
};

const QuestionsContext = createContext<QuestionsContextValue | null>(null);

export function QuestionsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    // Si cambia el nombre del usuario (perfil), refrescamos para reflejar authorName
    (async () => {
      const list = await questionsService.listQuestions();
      setQuestions(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const value = useMemo<QuestionsContextValue>(
    () => ({
      questions,
      refresh: async () => {
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      getById: async (id: string) => {
        return questionsService.getQuestionById(id);
      },
      createQuestion: async (input: CreateQuestionInput) => {
        const q = await questionsService.createQuestion(input, user);
        // Refrescar el usuario para actualizar questionsCount
        try {
          await refreshUser();
        } catch (refreshUserError) {
          console.warn("No se pudo refrescar el usuario después de crear la pregunta:", refreshUserError);
        }
        // Refrescar la lista de preguntas para que aparezca la nueva pregunta
        // Si falla, agregar la pregunta manualmente al estado local como fallback
        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (refreshError) {
          // Si falla el refresh, agregar la pregunta manualmente al estado local
          // Esto asegura que la pregunta aparezca inmediatamente aunque falle el refresh
          setQuestions((prev) => {
            // Evitar duplicados
            if (prev.some(p => p.id === q.id)) {
              return prev;
            }
            return [q, ...prev];
          });
          console.warn("No se pudo refrescar la lista de preguntas, pero la pregunta se creó correctamente:", refreshError);
        }
        return q;
      },
      addAnswer: async (input: AddAnswerInput) => {
        await questionsService.addAnswer(input, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      registerView: async (questionId: string) => {
        await questionsService.registerUniqueView(questionId, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      updateQuestion: async (input) => {
        await questionsService.updateQuestion(input, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      updateAnswer: async (input) => {
        await questionsService.updateAnswer(input, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      rateAnswer: async (input) => {
        await questionsService.rateAnswer(input, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      rateQuestion: async (input) => {
        await questionsService.rateQuestion(input, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      listMyQuestions: async () => {
        if (!user) return [];
        return questionsService.listQuestionsByAuthorId(user.id, user);
      },
      listMyAnswers: async () => {
        if (!user) return [];
        return questionsService.listAnswersByAuthorId(user.id, user);
      },
      deleteQuestion: async (questionId: string) => {
        await questionsService.deleteQuestion(questionId, user);
        // Refrescar el usuario para actualizar questionsCount
        try {
          await refreshUser();
        } catch (refreshUserError) {
          console.warn("No se pudo refrescar el usuario después de borrar la pregunta:", refreshUserError);
        }
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      deleteAnswer: async (questionId: string, answerId: string) => {
        await questionsService.deleteAnswer(questionId, answerId, user);
        const list = await questionsService.listQuestions();
        setQuestions(list);
      },
      reset: () => {
        questionsService.reset();
        setQuestions([]);
      }
    }),
    [questions, user, refreshUser]
  );

  return <QuestionsContext.Provider value={value}>{children}</QuestionsContext.Provider>;
}

export function useQuestions() {
  const ctx = useContext(QuestionsContext);
  if (!ctx) throw new Error("useQuestions debe usarse dentro de <QuestionsProvider />");
  return ctx;
}


