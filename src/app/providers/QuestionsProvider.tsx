import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Question } from "../../domain/types";
import { questionsService } from "../../services/questions/questionsService";
import type { AddAnswerInput, CreateQuestionInput } from "../../services/questions/QuestionsRepository";
import { useAuth } from "./AuthProvider";
import { ServiceError } from "../../services/errors";

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
  addReply: (input: { questionId: string; answerId: string; content: string }) => Promise<void>;
  listReplies: (questionId: string, answerId: string) => Promise<import("../../domain/reply").Reply[]>;
  deleteReply: (questionId: string, answerId: string, replyId: string) => Promise<void>;
  reset: () => void;
};

const QuestionsContext = createContext<QuestionsContextValue | null>(null);

export function QuestionsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);

  // ✅ TAREA B: listQuestions() debe ejecutarse al cargar app (lectura pública)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("[QuestionsProvider] Cargando preguntas (lectura pública, sin requerir auth)...");
        const list = await questionsService.listQuestions();
        if (!cancelled) {
          setQuestions(list);
          console.log(`[QuestionsProvider] ✓ Preguntas cargadas: ${list.length}`);
        }
      } catch (error) {
        console.error("[QuestionsProvider] Error cargando preguntas:", error);
        // ✅ TAREA B: No "matar" el estado si un refresh falla
        // Si es el primer load y falla, el array queda vacío (OK)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // Solo al montar

  // ✅ TAREA B: Al logout NO vaciar preguntas (porque lectura es pública)
  useEffect(() => {
    if (user?.id === undefined) return; // Esperar a que auth se hidrate

    let cancelled = false;

    (async () => {
      try {
        console.log("[QuestionsProvider] Cambio de auth (user):", user ? user.id : null);
        const list = await questionsService.listQuestions();
        if (!cancelled) {
          setQuestions(list);
          console.log(`[QuestionsProvider] ✓ Refresco tras auth: ${list.length} preguntas`);
        }
      } catch (error) {
        console.error("[QuestionsProvider] Error refrescando tras auth:", error);
        // ✅ TAREA B: No vaciar - mantener lo que había
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Si cambia el nombre del usuario, refrescamos para reflejar authorName
  useEffect(() => {
    if (!user?.name) return;

    let cancelled = false;

    (async () => {
      try {
        const list = await questionsService.listQuestions();
        if (!cancelled) setQuestions(list);
      } catch (error) {
        console.error("[QuestionsProvider] Error refrescando por cambio de nombre:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
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
        if (!user) {
          throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para crear una pregunta");
        }

        const q = await questionsService.createQuestion(input, user);

        try {
          await refreshUser();
        } catch (refreshUserError) {
          console.warn("[QuestionsProvider] No se pudo refrescar user después de crear pregunta:", refreshUserError);
        }

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (refreshError) {
          console.warn("[QuestionsProvider] No se pudo refrescar lista, agrego fallback local:", refreshError);
          setQuestions((prev) => {
            if (prev.some((p) => p.id === q.id)) return prev;
            return [q, ...prev];
          });
        }

        return q;
      },

      addAnswer: async (input: AddAnswerInput) => {
        // ✅ TAREA B: addAnswer debe validar que user exista, si no: error "Debes iniciar sesión"
        if (!user) {
          throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para responder");
        }

        try {
          console.log("[QuestionsProvider] addAnswer -> questionId:", input.questionId, "user:", user.id);
          await questionsService.addAnswer(input, user);
        } catch (err) {
          console.error("[QuestionsProvider] Error en addAnswer:", err);
          throw err;
        }

        // ✅ TAREA B: No "matar" el estado si un refresh falla
        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] addAnswer: respuesta guardada, pero falló refresh listQuestions:", err);
          // No vaciar el estado
        }
      },

      registerView: async (questionId: string) => {
        if (!user) return; // No registrar vista si no está logueado

        try {
          await questionsService.registerUniqueView(questionId, user);
        } catch (err) {
          console.warn("[QuestionsProvider] registerView error (ignorable):", err);
        }

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] registerView: falló refresh:", err);
        }
      },

      updateQuestion: async (input) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para editar");
        await questionsService.updateQuestion(input, user);

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] updateQuestion: falló refresh:", err);
        }
      },

      updateAnswer: async (input) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para editar");
        await questionsService.updateAnswer(input, user);

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] updateAnswer: falló refresh:", err);
        }
      },

      rateAnswer: async (input) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para calificar");
        
        // ✅ Guardar rating primero
        const updatedAnswer = await questionsService.rateAnswer(input, user);
        
        // ✅ Actualizar estado local inmediatamente con la respuesta actualizada
        setQuestions((prev) => {
          return prev.map((q) => {
            if (q.id === input.questionId) {
              const updatedAnswers = q.answers.map((a) => 
                a.id === input.answerId ? updatedAnswer : a
              );
              return { ...q, answers: updatedAnswers };
            }
            return q;
          });
        });

        // ✅ Refrescar lista completa como fallback (best-effort)
        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] rateAnswer: falló refresh completo (ya actualizado localmente):", err);
        }
      },

      rateQuestion: async (input) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para calificar");
        
        // ✅ Guardar rating primero
        await questionsService.rateQuestion(input, user);
        
        // ✅ Después de guardar rating, hacer refetch del question (getQuestionById) y reemplazar en estado
        try {
          const updatedQuestion = await questionsService.getQuestionById(input.questionId);
          if (updatedQuestion) {
            // ✅ Reemplazar pregunta en estado con la versión actualizada
            setQuestions((prev) => {
              const index = prev.findIndex((q) => q.id === input.questionId);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = updatedQuestion;
                return updated;
              }
              // ✅ Si no está en la lista, agregarla
              return [...prev, updatedQuestion];
            });
          }
        } catch (err: any) {
          // ✅ Si falla el refetch, loggear warning pero no bloquear
          console.warn(`[QuestionsProvider] rateQuestion: falló refetch de pregunta ${input.questionId} (rating ya guardado): ${err?.message || err}`);
        }
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
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para borrar");
        await questionsService.deleteQuestion(questionId, user);

        try {
          await refreshUser();
        } catch (refreshUserError) {
          console.warn("[QuestionsProvider] No se pudo refrescar user después de borrar pregunta:", refreshUserError);
        }

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] deleteQuestion: falló refresh:", err);
        }
      },

      deleteAnswer: async (questionId: string, answerId: string) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión para borrar");
        await questionsService.deleteAnswer(questionId, answerId, user);

        try {
          const list = await questionsService.listQuestions();
          setQuestions(list);
        } catch (err) {
          console.warn("[QuestionsProvider] deleteAnswer: falló refresh:", err);
        }
      },

      addReply: async (input: { questionId: string; answerId: string; content: string }) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
        await questionsService.addReply(input, user);
      },

      listReplies: async (questionId: string, answerId: string) => {
        return questionsService.listReplies(questionId, answerId);
      },

      deleteReply: async (questionId: string, answerId: string, replyId: string) => {
        if (!user) throw new ServiceError("auth/not-authenticated", "Debes iniciar sesión");
        await questionsService.deleteReply(questionId, answerId, replyId, user);
      },

      reset: () => {
        console.log("[QuestionsProvider] Reset llamado");
        questionsService.reset();
        // ✅ TAREA B: NO vaciar preguntas; la lectura es pública, se puede mantener
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
